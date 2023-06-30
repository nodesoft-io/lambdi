import { Optional } from 'injection-js';
import { FromInjectionToken, generateHandler, Inject, InjectionToken, Lambda, Service } from '../src/index';

describe('injection precedence with lambdi 3', () => {
    test('injection service default value', async () => {
        const token = new InjectionToken('TOTO');

        @Service({ providers: [{ provide: token, useValue: 'defaultValue' }] })
        class MyService {
            constructor(@Inject(token) private readonly val: string) {}

            getVal(): string {
                return this.val;
            }
        }

        @Lambda({ providers: [MyService, { provide: token, useValue: 'CustomizedValue' }] })
        class MyLambda {
            constructor(private readonly s: MyService) {}
            async onHandler(): Promise<string> {
                return this.s.getVal();
            }
        }

        const handler = generateHandler(MyLambda);

        await expect(handler({}, {} as any)).resolves.toStrictEqual('CustomizedValue');
    });
    test('injection service customized value', async () => {
        const token = new InjectionToken<string>('TOTO');

        @Service({ providers: [{ provide: token, useValue: 'defaultValue' }] })
        class MyService {
            constructor(@Inject(token) private readonly val: FromInjectionToken<typeof token>) {}

            getVal(): string {
                return this.val;
            }
        }

        @Lambda({ providers: [MyService] })
        class MyLambda {
            constructor(private readonly s: MyService) {}
            async onHandler(): Promise<string> {
                return this.s.getVal();
            }
        }

        const handler = generateHandler(MyLambda);

        await expect(handler({}, {} as any)).resolves.toStrictEqual('defaultValue');
    });
});

describe('injection precedence with lambdi 2', () => {
    test('injection service default value', async () => {
        const token = new InjectionToken('TOTO');

        @Service({ providers: [] })
        class MyService {
            constructor(@Optional() @Inject(token) private readonly val: string) {}

            getVal(): string {
                return this.val || 'defaultValue';
            }
        }

        @Lambda({ providers: [MyService, { provide: token, useValue: 'CustomizedValue' }] })
        class MyLambda {
            constructor(private readonly s: MyService) {}
            async onHandler(): Promise<string> {
                return this.s.getVal();
            }
        }

        const handler = generateHandler(MyLambda);

        await expect(handler({}, {} as any)).resolves.toStrictEqual('CustomizedValue');
    });

    test('injection service customized value', async () => {
        const token = new InjectionToken('TOTO');

        @Service({ providers: [] })
        class MyService {
            constructor(@Optional() @Inject(token) private readonly val: string) {}

            getVal(): string {
                return this.val || 'defaultValue';
            }
        }

        @Lambda({ providers: [MyService] })
        class MyLambda {
            constructor(private readonly s: MyService) {}
            async onHandler(): Promise<string> {
                return this.s.getVal();
            }
        }

        const handler = generateHandler(MyLambda);

        await expect(handler({}, {} as any)).resolves.toStrictEqual('defaultValue');
    });
});
