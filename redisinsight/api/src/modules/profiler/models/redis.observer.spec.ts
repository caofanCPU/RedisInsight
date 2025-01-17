import * as Redis from 'ioredis';
import { RedisObserver } from 'src/modules/profiler/models/redis.observer';
import { RedisObserverStatus } from 'src/modules/profiler/constants';
import {
  mockMonitorDataItemEmitted, mockProfilerClient, mockRedisNoPermError, mockRedisShardObserver, mockSocket,
} from 'src/__mocks__';
import { ProfilerClient } from 'src/modules/profiler/models/profiler.client';
import { ReplyError } from 'src/models';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';

const getRedisClientFn = jest.fn();

const nodeClient = Object.create(Redis.prototype);
nodeClient.monitor = jest.fn();
nodeClient.status = 'ready';
nodeClient.disconnect = jest.fn();
nodeClient.duplicate = jest.fn();
nodeClient.send_command = jest.fn();

const mockClusterNode1 = nodeClient;
const mockClusterNode2 = nodeClient;
const clusterClient = Object.create(Redis.Cluster.prototype);
mockClusterNode1.options = { ...nodeClient.options, host: 'localhost', port: 5000 };
mockClusterNode2.options = { ...nodeClient.options, host: 'localhost', port: 5001 };
const NO_PERM_ERROR: ReplyError = {
  ...mockRedisNoPermError,
  command: 'MONITOR',
};

