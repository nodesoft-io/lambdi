import { Inject, InjectionToken, makeDecorator, Optional, TypeDecorator } from 'injection-js';
import { Provider, Type } from './interfaces';
import { Required, Simple } from './models';

export { Inject, Optional, InjectionToken };

/**
 * Decorator signature
 */
export interface CoreDecorator<T> {
    (obj?: T): TypeDecorator;

    new (obj?: T): T;
}

/**
 * Create a decorator with metadata
 *
 * @param  {string} name
 * @param  {{[name:string]:any;}} props?
 * @returns CoreDecorator
 */
function createDecorator<T>(name: string, props?: { [name: string]: any }): CoreDecorator<T> {
    return <CoreDecorator<T>>makeDecorator(name, props);
}

/**
 * Lambda decorator.
 *
 * @Annotation
 */
export interface Lambda {
    providers?: (Type<any> | Provider)[];
    partialBatchFailure?: boolean;
    /**
     * For OpenApi swagger.
     * A short summary of what the operation does.
     */
    summary?: string;
    /**
     * For OpenApi swagger.
     * A verbose explanation of the operation behavior. CommonMark syntax MAY be used for rich text representation.
     */
    description?: string;
    /**
     * List of cognito groups allowed to execute this lambda.
     * It is compared against a cognito authenticated user's token.
     * Do not use this without an authorizer for the lambda.
     */
    allowedGroups?: string[];
}

export const Lambda = createDecorator<Lambda>('Lambda', {
    providers: undefined,
    partialBatchFailure: undefined,
    summary: undefined,
    description: undefined,
    allowedGroups: undefined
});

/**
 * Service decorator.
 *
 * @Annotation
 */
export interface Service {
    providers?: (Type<any> | Provider)[];
}

export const Service = createDecorator<Service>('Service', {
    providers: undefined
});

/**
 * ##########################
 * API GATEWAY DECORATORS
 * ##########################
 */

class EkonooError {
    @Required message: string;
    @Simple code: string;
}

function ArgDecorator(meta: string) {
    return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
        const metadata = Reflect.getOwnMetadata('lambdi:args', target, propertyKey);
        Reflect.defineMetadata(
            'lambdi:args',
            { ...metadata, [meta]: parameterIndex },
            target,
            propertyKey
        );
    };
}

function SQSRecordDecorator(path?: string) {
    return (target: any, propertyKey: string, _: PropertyDescriptor) => {
        Reflect.defineMetadata('lambdi:sqs-record', { path }, target, propertyKey);
    };
}

function ResponseDecorator(responses: Type<any> | Record<number, Type<any>>) {
    return (target: any, propertyKey: string, _: PropertyDescriptor) => {
        const _responses = typeof responses === 'function' ? { 200: responses } : responses;
        Reflect.defineMetadata(
            'lambdi:responses',
            {
                '4XX': EkonooError,
                '5XX': EkonooError,
                ..._responses
            },
            target,
            propertyKey
        );
    };
}
function CorsDecorator(allowedOrigins: string) {
    return (target: any, propertyKey: string, _: PropertyDescriptor) => {
        Reflect.defineMetadata('lambdi:cors', allowedOrigins, target, propertyKey);
    };
}

export const Event = ArgDecorator('lambdi:event');
export const Ctx = ArgDecorator('lambdi:context');
export const PathParams = ArgDecorator('lambdi:pathparams');
export const QueryParams = ArgDecorator('lambdi:queryparams');
export const MultiQueryParams = ArgDecorator('lambdi:multiqueryparams');
export const Headers = ArgDecorator('lambdi:headers');
export const Payload = ArgDecorator('lambdi:payload');
export const ApiResponse = ResponseDecorator;
export const Cors = CorsDecorator;
export const SQSRecord = SQSRecordDecorator;
