import 'reflect-metadata';
import { Type } from './interfaces';
import { DependencyInjection } from './di';
import { AWSProviders, Context } from './aws';
import { extractMetadataFromLambda } from './metadata';
import { Lambda } from './decorators';
import { APIGatewayProxyResult, SQSRecord, APIGatewayProxyEvent } from 'aws-lambda';
import { applySQSPartialBatchFailure } from './partial-failure';
import { ReflectiveInjector } from 'injection-js';
import {
    APIGatewayProxyResponse,
    BadRequestError,
    extractArguments,
    CorsBuilder,
    instantiateAndValidateResponse,
    isInAllowedGroups,
    SECURITY_HEADERS
} from './api';
import { Logger, PinoLogger } from './logger';
import { SQSClient } from '@aws-sdk/client-sqs';

export * from './decorators';
export * from './interfaces';
export * from './logger';
export { APIGatewayProxyResponse } from './api';

/**
 * Make sure the feature is enabled
 *
 * @param lambda
 * @param record
 */
function partialBatchFailureCheck(lambda: Lambda, record: SQSRecord): boolean {
    return record.eventSource === 'aws:sqs' && !!Promise.allSettled;
}

/**
 * Use Partial Batch Failure process
 * if event check match SQS Records
 *
 * @param event
 * @param result
 * @param metadata
 * @param di
 */
function processPartialBatchFailure<E, R>(
    event: E,
    result: R,
    metadata: Lambda,
    di: ReflectiveInjector
): R | Promise<any[]> {
    if (result instanceof Array && result.every((item) => item instanceof Promise)) {
        if (
            metadata.partialBatchFailure === true &&
            (event as any)?.Records?.every((item: SQSRecord) =>
                partialBatchFailureCheck(metadata, item)
            )
        ) {
            return applySQSPartialBatchFailure(event as any, result, di.get(SQSClient));
        }
        return Promise.all(result);
    }
    return result;
}

/**
 * Get response model for the given status code
 *
 * @param result
 * @param token
 */
function processApiResponse<Response>(
    result: APIGatewayProxyResponse<Response> | Promise<APIGatewayProxyResponse<Response>>,
    token: Function
): Promise<APIGatewayProxyResult> {
    const responses =
        Reflect.getOwnMetadata('lambdi:responses', token.prototype, 'onHandler') || {};
    return instantiateAndValidateResponse(result as any, responses);
}
/**
 * Inject cors in headers
 *
 * @param result
 * @param token
 */
function injectCors<Response>(
    event: any,
    result: APIGatewayProxyResponse<Response>,
    token: Function
): APIGatewayProxyResponse<Response> {
    const allowedOrigins =
        Reflect.getOwnMetadata('lambdi:cors', token.prototype, 'onHandler') || {};
    const corsBuilder = new CorsBuilder(allowedOrigins);
    return {
        ...result,
        headers: {
            ...SECURITY_HEADERS,
            ...result.headers,
            ...corsBuilder.createOriginHeader(event)
        }
    };
}

function hookExists(prop: any): boolean {
    return prop instanceof Function;
}

function isEventApiRequest<E extends { Records?: any[] } & Record<string, any>>(event: E): boolean {
    return (event as any)?.requestContext?.apiId;
}

export interface HandlerFunction<E, R, CLS> {
    (event: E, context: Context): R | Promise<any[]>;
    lambdaClass: CLS;
}

export interface LambdaFunction {
    onHandler?: (...p: any[]) => any;
    onError?: (...p: any[]) => any;
}
/**
 * Generate the Lambda Handler
 * to be exported and used by AWS Lambda
 *
 * @param token Lambda Class
 * @param providers Provider list for the DI
 * @param options
 */
export function generateHandler<
    E extends { Records?: any[] } & Record<string, any>,
    R,
    T extends LambdaFunction = LambdaFunction
