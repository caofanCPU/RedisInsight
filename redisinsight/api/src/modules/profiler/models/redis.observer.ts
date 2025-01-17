import IORedis from 'ioredis';
import { ForbiddenException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { RedisErrorCodes } from 'src/constants';
import { ProfilerClient } from 'src/modules/profiler/models/profiler.client';
import { RedisObserverStatus } from 'src/modules/profiler/constants';
import { IShardObserver } from 'src/modules/profiler/interfaces/shard-observer.interface';
import ERROR_MESSAGES from 'src/constants/error-messages';
import { EventEmitter2 } from '@nestjs/event-emitter';

export class RedisObserver extends EventEmitter2 {
  private logger = new Logger('RedisObserver');

  private redis: IORedis.Redis | IORedis.Cluster;

  private profilerClients: Map<string, ProfilerClient> = new Map();

  private profilerClientsListeners: Map<string, any[]> = new Map();

  private shardsObservers: IShardObserver[] = [];

  public status: RedisObserverStatus;

  constructor() {
    super();
    this.status = RedisObserverStatus.Empty;
  }

  init(func: () => Promise<IORedis.Redis | IORedis.Cluster>) {
    this.status = RedisObserverStatus.Initializing;

    return func()
      .then((redis) => {
        this.redis = redis;
        this.status = RedisObserverStatus.Connected;
      })
      .then(() => this.connect())
      .then(() => {
        this.emit('connect');
        return Promise.resolve();
      })
      .catch((err) => {
        this.status = RedisObserverStatus.Error;
        this.emit('connect_error', err);
        return Promise.reject(err);
      });
  }

  /**
   * Create "monitor" clients for each shard if not exists
   * Subscribe profiler client to each each shard
   * Ignore when profiler client with such id already exists
   * @param profilerClient
   */
  public async subscribe(profilerClient: ProfilerClient) {
    if (this.status !== RedisObserverStatus.Ready) {
      await this.connect();
    }

    if (this.profilerClients.has(profilerClient.id)) {
      return;
    }

    if (!this.profilerClientsListeners.get(profilerClient.id)) {
      this.profilerClientsListeners.set(profilerClient.id, []);
    }

    const profilerListeners = this.profilerClientsListeners.get(profilerClient.id);

    this.shardsObservers.forEach((observer) => {
      const monitorListenerFn = (time, args, source, database) => {
        profilerClient.handleOnData({
          time, args, database, source, shardOptions: observer.options,
        });
      };
      const endListenerFn = () => {
        profilerClient.handleOnDisconnect();
        this.clear();
      };

      observer.on('monitor', monitorListenerFn);
      observer.on('end', endListenerFn);

      profilerListeners.push(monitorListenerFn, endListenerFn);
      this.logger.debug(`Subscribed to shard observer. Current listeners: ${observer.listenerCount('monitor')}`);
    });
    this.profilerClients.set(profilerClient.id, profilerClient);

    this.logger.debug(`Profiler Client with id:${profilerClient.id} was added`);
    this.logCurrentState();
  }

  public removeShardsListeners(profilerClientId: string) {
    this.shardsObservers.forEach((observer) => {
      (this.profilerClientsListeners.get(profilerClientId) || []).forEach((listener) => {
        observer.removeListener('monitor', listener);
        observer.removeListener('end', listener);
      });

      this.logger.debug(
        `Unsubscribed from from shard observer. Current listeners: ${observer.listenerCount('monitor')}`,
      );
    });
  }

  public unsubscribe(id: string) {
    this.removeShardsListeners(id);
    this.profilerClients.delete(id);
    this.profilerClientsListeners.delete(id);
    if (this.profilerClients.size === 0) {
      this.clear();
    }

    this.logger.debug(`Profiler Client with id:${id} was unsubscribed`);
    this.logCurrentState();
  }

  public disconnect(id: string) {
    this.removeShardsListeners(id);
    const profilerClient = this.profilerClients.get(id);
    if (profilerClient) {
      profilerClient.destroy();
    }
    this.profilerClients.delete(id);
    this.profilerClientsListeners.delete(id);
    if (this.profilerClients.size === 0) {
      this.clear();
    }

    this.logger.debug(`Profiler Client with id:${id} was disconnected`);
    this.logCurrentState();
  }

  /**
   * Logs useful inforation about current state for debug purposes
   * @private
   */
  private logCurrentState() {
    this.logger.debug(
      `Status: ${this.status}; Shards: ${this.shardsObservers.length}; Listeners: ${this.getProfilerClientsSize()}`,
    );
  }

  public clear() {
    this.profilerClients.clear();
    this.shardsObservers.forEach((observer) => {
      observer.removeAllListeners('monitor');
      observer.removeAllListeners('end');
      observer.disconnect();
    });
    this.shardsObservers = [];
    this.status = RedisObserverStatus.End;
  }

  /**
   * Return number of profilerClients for current Redis Observer instance
   */
  public getProfilerClientsSize(): number {
    return this.profilerClients.size;
  }

  /**
   * Create shard observer for each Redis shard to receive "monitor" data
   * @private
   */
  private async connect(): Promise<void> {
    try {
      if (this.redis instanceof IORedis.Cluster) {
        this.shardsObservers = await Promise.all(
          this.redis.nodes('all').filter((node) => node.status === 'ready').map(RedisObserver.createShardObserver),
        );
      } else {
        this.shardsObservers = [await RedisObserver.createShardObserver(this.redis)];
      }

      this.shardsObservers.forEach((observer) => {
        observer.on('error', (e) => {
          this.logger.error('Error on shard observer', e);
        });
      });

      this.status = RedisObserverStatus.Ready;
    } catch (error) {
      this.status = RedisObserverStatus.Error;

      if (error?.message?.includes(RedisErrorCodes.NoPermission)) {
        throw new ForbiddenException(error.message);
      }

      throw new ServiceUnavailableException(ERROR_MESSAGES.NO_CONNECTION_TO_REDIS_DB);
    }
  }

  /**
   * Create and return shard observer using IORedis common client
   * @param redis
   */
  static async createShardObserver(redis: IORedis.Redis): Promise<IShardObserver> {
    await RedisObserver.isMonitorAvailable(redis);
    return await redis.monitor() as IShardObserver;
  }

  /**
   * HACK: ioredis do not handle error when a user has no permissions to run the 'monitor' command
   * Here we try to send "monitor" command directly to throw error (like NOPERM) if any
   * @param redis
   */
  static async isMonitorAvailable(redis: IORedis.Redis): Promise<boolean> {
    // @ts-ignore
    const duplicate = redis.duplicate({
      ...redis.options,
      monitor: false,
      lazyLoading: false,
      connectionName: `redisinsight-monitor-perm-check-${Math.random()}`,
    });

    await duplicate.send_command('monitor');
    duplicate.disconnect();

    return true;
  }
}
