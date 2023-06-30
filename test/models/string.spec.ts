import { Simple, Max, Min, Enum, Item, Required, OneOf } from '../../src/models/decorators';
import { TYPE, MAX, MIN, ENUM } from '../../src/models/constants';
import { ruleValue } from '../../src/models/builder';
import { Molder } from '../../src/models';

describe('String tests', () => {
    test('Check string property', () => {
        class Account {
            @Simple name: string;
        }
        expect(ruleValue(TYPE, [Account], 'name')).toBe(String);
    });
    test('Check min/max value', () => {
        class Account {
            @Max(20)
            @Min(1)
            name: string;
        }
        expect(ruleValue(TYPE, [Account], 'name')).toBe(String);
        expect(ruleValue(MAX, [Account], 'name')).toBe(20);
        expect(ruleValue(MIN, [Account], 'name')).toBe(1);
    });
    test('Check enum values', () => {
        class Account {
            @Enum('aa', 'bb', 'cc')
            name: string;
        }
        expect(ruleValue(TYPE, [Account], 'name')).toBe(String);
        expect(ruleValue(ENUM, [Account], 'name')).toStrictEqual(['aa', 'bb', 'cc']);
    });
    test('Test OneOf', () => {
        class A {
            @Required a: string;
        }
        class B {
            @Required b: string;
        }
        class Account {
            @Item(OneOf(A, B)) name: (A | B)[];
        }
        expect(Molder.instantiate(Account, { name: [{ a: 'ss', s: 'ss' }] })).toMatchObject({
            name: [{ a: 'ss' }]
        });
        expect(Molder.instantiate(Account, { name: [{ b: 'ss', s: 'ss' }] })).toMatchObject({
            name: [{ b: 'ss' }]
        });
        expect(() => Molder.instantiate(Account, { name: [{ a: 'ss', b: 'ss' }] })).toThrowError();
        expect(() => Molder.instantiate(Account, { name: [{ c: 'ss', d: 'ss' }] })).toThrowError();
    });
});