>(token: Type<T>): HandlerFunction<E, R, typeof token> {
    const metadata = extractMetadataFromLambda(token);
    const logger = PinoLogger.build(
        (global as any)?.DOMAIN,
        token?.name,
        null,
        process.env.LOGGER_LEVEL as any
    );

    // Capture http(s) requests only if Xray is enabled and http(s) module is loaded
    if (!process.env.DISABLE_XRAY) {
        const AWSXRay = require('aws-xray-sdk-core');
        // @ts-expect-error ts2339 moduleLoadList missing from types
        if (process.moduleLoadList?.includes?.('NativeModule http')) {
            AWSXRay.captureHTTPsGlobal(require('http'));
        }
        // @ts-expect-error ts2339 moduleLoadList missing from types
        if (process.moduleLoadList?.includes?.('NativeModule https')) {
            AWSXRay.captureHTTPsGlobal(require('https'));
        }
    }

    const di = DependencyInjection.createAndResolve(
        []
            .concat(AWSProviders(), metadata.providers, {
                provide: Logger,
                useValue: logger
            })
            .filter(Boolean)
    );
    const instance = DependencyInjection.instantiate(token, di);
    logger.trace('Lambda instantiated');

    const handler = (event: E, context: Context): any => {
        logger.setContext(context);

        // Ignore s3 test event for topic / queue configuration
        if (event?.Event === 's3:TestEvent') {
            logger.trace('Ignore s3:TestEvent', event);
            return Promise.resolve();
        }

        let codeResultPromise: Promise<any>;
        const isApiRequest = isEventApiRequest(event);

        if (
            isApiRequest &&
            metadata.allowedGroups?.length &&
            !isInAllowedGroups(event as unknown as APIGatewayProxyEvent, metadata.allowedGroups)
        ) {
            return Promise.resolve(
                injectCors(
                    event,
                    {
                        statusCode: 403,
                        body: JSON.stringify({
                            message:
                                'Forbidden: you are not in the group of allowed users to perform this action'
                        })
                    },
                    token
                )
            );
        }

        if (instance && hookExists(instance.onHandler)) {
            const sqsRecord = Reflect.getOwnMetadata(
                'lambdi:sqs-record',
                token.prototype,
                'onHandler'
            );

            if (sqsRecord !== undefined) {
                // the onHandler ask for each record, and will be called for each of them
                if (event.Records === undefined) {
                    throw new Error('@SQSRecord decorator only work with SQSEvent events');
                }
                codeResultPromise = Promise.resolve(
                    event.Records.map((record) => {
                        try {
                            let data = JSON.parse(record.body);
                            const path: string = sqsRecord.path;
                            if (path !== undefined) {
                                // browse the data for the given path.
                                data = path
                                    .split('.')
                                    .reduce(
                                        (cur: Record<string, any>, part: string) => cur[part],
                                        data
                                    );
                            }

                            // Ignore s3 test event for topic / queue configuration
                            if (data?.Event === 's3:TestEvent') {
                                logger.trace('Ignore s3:TestEvent', data);
                                return Promise.resolve();
                            }

                            return Reflect.apply(
                                instance.onHandler,
                                instance,
                                extractArguments(data as any, context, token)
                            );
                        } catch (e) {
                            return Promise.reject(e);
                        }
                    })
                );
                metadata.partialBatchFailure = true;
            } else {
                codeResultPromise = Promise.resolve()
                    .then(() => extractArguments(event as any, context, token))
                    .then((args) => Reflect.apply(instance.onHandler, instance, args));
            }
            logger.trace('onHandler triggered');
        } else {
            throw new Error('you must implement the onHandler method');
        }
        logger.trace('onHandler triggered');
        return codeResultPromise
            .then(
                (result) =>
                    processPartialBatchFailure<E, R>(event as E, result, metadata, di) as any
            )
            .then((result) =>
                isApiRequest ? (processApiResponse(result as any, token) as any) : result
            )
            .then((r) => (isApiRequest ? injectCors(event, r as any, token) : r))
            .catch((err) => {
                logger.error(err);
                if (isApiRequest) {
                    const response = injectCors(
                        event,
                        {
                            statusCode: err instanceof BadRequestError ? 400 : 500,
                            body: JSON.stringify({
                                message:
                                    err instanceof BadRequestError
                                        ? err.message
                                        : 'Internal Server Error'
                            })
                        } as any,
                        token
                    );
                    if (hookExists(instance.onError)) {
                        return Promise.resolve()
                            .then(() =>
                                Reflect.apply(instance.onError, instance, [event, context, err])
                            )
                            .then((res) => ({ ...response, ...res }));
                    }
                    return response;
                } else {
                    return Promise.reject(err);
                }
            });
    };
    handler.lambdaClass = token;
    return handler;
}
