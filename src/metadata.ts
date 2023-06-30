import { Type } from './interfaces';
import { Lambda, Service } from './decorators';

/**
 * Helper to extract Metadata
 * from a decorator
 *
 * @todo Filter with the right type
 * @param  {any} type
 * @returns any
 */
export function extractMetadata(type: any): any {
    return extractMetadataList(type).pop();
}

/**
 * Helper to extract Metadata from a Service decorator.
 * It extract providers recursively and remove duplicates.
 *
 * @param type A service class
 *
 * @returns A decoratorFactory with providers of all sub services
 */
export function extractMetadataFromService(type: Type<any>): Service {
    const decoratorFactory = extractMetadataByDecorator<Service>(type, 'Service');

    if (decoratorFactory?.providers?.length) {
        const recursiveProviders = decoratorFactory?.providers
            ?.filter(Boolean)
            ?.map((e: Type<any>) => extractMetadataFromService(e)?.providers)
            .filter(Boolean)
            .reduce((acc, val) => [...acc, ...val], []);

        if (recursiveProviders?.length) {
            decoratorFactory.providers = [
                ...new Set([...decoratorFactory.providers, ...recursiveProviders])
            ];
        }
    }

    return decoratorFactory;
}

/**
 * Helper to extract Metadata from a Lambda decorator.
 *
 * @param type A Lambda class
 *
 * @returns A decoratorFactory with all providers
 */
export function extractMetadataFromLambda(type: Type<any>): Lambda {
    const decoratorFactory = extractMetadataByDecorator<Lambda>(type, 'Lambda');
    const serviceProviders = decoratorFactory?.providers
        ?.map((e: Type<any>) => extractMetadataFromService(e)?.providers)
        .filter(Boolean)
        .reduce((acc, val) => [...acc, ...val], []);

    if (decoratorFactory?.providers?.length && serviceProviders?.length) {
        decoratorFactory.providers = [
            ...new Set([...serviceProviders, ...decoratorFactory.providers])
        ];
    }

    return decoratorFactory;
}

/**
 * Helper to extract Metadata
 * with the decorator name provided
 *
 * @param  {any} type
 * @param  {string} name
 */
export function extractMetadataByDecorator<T>(type: Type<any>, name: string): T {
    return extractMetadataList(type)
        .filter((x) => x.toString().slice(1) === name)
        .map((x) => <T>x)
        .pop();
}

/**
 * Helper to extract Metadata
 * from a decorator
 *
 * @todo Filter with the right type
 * @param  {any} decorator
 * @returns []
 */
export function extractMetadataList(decorator: any, key?: string): any[] {
    return (
        Reflect.getOwnMetadataKeys(decorator)
            .filter((x) => x === (!!key ? 'propMetadata' : 'annotations'))
            .map((x) => Reflect.getOwnMetadata(x, decorator))
            .map((x) => [].concat(!!key && x.hasOwnProperty(key) ? x[key] : x))
            .pop() || []
    ).filter(
        (item) =>
            item.constructor.name === 'DecoratorFactory' ||
            item.constructor.name === 'PropDecoratorFactory'
    );
}
