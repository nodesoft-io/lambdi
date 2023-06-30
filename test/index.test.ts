/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Lambda, generateHandler, Service } from '../src';
import { extractMetadataByDecorator } from '../src/metadata';

describe('Unit tests', () => {
    test('Lambda without options', () => {
        @Lambda()
        class MyLambda {
            onHandler() {
                throw new Error('Method not implemented.');
            }
        }

        const metadata = extractMetadataByDecorator<Lambda>(MyLambda, 'Lambda');

        expect(metadata).toMatchObject({});
    });

    test('Lambda with options', () => {
        @Lambda({ providers: [] })
        class MyLambda {
            onHandler() {
                throw new Error('Method not implemented.');
            }
        }

        const metadata = extractMetadataByDecorator<Lambda>(MyLambda, 'Lambda');

        expect(metadata).toMatchObject({ providers: [] });
    });

    test("lambda class exported by generateHandler", () => {
        @Lambda()
        class MyLambda {
            onHandler() {
                return 'ok';
            }
        }
        const handler = generateHandler(MyLambda);
        expect(handler.lambdaClass).toBe(MyLambda);
    });

    test('Lambda Handler call', async () => {
        @Lambda()
        class MyLambda {
            onHandler() {
                return 'ok';
            }
        }

        expect(await generateHandler(MyLambda)(null, null)).toBe('ok');
    });

    test('DI with 1 dep', async () => {
        @Service()
        class MyService {
            hello() {
                return 'hello';
            }
        }

        @Lambda({
            providers: [MyService]
        })
        class MyLambda {
            constructor(private srv: MyService) {}
            onHandler() {
                return this.srv.hello();
            }
        }

        expect(await generateHandler(MyLambda)(null, null)).toBe('hello');
    });

    test('DI with 2 deps', async () => {
        @Service()
        class MyService1 {
            hello() {
                return 'hello';
            }
        }

        @Service()
        class MyService2 {
            world() {
                return 'world';
            }
        }

        @Lambda({
            providers: [MyService1, MyService2]
        })
        class MyLambda {
            constructor(private srv1: MyService1, private srv2: MyService2) {}
            onHandler() {
                return `${this.srv1.hello()} ${this.srv2.world()}`;
            }
        }

        expect(await generateHandler(MyLambda)(null, null)).toBe('hello world');
    });

    test('DI with 2 deps nested', async () => {
        @Service()
        class MyService2 {
            world() {
                return 'world';
            }
        }

        @Service()
        class MyService1 {
            constructor(private srv: MyService2) {}
            hello() {
                return `hello ${this.srv.world()}`;
            }
        }

        @Lambda({
            providers: [MyService1, MyService2]
        })
        class MyLambda {
            constructor(private srv1: MyService1) {}
            onHandler() {
                return this.srv1.hello();
            }
        }

        expect(await generateHandler(MyLambda)(null, null)).toBe('hello world');
    });

    test('DI with 2 deps nested and provider in services', async () => {
        @Service()
        class MyService2 {
            world() {
                return 'world';
            }
        }

        @Service({
            providers: [MyService2]
        })
        class MyService1 {
            constructor(private srv: MyService2) {}
            hello() {
                return `hello ${this.srv.world()}`;
            }
        }

        @Lambda({
            providers: [MyService1]
        })
        class MyLambda {
            constructor(private srv1: MyService1) {}
            onHandler() {
                return this.srv1.hello();
            }
        }

        expect(await generateHandler(MyLambda)(null, null)).toBe('hello world');
    });

    test('DI with same service provided multiple times', async () => {
        @Service()
        class MyService4 {}

        @Service({ providers: [MyService4] })
        class MyService3 {
            test() {
                return 'test';
            }
        }

        @Service({
            providers: [MyService3, MyService4]
        })
        class MyService2 {
            constructor(private test: MyService3) {}
            world() {
                return `${this.test.test()} world`;
            }
        }

        @Service({
            providers: [MyService2, MyService4]
        })
        class MyService1 {
            constructor(private srv: MyService2, private test: MyService3) {}
            hello() {
                return `${this.test.test()} hello ${this.srv.world()}`;
            }
        }

        @Lambda({
            providers: [MyService1, MyService3, MyService4]
        })
        class MyLambda {
            constructor(private srv1: MyService1, private test: MyService3) {}
            onHandler() {
                return `${this.test.test()} ${this.srv1.hello()}`;
            }
        }

        expect(await generateHandler(MyLambda)(null, null)).toBe('test test hello test world');
    });

    test('DI with real life example from financial instrument', async () => {
        @Service()
        class FundTransformerService {}

        @Service({ providers: [FundTransformerService] })
        class ShareNavRepository {
            constructor(private transformer: FundTransformerService) {}
        }

        @Service({ providers: [FundTransformerService] })
        class ShareDocumentRepository {
            constructor(private transofmer: FundTransformerService) {}
        }

        @Service({ providers: [FundTransformerService] })
        class SharePerformanceRepository {
            constructor(private transformer: FundTransformerService) {}
        }

        @Service({
            providers: [
                SharePerformanceRepository,
                ShareDocumentRepository,
                ShareNavRepository,
                FundTransformerService
            ]
        })
        class FundRepository {
            constructor(
                private perf: SharePerformanceRepository,
                private doc: ShareDocumentRepository,
                private nav: ShareNavRepository,
                private transformer: FundTransformerService
            ) {}
        }

        @Service()
        class FundFetcherService {}

        @Service({
            providers: [FundRepository, ShareNavRepository, FundFetcherService]
        })
        class FundService {
            constructor(
                private fundRepo: FundRepository,
                private navRepo: ShareNavRepository,
                private fetcher: FundFetcherService
            ) {}
        }

        @Lambda({
            providers: [FundService]
        })
        class MyLambda {
            constructor(private fundService: FundService) {}
            onHandler() {}
        }

        expect(() => generateHandler(MyLambda)).not.toThrow();
    });
});
