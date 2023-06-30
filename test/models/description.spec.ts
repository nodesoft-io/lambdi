import { Description, Model } from '../../src/models/decorators';
import { DESCRIPTION } from '../../src/models/constants';
import { ruleValue } from '../../src/models/builder';
import { Molder } from '../../src/models';

describe('Description tests', () => {
    test('Check global description', () => {
        @Model('My global description')
        class Account {
            @Description('the name') name: string;
        }
        expect(Molder.getDescription(Account)).toStrictEqual('My global description');
        expect(ruleValue(DESCRIPTION, [Account], 'name')).toBe('the name');
    });
});
