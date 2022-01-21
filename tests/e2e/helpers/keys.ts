import { Chance } from 'chance';
import { KeyTypesTexts } from './constants';

export function getRandomKeyName(keyNameLength: number): string {
    const chance = new Chance();
    let result = '';
    for (let i = 0; i < keyNameLength; i++) {
        result += chance.character();
    }
    return result;
}

export const keyTypes = [
    { textType: KeyTypesTexts.Hash, keyName: 'hash' },
    { textType: KeyTypesTexts.Set, keyName: 'set' },
    { textType: KeyTypesTexts.ZSet, keyName: 'zset' },
    { textType: KeyTypesTexts.List, keyName: 'list' },
    { textType: KeyTypesTexts.String, keyName: 'string' },
    { textType: KeyTypesTexts.Graph, keyName: 'graph' },
    { textType: KeyTypesTexts.ReJSON, keyName: 'json' },
    { textType: KeyTypesTexts.Stream, keyName: 'stream' },
    { textType: KeyTypesTexts.TimeSeries, keyName: 'timeSeries' }
]