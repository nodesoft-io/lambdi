import {
    Any,
    CustomSchema,
    Enum,
    ExtendRules,
    Item,
    Max,
    Min,
    Nullable,
    Required,
    Simple
} from '../../src/models/decorators';
import { Molder } from '../../src/models/mold';

describe('Molder tests', () => {
    describe('CustomSchema decorator', () => {
        test('Any molder', () => {
            expect(Molder.instantiate(Any, { name: 'toto', deep: [{ id: 42 }] })).toEqual({
                name: 'toto',
                deep: [{ id: 42 }]
            });
        });

        @CustomSchema({
            properties: {
                a: { type: 'string' },
                b: { type: 'number' }
            },
            allOf: [
                {
                    oneOf: [
                        {
                            required: ['a']
                        },
                        {
                            required: ['b']
                        }
                    ]
                },
                {
                    not: {
                        required: ['a', 'b']
                    }
                }
            ],
            additionalProperties: false
        })
        class Either {
            a: string;
            b: number;
        }

        test('custom schema', () => {
            expect(Molder.instantiate(Either, { a: 'coucou', other: 'never seen' })).toEqual({
                a: 'coucou'
            });

            expect(Molder.instantiate(Either, { b: 42, other: 'never seen' })).toEqual({
                b: 42
            });

            expect(() =>
                Molder.instantiate(Either, {
                    a: 'str',
                    b: 42
                })
            ).toThrow(
                'error while validating Either: data should NOT be valid, data should match exactly one schema in oneOf'
            );
        });
        test('Either as sub attr', () => {
            class Container {
                @Required either: Either;
            }

            expect(
                Molder.instantiate(Container, { either: { a: 'coucou', other: 'never seen' } })
            ).toEqual({
                either: {
                    a: 'coucou'
                }
            });
            expect(
                Molder.instantiate(Container, { either: { b: 42, other: 'never seen' } })
            ).toEqual({
                either: {
                    b: 42
                }
            });
            expect(() =>
                Molder.instantiate(Container, {
                    either: {
                        a: 'str',
                        b: 42
                    }
                })
            ).toThrow(
                'error while validating Container: data/either should NOT be valid, data/either should match exactly one schema in oneOf'
            );
        });
    });
    test('nullable value', () => {
        class User {
            @Nullable(String) name: string | null;
        }

        const s = Molder.jsonSchema(User);
        expect(Molder.instantiate(User, { name: null })).toEqual({
            name: null
        });
        expect(Molder.instantiate(User, { name: 'coucou' })).toEqual({
            name: 'coucou'
        });
    });
    test('mixed value', () => {
        class User {
            @Required @Min(1) @Nullable(Number) value: number | null;
        }

        expect(Molder.instantiate(User, { value: null })).toEqual({
            value: null
        });

        expect(Molder.instantiate(User, { value: 42 })).toEqual({
            value: 42
        });
    });

    test('simple default value support', () => {
        class MyModel {
            @Simple foo: string = 'bar';
        }

        expect(Molder.instantiate(MyModel, {})).toEqual({ foo: 'bar' });
    });
    test('default value supported with inheritance if no required', () => {
        class Account {
            @Max(11) amount: number = 2;
            @Min(0) name: string;
            @Simple enabled: boolean = false;
            @Item(String) list: string[];
            @Enum('a', 'b') foo: string = 'a';
        }

        @ExtendRules(Account)
        class SubAccount extends Account {
            @Simple type: string = 'credit';
        }

        expect(
            Molder.instantiate(SubAccount, {
                amount: 3,
                enabled: 'true',
                sss: 'ss',
                foo: 'b',
                type: 'debit'
            })
        ).toEqual({
            amount: 3,
            enabled: true,
            foo: 'b',
            type: 'debit'
        });

        expect(Molder.instantiate(SubAccount, {})).toEqual({
            amount: 2,
            enabled: false,
            foo: 'a',
            type: 'credit'
        });
    });

    test('Class inheritance', () => {
        class User {
            @Required name: string;
        }

        class Account {
            @Max(11) amount: number;
            @Min(0) name: string;
            @Required enabled: boolean;
            @Item(String) list: string[];
            @Simple other: User;
            @Required @Enum('a', 'b') foo: string;
        }

        @ExtendRules(Account)
        class SubAccount extends Account {
            @Item(User) more: User[];
        }

        expect(
            Molder.instantiate(SubAccount, { amount: 3, enabled: 'true', sss: 'ss', foo: 'b' })
        ).toEqual({
            amount: 3,
            enabled: true,
            foo: 'b'
        });
    });
    test('Multiple children inheritance', () => {
        class User {
            @Required name: string;
        }

        class Account {
            @Max(11) amount: number;
            @Min(0) name: string;
            @Required enabled: boolean;
            @Item(String) list: string[];
            @Simple other: User;
            @Required @Enum('a', 'b') foo: string;
        }

        @ExtendRules(Account)
        class SubAccount extends Account {
            @Item(User) more: User[];
        }

        @ExtendRules(SubAccount)
        class SubAccountBis extends SubAccount {
            @Required data: string;
        }

        class Org {
            @Required account: SubAccountBis;
        }

        expect(
            Molder.instantiate(Org, {
                account: { amount: 3, enabled: 'true', sss: 'ss', foo: 'b', data: 'test' }
            })
        ).toEqual({
            account: { amount: 3, enabled: true, foo: 'b', data: 'test' }
        });
    });

    describe('instantiateWithErrors', () => {
        test('should return empty instance with errors message', () => {
            class User {
                @Required name: string;
            }

            class Account {
                @Required @Max(11) amount: number;
                @Simple name: string;
                @Required user: User;
            }

            const res = Molder.instantiateWithErrors(Account, {});
            const errors =
                "data should have required property 'amount', data should have required property 'user'";

            expect(res.instance).toBeInstanceOf(Account);
            expect(res).toEqual({
                instance: {},
                errors
            });
        });

        test('should return instance filled with invalid payload and with errors message', () => {
            class User {
                @Required name: string;
            }

            class Account {
                @Required @Max(11) amount: number;
                @Simple name: string;
                @Required user: User;
                @Simple test: number;
            }

            const res = Molder.instantiateWithErrors(Account, {
                amount: 42,
                user: { name: 'ekonoo' },
                test: 'hello'
            });
            const errors = 'data/amount should be <= 11, data/test should be number';

            expect(res.instance).toBeInstanceOf(Account);
            expect(res).toEqual({
                instance: { amount: 42, user: { name: 'ekonoo' }, test: 'hello' },
                errors
            });
        });

        test('should return valid instance without error message', () => {
            class User {
                @Required name: string;
            }

            class Account {
                @Required @Max(11) amount: number;
                @Simple name: string;
                @Required user: User;
            }

            const res = Molder.instantiateWithErrors(Account, {
                amount: 5,
                user: { name: 'ekonoo' }
            });

            expect(res.instance).toBeInstanceOf(Account);
            expect(res).toEqual({
                instance: { amount: 5, user: { name: 'ekonoo' } }
            });
        });
    });
});
