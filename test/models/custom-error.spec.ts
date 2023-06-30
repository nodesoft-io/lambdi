import { CustomError, Model, Molder, Required } from '../../src/models';

describe('custom errors', () => {
    test('add custom errors', () => {
        class User {
            @CustomError('votre nom doit être une chaine valide')
            @Required
            name: string;

            @Required
            age: string;
        }

        @Model('My global description')
        class Account {
            @Required
            user: User;
        }

        expect(() =>
            console.log(Molder.instantiate(Account, { user: { name: {}, age: 32 } }))
        ).toThrow(
            'error while validating Account: data/user/name votre nom doit être une chaine valide'
        );
        expect(() =>
            console.log(Molder.instantiate(Account, { user: { name: 'missing age ?' } }))
        ).toThrow("error while validating Account: data/user should have required property 'age'");
    });
});
