/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Required, Simple } from '@ekonoo/models';
import { Event, generateHandler, Lambda, SQSRecord } from '../src';
import { SQSEvent } from 'aws-lambda';
import { SQS } from 'aws-sdk';

describe('Partial Failure Unit tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });
    test('All success', async () => {
        @Lambda({
            partialBatchFailure: true
        })
        class MyLambda {
            onHandler(@Event event: SQSEvent) {
                return event.Records.map(() => Promise.resolve(true));
            }
        }

        const handler = generateHandler(MyLambda)(
            {
                Records: [
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid1',
                        body: 'body_1',
                        receiptHandle: 'abcdef',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    },
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid2',
                        body: 'body_2',
                        receiptHandle: 'ghijklm',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    }
                ]
            },
            {} as any
        ) as Promise<boolean[]>;

        return handler.then((result) => expect(result).toMatchObject([true, true]));
    });

    test('Partial failed same error', () => {
        @Lambda({
            partialBatchFailure: true,
            providers: [
                {
                    provide: SQS,
                    useValue: {
                        deleteMessageBatch: (params: any) => {
                            expect(params).toMatchObject({
                                Entries: [{ Id: '0', ReceiptHandle: 'abcdef' }],
                                QueueUrl: 'http://href/1234567890/Queue.fifo'
                            });
                            return { promise: () => Promise.resolve() };
                        },
                        endpoint: {
                            href: 'http://href/'
                        }
                    }
                }
            ]
        })
        class MyLambda2 {
            async fail(): Promise<void> {
                throw new Error('failed');
            }

            onHandler(@Event e: SQSEvent) {
                return e.Records.map((_, i) => i === 0 ? Promise.resolve(true) : this.fail());
            }
        }

        const handler = (generateHandler(MyLambda2)(
            {
                Records: [
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid1',
                        body: 'body_1',
                        receiptHandle: 'abcdef',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    },
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid2',
                        body: 'body_2',
                        receiptHandle: 'ghijklm',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    },
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid3',
                        body: 'body_3',
                        receiptHandle: 'ghijklm',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    }
                ]
            },
            {} as any
        ) as Promise<boolean[]>).then(() => {
        });

        return handler.catch((err) => {
            expect(err.message).toStrictEqual('failed');
            expect(err.stack).toContain('MyLambda2.onHandler'); // better stack trace
        });
    });
    describe('SQSRecord', () => {
        test('implicit partial failure with @SQSRecord without arg', async () => {
            const deleteCounter: any[] = [];

            class MyRecord {
                @Required index: number;
            }

            @Lambda({
                providers: [
                    {
                        provide: SQS,
                        useValue: {
                            deleteMessageBatch: (params: any) => {
                                deleteCounter.push(params);
                                return { promise: () => Promise.resolve() };
                            },
                            endpoint: {
                                href: 'http://href/'
                            }
                        }
                    }
                ]
            })
            class MyLambdaWithSQSRecord {

                @SQSRecord()
                async onHandler(@Event record: MyRecord): Promise<boolean> {
                    switch (record.index) {
                        case 1:
                            return true;
                        case 2:
                            return Promise.resolve(true);
                        case 3:
                            throw new Error('oops');
                        case 4:
                            return false;
                        case 5:
                            return Promise.resolve(false);
                        case 6:
                            return Promise.reject(new Error('oops too'));
                        default:
                            fail(`should not have this value for index: ${JSON.stringify(record)}`);
                    }
                }
            }

            const buildRecord = (d: MyRecord) => ({
                attributes: {} as any,
                awsRegion: 'eu-west-1',
                md5OfBody: 'FFFFF',
                messageAttributes: {},
                messageId: `msg${d.index}`,
                body: JSON.stringify(d),
                receiptHandle: `handle${d.index}`,
                eventSource: 'aws:sqs',
                eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
            });

            const handler = (generateHandler(MyLambdaWithSQSRecord)(
                {
                    Records: [
                        buildRecord({ index: 1 }),
                        buildRecord({ index: 2 }),
                        buildRecord({ index: 3 }),
                        buildRecord({ index: 4 }),
                        buildRecord({ index: 5 }),
                        buildRecord({ index: 6 }),
                        buildRecord({ indexOops: 7 } as any)
                    ]
                },
                {} as any
            ) as Promise<boolean[]>);

            //
            const consoleMock: jest.SpyInstance = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            try {
                await handler;
                fail('it should have raised an error');
            } catch (e) {
                expect(`${e}`).toStrictEqual('Error: oops\n' +
                    'oops too\n' +
                    'MyRecord: error while validating MyRecord: data should have required property \'index\'');
                expect(deleteCounter.length).toStrictEqual(1);
                expect(deleteCounter[0]).toStrictEqual({
                    'Entries': [
                        {
                            'Id': '0',
                            'ReceiptHandle': 'handle1'
                        },
                        {
                            'Id': '1',
                            'ReceiptHandle': 'handle2'
                        },
                        {
                            'Id': '2',
                            'ReceiptHandle': 'handle4'
                        },
                        {
                            'Id': '3',
                            'ReceiptHandle': 'handle5'
                        }
                    ],
                    'QueueUrl': 'http://href/1234567890/Queue.fifo'
                });
                expect(consoleMock).toHaveBeenCalledTimes(3);
            }

        });


        test('implicit partial failure with @SQSRecord without arg (event bridge payload)', async () => {
            const deleteCounter: any[] = [];

            class MyInstruction {
                @Simple index: number;
            }

            @Lambda({
                providers: [
                    {
                        provide: SQS,
                        useValue: {
                            deleteMessageBatch: (params: any) => {
                                deleteCounter.push(params);
                                return { promise: () => Promise.resolve() };
                            },
                            endpoint: {
                                href: 'http://href/'
                            }
                        }
                    }
                ]
            })
            class MyLambdaWithSQSRecord {

                @SQSRecord('detail.instruction')
                async onHandler(@Event record: MyInstruction): Promise<boolean> {
                    switch (record.index) {
                        case 1:
                            return true;
                        case 2:
                            return Promise.resolve(true);
                        case 3:
                            throw new Error('oops');
                        case 4:
                            return false;
                        case 5:
                            return Promise.resolve(false);
                        case 6:
                            return Promise.reject(new Error('oops too'));
                        default:
                            fail(`should not have this value for index: ${JSON.stringify(record)}`);
                    }
                }
            }

            const buildRecord = (d: MyInstruction) => ({
                attributes: {} as any,
                awsRegion: 'eu-west-1',
                md5OfBody: 'FFFFF',
                messageAttributes: {},
                messageId: `msg${d.index}`,
                body: JSON.stringify({ detail: { instruction: d, skiped: 'osef' } }),
                receiptHandle: `handle${d.index}`,
                eventSource: 'aws:sqs',
                eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
            });

            const handler = (generateHandler(MyLambdaWithSQSRecord)(
                {
                    Records: [
                        buildRecord({ index: 1 }),
                        buildRecord({ index: 2 }),
                        buildRecord({ index: 3 }),
                        buildRecord({ index: 4 }),
                        buildRecord({ index: 5 }),
                        buildRecord({ index: 6 })
                    ]
                },
                {} as any
            ) as Promise<boolean[]>);

            const consoleMock: jest.SpyInstance = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            try {
                await handler;
                fail('it should have raised an error');
            } catch (e) {
                expect(deleteCounter.length).toStrictEqual(1);
                expect(deleteCounter[0]).toStrictEqual({
                    'Entries': [
                        {
                            'Id': '0',
                            'ReceiptHandle': 'handle1'
                        },
                        {
                            'Id': '1',
                            'ReceiptHandle': 'handle2'
                        },
                        {
                            'Id': '2',
                            'ReceiptHandle': 'handle4'
                        },
                        {
                            'Id': '3',
                            'ReceiptHandle': 'handle5'
                        }
                    ],
                    'QueueUrl': 'http://href/1234567890/Queue.fifo'
                });
                expect(consoleMock).toHaveBeenCalledTimes(2);
            }

        });


        test('implicit partial failure with @SQSRecord witouh molder model', async () => {
            const deleteCounter: any[] = [];

            class MyInstruction {
                index: number;
            }

            @Lambda({
                providers: [
                    {
                        provide: SQS,
                        useValue: {
                            deleteMessageBatch: (params: any) => {
                                deleteCounter.push(params);
                                return { promise: () => Promise.resolve() };
                            },
                            endpoint: {
                                href: 'http://href/'
                            }
                        }
                    }
                ]
            })
            class MyLambdaWithSQSRecord {
                @SQSRecord('detail.instruction')
                async onHandler(@Event record: MyInstruction): Promise<boolean> {
                    expect(record.index).toBeDefined();
                    expect((record as any).other).toBeDefined(); // molder is not there to remove this
                    return true;
                }
            }

            const buildRecord = (d: MyInstruction) => ({
                attributes: {} as any,
                awsRegion: 'eu-west-1',
                md5OfBody: 'FFFFF',
                messageAttributes: {},
                messageId: `msg${d.index}`,
                body: JSON.stringify({ detail: { instruction: d, skiped: 'osef' } }),
                receiptHandle: `handle${d.index}`,
                eventSource: 'aws:sqs',
                eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
            });

            const handler = (generateHandler(MyLambdaWithSQSRecord)(
                {
                    Records: [
                        buildRecord({ index: 1, other: true } as any),
                        buildRecord({ index: 2, other: true } as any)
                    ]
                },
                {} as any
            ) as Promise<boolean[]>);

            const consoleMock: jest.SpyInstance = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            await handler;

            expect(consoleMock).toHaveBeenCalledTimes(0);


        });

    });


    test('Partial failed different errors', () => {
        @Lambda({
            partialBatchFailure: true,
            providers: [
                {
                    provide: SQS,
                    useValue: {
                        deleteMessageBatch: (params: any) => {
                            expect(params).toMatchObject({
                                Entries: [{ Id: '0', ReceiptHandle: 'abcdef' }],
                                QueueUrl: 'http://href/1234567890/Queue.fifo'
                            });
                            return { promise: () => Promise.resolve() };
                        },
                        endpoint: {
                            href: 'http://href/'
                        }
                    }
                }
            ]
        })
        class MyLambda2 {
            async fail(): Promise<void> {
                throw new Error('failed');
            }

            onHandler(@Event _: SQSEvent) {
                return [Promise.resolve(true), Promise.reject(new Error('failed')), this.fail()];
            }
        }

        const handler = (generateHandler(MyLambda2)(
            {
                Records: [
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid1',
                        body: 'body_1',
                        receiptHandle: 'abcdef',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    },
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid2',
                        body: 'body_2',
                        receiptHandle: 'ghijklm',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    },
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid3',
                        body: 'body_3',
                        receiptHandle: 'ghijklm',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    }
                ]
            },
            {} as any
        ) as Promise<boolean[]>).then(() => {
        });

        const consoleMock: jest.SpyInstance = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        return handler.catch((err) => {
            expect(err.message).toStrictEqual('failed\nfailed');
            expect(err.stack).toContain('Error: failed\nfailed'); // better stack trace
            expect(consoleMock).toHaveBeenCalledTimes(2);
        });
    });

    test('fail because of molder', () => {
        class MyPayload {
            @Required name: string;
        }
        @Lambda({
        })
        class MyLambda3bis {
            onHandler(@Event e: MyPayload) {
                return e;
            }
        }

        const handler = (generateHandler(MyLambda3bis)(
            {noName: "osef"},
            {} as any
        ) as Promise<boolean[]>).then(() => {
        });

        return handler.then(() => fail('it should have failed')).catch((err) => {
            expect(err.message).toStrictEqual("MyPayload: error while validating MyPayload: data should have required property 'name'");
        });
    });


    test('Full failed same error', () => {
        @Lambda({
            partialBatchFailure: true
        })
        class MyLambda3 {
            onHandler(@Event e: SQSEvent) {
                return e.Records.map(_ => Promise.reject(new Error('failed')));
            }
        }

        const handler = (generateHandler(MyLambda3)(
            {
                Records: [
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid1',
                        body: 'body_1',
                        receiptHandle: 'abcdef',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    },
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid2',
                        body: 'body_2',
                        receiptHandle: 'ghijklm',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    },
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid3',
                        body: 'body_3',
                        receiptHandle: 'ghijklm',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    }
                ]
            },
            {} as any
        ) as Promise<boolean[]>).then(() => {
        });

        return handler.then(() => fail('it should have failed')).catch((err) => {
            expect(err.message).toStrictEqual('failed');
            expect(err.stack).toContain('MyLambda3.onHandler');
        });
    });

    test('Full failed differents errors', () => {
        @Lambda({
            partialBatchFailure: true
        })
        class MyLambda3 {
            onHandler(@Event _e: SQSEvent) {
                return [new Error('failed'), new Error('failed'), new Error('failed')];
            }
        }

        const handler = (generateHandler(MyLambda3)(
            {
                Records: [
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid1',
                        body: 'body_1',
                        receiptHandle: 'abcdef',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    },
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid2',
                        body: 'body_2',
                        receiptHandle: 'ghijklm',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    },
                    {
                        attributes: {} as any,
                        awsRegion: 'eu-west-1',
                        md5OfBody: 'FFFFF',
                        messageAttributes: {},
                        messageId: 'mid3',
                        body: 'body_3',
                        receiptHandle: 'ghijklm',
                        eventSource: 'aws:sqs',
                        eventSourceARN: 'arn:aws:sqs:eu-west-1:1234567890:Queue.fifo'
                    }
                ]
            },
            {} as any
        ) as Promise<boolean[]>).then(() => {
        });
        const consoleMock: jest.SpyInstance = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        return handler.catch((err) => {
            expect(err.message).toStrictEqual('failed\nfailed\nfailed');
            expect(err.stack).toContain('MyLambda3.onHandler');
            expect(consoleMock).toHaveBeenCalledTimes(3);
        });
    });
});
