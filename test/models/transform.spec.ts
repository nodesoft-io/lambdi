import { Min, Item, Required, Trim, ToLowerCase, ToUpperCase } from '../../src/models/decorators';
import { Molder } from '../../src/models';

describe('Transform tests', () => {
    describe('Trim', () => {
        test('should not trim', () => {
            class Account {
                @Required name: string;
            }

            expect(Molder.validate(Account, { name: ' hello ' })).toStrictEqual({
                name: ' hello '
            });
        });

        test('should trim string', () => {
            class Account {
                @Required @Trim name: string;
            }

            expect(Molder.validate(Account, { name: ' hello world ' })).toStrictEqual({
                name: 'hello world'
            });
        });

        test('should not trim array if @Item not defined', () => {
            class Account {
                @Required @Trim names: string[];
            }

            expect(
                Molder.validate(Account, { names: [' hello ', ' world', 'abc ', 'def', '     '] })
            ).toStrictEqual({ names: [' hello ', ' world', 'abc ', 'def', '     '] });
        });

        test('should trim array', () => {
            class Account {
                @Required @Trim @Item(String) names: string[];
            }

            expect(
                Molder.validate(Account, { names: [' hello ', ' world', 'abc ', 'def', '     '] })
            ).toStrictEqual({ names: ['hello', 'world', 'abc', 'def', ''] });
        });

        test('should throw empty string after trim', () => {
            class Account {
                @Required @Trim @Min(1) name: string;
            }

            expect(() => Molder.validate(Account, { name: '     ' })).toThrowError();
        });
    });

    describe('ToLowerCase', () => {
        test('should lowercase string', () => {
            class Account {
                @Required @ToLowerCase @Item(String) name: string;
            }

            expect(Molder.validate(Account, { name: 'HELLO world AbCd 123.' })).toStrictEqual({
                name: 'hello world abcd 123.'
            });
        });

        test('should lowercase array', () => {
            class Account {
                @Required @ToLowerCase @Item(String) names: string[];
            }

            expect(
                Molder.validate(Account, { names: ['HELLO', 'world', 'AbCd', '123.'] })
            ).toStrictEqual({ names: ['hello', 'world', 'abcd', '123.'] });
        });
    });

    describe('ToUpperCase', () => {
        test('should uppercase string', () => {
            class Account {
                @Required @ToUpperCase name: string;
            }

            expect(Molder.validate(Account, { name: 'HELLO world AbCd 123.' })).toStrictEqual({
                name: 'HELLO WORLD ABCD 123.'
            });
        });

        test('should uppercase array', () => {
            class Account {
                @Required @ToUpperCase @Item(String) names: string[];
            }

            expect(
                Molder.validate(Account, { names: ['HELLO', 'world', 'AbCd', '123.'] })
            ).toStrictEqual({ names: ['HELLO', 'WORLD', 'ABCD', '123.'] });
        });
    });

    describe('Multiple transform', () => {
        test('should transform and validate', () => {
            class Account {
                @Required @Trim @ToLowerCase lowercase: string;
                @Required @Trim @ToUpperCase uppercase: string;
                @Required @Trim @ToLowerCase @Item(String) lowercaseList: string[];
                @Required @Trim @ToUpperCase @Item(String) uppercaseList: string[];
            }

            expect(
                Molder.validate(Account, {
                    lowercase: '     THIS will BE lowerCASE     ',
                    uppercase: '     THIS will BE upperCASE     ',
                    lowercaseList: [
                        '   THIS   ',
                        '   will   ',
                        '   BE   ',
                        '   lowerCASE   ',
                        '   '
                    ],
                    uppercaseList: [
                        '   THIS   ',
                        '   will   ',
                        '   BE   ',
                        '   upperCASE   ',
                        '   '
                    ]
                })
            ).toStrictEqual({
                lowercase: 'this will be lowercase',
                uppercase: 'THIS WILL BE UPPERCASE',
                lowercaseList: ['this', 'will', 'be', 'lowercase', ''],
                uppercaseList: ['THIS', 'WILL', 'BE', 'UPPERCASE', '']
            });
        });
    });
});
