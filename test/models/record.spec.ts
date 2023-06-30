import { Record, Required } from '../../src/models/decorators';
import { RECORD } from '../../src/models/constants';
import { ruleValue } from '../../src/models/builder';
import { Molder } from '../../src/models';

describe('Record tests', () => {
    test('Check string record', () => {
        class Account {
            @Record(String) name: Record<string, string>;
        }
        expect(ruleValue(RECORD, [Account], 'name')).toBe(String);
    });
    test('Check record validation', () => {
        class Account {
            @Record(String) name: Record<string, string>;
        }

        expect(() => Molder.instantiate(Account, { name: 'test' })).toThrow();
        expect(Molder.instantiate(Account, { name: { firstName: 'test' } })).toMatchObject({
            name: { firstName: 'test' }
        });
    });
    test('Check validation with nested model', () => {
        class User {
            @Required id: string;
        }
        class Account {
            @Record(User) user: Record<string, User>;
        }
        expect(() => Molder.instantiate(Account, { user: { toto: 'test' } })).toThrow();
        expect(Molder.instantiate(Account, { user: { toto: { id: '123' } } })).toMatchObject({
            user: { toto: { id: '123' } }
        });
    });
});