describe('RedisObserver', () => {
  let redisObserver: RedisObserver;

  beforeEach(() => {
    jest.resetAllMocks();
    redisObserver = new RedisObserver();
    getRedisClientFn.mockResolvedValue(nodeClient);
  });

  it('initialization', () => {
    expect(redisObserver['status']).toEqual(RedisObserverStatus.Empty);
  });

  describe('init', () => {
    it('successfully init', async () => {
      await new Promise((resolve) => {
        redisObserver['connect'] = jest.fn();
        redisObserver.init(getRedisClientFn);
        expect(redisObserver['status']).toEqual(RedisObserverStatus.Initializing);
        redisObserver.on('connect', () => {
          resolve(true);
        });
      });
      expect(redisObserver['status']).toEqual(RedisObserverStatus.Connected);
      expect(redisObserver['redis']).toEqual(nodeClient);
    });
    it('init error due to redis connection', async () => {
      try {
        getRedisClientFn.mockRejectedValueOnce(new Error('error'));
        await redisObserver.init(getRedisClientFn);
        fail();
      } catch (e) {
        expect(redisObserver['status']).toEqual(RedisObserverStatus.Error);
        expect(redisObserver['redis']).toEqual(undefined);
      }
    });
  });

  describe('subscribe', () => {
    beforeEach(() => {
      redisObserver['connect'] = jest.fn();
      redisObserver['shardsObservers'] = [nodeClient];
    });

    it('should subscribe to a standalone', async () => {
      nodeClient.send_command.mockResolvedValue('OK');

      await redisObserver.init(getRedisClientFn);
      await redisObserver.subscribe(mockProfilerClient);
      redisObserver['status'] = RedisObserverStatus.Ready;
      await redisObserver.subscribe(mockProfilerClient);

      expect(redisObserver['shardsObservers'].length).toEqual(1);
      expect(redisObserver['profilerClientsListeners'].size).toEqual(1);
      expect(redisObserver['profilerClientsListeners'].get(mockProfilerClient.id).length).toEqual(2);

      nodeClient.emit('monitor', ...Object.values(mockMonitorDataItemEmitted));
      expect(mockProfilerClient['handleOnData']).toHaveBeenCalledWith({
        ...mockMonitorDataItemEmitted,
        shardOptions: nodeClient.options,
      });
      expect(mockProfilerClient['handleOnData']).toHaveBeenCalledTimes(1);

      nodeClient.emit('end');
      expect(mockProfilerClient['handleOnDisconnect']).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to a cluster', async () => {
      redisObserver['shardsObservers'] = [mockClusterNode1, mockClusterNode2];
      getRedisClientFn.mockResolvedValueOnce(clusterClient);
      await redisObserver.init(getRedisClientFn);
      await redisObserver.subscribe(mockProfilerClient);
      redisObserver['status'] = RedisObserverStatus.Ready;
      await redisObserver.subscribe(mockProfilerClient);
      expect(redisObserver['connect']).toHaveBeenCalledTimes(2);
      expect(redisObserver['shardsObservers'].length).toEqual(2);
      expect(redisObserver['profilerClientsListeners'].size).toEqual(1);
      expect(redisObserver['profilerClientsListeners'].get(mockProfilerClient.id).length).toEqual(4);

      nodeClient.emit('monitor', ...Object.values(mockMonitorDataItemEmitted));
      expect(mockProfilerClient['handleOnData']).toHaveBeenCalledWith({
        ...mockMonitorDataItemEmitted,
        shardOptions: { ...mockClusterNode1.options },
      });
      expect(mockProfilerClient['handleOnData']).toHaveBeenCalledWith({
        ...mockMonitorDataItemEmitted,
        shardOptions: { ...mockClusterNode2.options },
      });
      expect(mockProfilerClient['handleOnData']).toHaveBeenCalledTimes(2);

      nodeClient.emit('end');
      expect(mockProfilerClient['handleOnDisconnect']).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribe', () => {
    let clearSpy;
    let profilerClient1;
    let profilerClient2;
    let destroySpy1;
    let destroySpy2;

    beforeEach(async () => {
      clearSpy = jest.spyOn(redisObserver, 'clear');
      redisObserver['connect'] = jest.fn();
      redisObserver['shardsObservers'] = [mockRedisShardObserver];
      profilerClient1 = new ProfilerClient('1', mockSocket);
      profilerClient2 = new ProfilerClient('2', mockSocket);
      destroySpy1 = jest.spyOn(profilerClient1, 'destroy');
      destroySpy2 = jest.spyOn(profilerClient2, 'destroy');

      await redisObserver.init(getRedisClientFn);
      await redisObserver.subscribe(profilerClient1);
      await redisObserver.subscribe(profilerClient2);
    });

    it('unsubscribe', async () => {
      expect(redisObserver['profilerClients'].size).toEqual(2);
      expect(redisObserver['profilerClientsListeners'].size).toEqual(2);
      redisObserver.unsubscribe('1');
      expect(mockRedisShardObserver.removeListener).toHaveBeenCalledTimes(4);
      expect(redisObserver['profilerClients'].size).toEqual(1);
      expect(redisObserver['profilerClientsListeners'].size).toEqual(1);
      expect(clearSpy).not.toHaveBeenCalled();

      redisObserver.unsubscribe('2');
      expect(mockRedisShardObserver.removeListener).toHaveBeenCalledTimes(8);
      expect(redisObserver['profilerClients'].size).toEqual(0);
      expect(redisObserver['profilerClientsListeners'].size).toEqual(0);
      expect(clearSpy).toHaveBeenCalled();

      expect(destroySpy1).not.toHaveBeenCalled();
      expect(destroySpy2).not.toHaveBeenCalled();
    });

    it('disconnect', async () => {
      expect(redisObserver['profilerClients'].size).toEqual(2);
      expect(redisObserver['profilerClientsListeners'].size).toEqual(2);
      redisObserver.disconnect('1');
      expect(mockRedisShardObserver.removeListener).toHaveBeenCalledTimes(4);
      expect(redisObserver['profilerClients'].size).toEqual(1);
      expect(redisObserver['profilerClientsListeners'].size).toEqual(1);
      expect(clearSpy).not.toHaveBeenCalled();

      redisObserver.disconnect('2');
      expect(mockRedisShardObserver.removeListener).toHaveBeenCalledTimes(8);
      expect(redisObserver['profilerClients'].size).toEqual(0);
      expect(redisObserver['profilerClientsListeners'].size).toEqual(0);
      expect(clearSpy).toHaveBeenCalled();

      expect(destroySpy1).toHaveBeenCalled();
      expect(destroySpy2).toHaveBeenCalled();
    });
  });

  describe('connect', () => {
    beforeEach(async () => {
      nodeClient.send_command.mockResolvedValue('OK');
      nodeClient.duplicate.mockReturnValue(nodeClient);
      nodeClient.monitor.mockReturnValue(mockRedisShardObserver);
    });

    it('connect to standalone', async () => {
      await redisObserver.init(getRedisClientFn);
      const profilerClient = new ProfilerClient('1', mockSocket);
      await redisObserver.subscribe(profilerClient);
      expect(redisObserver['shardsObservers']).toEqual([mockRedisShardObserver]);
      expect(redisObserver['status']).toEqual(RedisObserverStatus.Ready);
    });

    it('connect fail due to NOPERM', async () => {
      try {
        nodeClient.send_command.mockRejectedValueOnce(NO_PERM_ERROR);
        await redisObserver.init(getRedisClientFn);
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(ForbiddenException);
        expect(redisObserver['shardsObservers']).toEqual([]);
        expect(redisObserver['status']).toEqual(RedisObserverStatus.Error);
      }
    });

    it('connect fail due an error', async () => {
      try {
        nodeClient.send_command.mockRejectedValueOnce(new Error('some error'));
        await redisObserver.init(getRedisClientFn);
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(ServiceUnavailableException);
        expect(redisObserver['shardsObservers']).toEqual([]);
        expect(redisObserver['status']).toEqual(RedisObserverStatus.Error);
      }
    });

    it('connect to cluster', async () => {
      getRedisClientFn.mockResolvedValue(clusterClient);
      clusterClient.nodes = jest.fn().mockReturnValue([mockClusterNode1, mockClusterNode2]);
      await redisObserver.init(getRedisClientFn);

      redisObserver['redis'] = clusterClient;
      expect(redisObserver['shardsObservers']).toEqual([mockRedisShardObserver, mockRedisShardObserver]);
      expect(redisObserver['status']).toEqual(RedisObserverStatus.Ready);
    });
  });
});
