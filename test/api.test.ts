import { Lambda, generateHandler, Event, PathParams, ApiResponse, QueryParams, Cors } from '../src';
import { Simple, Required, Item } from '@ekonoo/models';

describe('Unit tests', () => {
    test('API Integration', () => {
        class Path {
            @Simple foo: string;
        }
        class ResponseGet {
            @Required name: string;
            @Simple age: number;
        }
        class Query {
             @Item(String)
             @Simple queryValues: string[];
             @Simple querySingleValue: string;
        }
        @Lambda()
        class MyLambda {
            @ApiResponse(ResponseGet)
            onHandler(@PathParams path: Path, @QueryParams query: Query, @Event event: any): any {
                expect(event.test).toBeTruthy();
                expect(path.foo).toStrictEqual('qbcd');
                expect(query.querySingleValue).toStrictEqual('querySingleValue');
                expect(query.queryValues).toStrictEqual(['queryValues1', 'queryValues2']);
                expect((path as any).bar).toBeUndefined();
                return {
                    statusCode: 200,
                    body: {
                        name: path.foo
                    }
                };
            }
        }
        (generateHandler(MyLambda as any)(
            {
                test: true,
                headers: {},
                pathParameters: { foo: 'qbcd', bar: true },
                queryStringParameters: {querySingleValue : 'querySingleValue'},
                multiValueQueryStringParameters: {queryValues : ['queryValues1', 'queryValues2']},
                requestContext: { apiId: '123' }
            },
            {} as any
        ) as any).then(() => {});
    });

    test('API Integration with Promise', () => {
        class Path {
            @Simple foo: string;
        }


        @Lambda()
        class MyLambda {
            @Cors('http://test.lu')
            onHandler(@PathParams path: Path, @Event event: any): any {
                expect(event.test).toBeTruthy();
                expect(path.foo).toStrictEqual('qbcd');
                expect((path as any).bar).toBeUndefined();
                return Promise.resolve({
                    statusCode: 200,
                    body: {
                        name: path.foo
                    }
                });
            }
        }
        (generateHandler(MyLambda as any)(
            {
                test: true,
                pathParameters: { foo: 'qbcd', bar: true },
                headers: {Origin: 'http://test.lu'},
                requestContext: { apiId: '123' }
            },
            {} as any
        ) as any).then((r: any) => {
            expect(r.headers).toEqual({ 'Access-Control-Allow-Origin': 'http://test.lu' });
            });
            @Lambda()
            class MyLambdaWithWildcard {
                @Cors('*')
                onHandler(@PathParams path: Path, @Event event: any): any {
                    expect(event.test).toBeTruthy();
                    expect(path.foo).toStrictEqual('qbcd');
                    expect((path as any).bar).toBeUndefined();
                    return Promise.resolve({
                        statusCode: 200,
                        body: {
                            name: path.foo
                        }
                    });
                }
            }
            (generateHandler(MyLambdaWithWildcard as any)(
                {
                    test: true,
                    pathParameters: { foo: 'qbcd', bar: true },
                    headers: {Origin: 'http://test.lu'},
                    requestContext: { apiId: '123' }
                },
                {} as any
            ) as any).then((r: any) => {
                expect(r.headers).toEqual({ 'Access-Control-Allow-Origin': 'http://test.lu' });
                });
                @Lambda()
                class MyLambdaWithWithoutCors {
                    onHandler(@PathParams path: Path, @Event event: any): any {
                        expect(event.test).toBeTruthy();
                        expect(path.foo).toStrictEqual('qbcd');
                        expect((path as any).bar).toBeUndefined();
                        return Promise.resolve({
                            statusCode: 200,
                            body: {
                                name: path.foo
                            }
                        });
                    }
                }
                (generateHandler(MyLambdaWithWithoutCors as any)(
                    {
                        test: true,
                        pathParameters: { foo: 'qbcd', bar: true },
                        headers: {Origin: 'http://test.lu'},
                        requestContext: { apiId: '123' }
                    },
                    {} as any
                ) as any).then((r: any) => {
                    expect(r.headers).toEqual({});
                    });
    });

    test('API 400 error', async () => {
        class Path {
            @Required foo: string;
        }

        @Lambda()
        class MyLambda {
            onHandler(@PathParams path: Path): any {
                return Promise.resolve({
                    statusCode: 200,
                    body: {
                        name: path?.foo
                    }
                });
            }
        }
        return (generateHandler(MyLambda as any)(
            {
                pathParameters: {},
                headers: {},
                requestContext: { apiId: '123' }
            },
            {} as any
        ) as any).then((res: any) =>
            expect(res).toMatchObject({
                statusCode: 400,
                body: `{"message":"Path: error while validating Path: data should have required property 'foo'"}`
            })
        );
    });
    test('Error handler', async () => {
        const event = {
            pathParameters: {},
            requestContext: { apiId: '123' }
        };
        const context = {
            ctx: 'ctx'
        }
        class Path {
            @Required foo: string;
        }

        @Lambda()
        class MyLambda {
            onHandler(@PathParams path: Path): any {
                return Promise.resolve({
                    statusCode: 200,
                    body: {
                        name: path?.foo
                    }
                });
            }

            onError(_event: any, _context: any, err: Error): any {
                expect(_event).toBe(event);
                expect(_context).toBe(context);
                expect(err.message).toBe(`Path: error while validating Path: data should have required property 'foo'`);
                return {
                    statusCode: 200,
                    body: 'not ok :)'
                };
            }
        }
        return (generateHandler(MyLambda as any)(
            event,
            context as any
        ) as any).then((res: any) =>
            expect(res).toMatchObject({
                statusCode: 200,
                body: `not ok :)`
            })
        );
    });
});
