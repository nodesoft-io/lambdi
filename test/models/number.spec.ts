import { Simple, Max } from '../../src/models/decorators';
import { TYPE, MAX } from '../../src/models/constants';
import { ruleValue } from '../../src/models/builder';

describe('Number tests', () => {
    test('Check number property', () => {
        class Account {
            @Simple amount: number;
        }
        expect(ruleValue(TYPE, [Account], 'amount')).toBe(Number);
    });
    test('Check max value', () => {
        class Account {
            @Max(200) amount: number;
        }
        expect(ruleValue(TYPE, [Account], 'amount')).toBe(Number);
        expect(ruleValue(MAX, [Account], 'amount')).toBe(200);
    });
});
