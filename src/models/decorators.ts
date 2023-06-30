/* eslint-disable @typescript-eslint/explicit-function-return-type */
import 'reflect-metadata';
import {
    PARENT,
    TYPE,
    MOLD,
    MAX,
    MIN,
    REQUIRED,
    PATTERN,
    ITEM,
    ENUM,
    RECORD,
    DESCRIPTION,
    NULLABLE,
    CUSTOM_ERROR,
    CUSTOM_SCHEMA,
    TRIM,
    TO_LOWERCASE,
    TO_UPPERCASE
} from './constants';
import { JSONSchema7Definition } from 'json-schema';
import { Molder } from './mold';

/**
 * defineTypeMetadata
 *
 * Add the type rule for a property key if
 * it doesn't exist only
 *
 * @param target
 * @param key
 */
function defineTypeMetadata(target: any, key: string): void {
    const metadata = Reflect.getOwnMetadata(MOLD, target.constructor) || {};
    if (metadata[key] && metadata[key][TYPE]) {
        return;
    }
    addRule(target.constructor, key, TYPE, Reflect.getMetadata('design:type', target, key));
}

/**
 * addRule
 *
 * Add a new rule for a property by
 * extracting the mold metadata from the target and inserting
 * the value in the property key object
 *
 * Example:
 *
 * new rule for key1: max 100
 * Extract: { key1: { [symbol('mold:min')]: 0 } }
 * Append:  { [symbol('mold:max')]: 100 }
 * Save: { key1: { [symbol('mold:min')]: 0 }, { [symbol('mold:max')]: 100 } }
 *
 * @param target
 * @param propertyKey
 * @param rule
 * @param value
 */
function addRule(target: Function, propertyKey: string, rule: string, value: any): void {
    if (!propertyKey) {
        Reflect.defineMetadata(rule, value, target);
        return;
    }
    const metadata = Reflect.getOwnMetadata(MOLD, target) || {};
    const rules = metadata[propertyKey] || {};
    metadata[propertyKey] = { ...rules, [rule]: value };
    Reflect.defineMetadata(MOLD, metadata, target);
}

/**
 * Add a parent to inherits rules
 *
 * @param parent
 */
function extendRules(parent: Function) {
    return (target: Function): void => {
        Reflect.defineMetadata(PARENT, parent, target);
    };
}

function customSchema(schema: JSONSchema7Definition) {
    return (token: Function): void => {
        Reflect.defineMetadata(CUSTOM_SCHEMA, schema, token);
        Reflect.defineMetadata(MOLD, {}, token);
    };
}

/**
 * Create a decorator without argument
 * Example: @Simple
 *
 * @param rule
 */
export const withoutArg = (rule?: string) => {
    return (target: any, key: string): void => {
        defineTypeMetadata(target, key);
        if (rule) {
            addRule(target.constructor, key, rule, true);
        }
    };
};

/**
 * Create a decorator with one argument
 * Example: @Min(1)
 *
 * @param rule
 */
export const with1Arg =
    <T>(rule: string) =>
    (value: T) => {
        return (target: any, key: string): void => {
            defineTypeMetadata(target, key);
            addRule(target.constructor, key, rule, value);
        };
    };

/**
 * Create a decorator with N arguments
 * Example: @Enum('a', 'b', ...)
 *
 * @param rule
 */
export const withNArg =
    <T>(rule: string) =>
    (...values: T[]) => {
        return (target: any, key: string): void => {
            defineTypeMetadata(target, key);
            addRule(target.constructor, key, rule, values);
        };
    };

export const ExtendRules = extendRules;
export const Simple = withoutArg();
export const Required = withoutArg(REQUIRED);
export const Nullable = with1Arg<any>(NULLABLE);
export const Max = with1Arg<number>(MAX);
export const Min = with1Arg<number>(MIN);
export const Pattern = with1Arg<string>(PATTERN);
export const Item = with1Arg<any>(ITEM);
export const Enum = withNArg<string>(ENUM);
export const Record = with1Arg<any>(RECORD);
export const Description = with1Arg<string>(DESCRIPTION);
export const CustomError = with1Arg<string>(CUSTOM_ERROR);
export const CustomSchema = customSchema;

export const OneOf = (...args: Function[]) => ({ args, type: 'oneOf' });
export const AnyOf = (...args: Function[]) => ({ args, type: 'anyOf' });
export const AllOf = (...args: Function[]) => ({ args, type: 'allOf' });

export const Model = (description: string) => (target: Function) =>
    addRule(target, null, DESCRIPTION, description);

@CustomSchema({ type: 'object', additionalProperties: true })
export class Any {}

/** Compile and cache the schema in metadata during provisioned concurrency initialization */
export const Precompile =
    () =>
    (target: Function): void =>
        process.env.AWS_LAMBDA_INITIALIZATION_TYPE === 'provisioned-concurrency'
            ? Molder.getCompiledSchema(target) && undefined
            : undefined;

export const Trim = withoutArg(TRIM);
export const ToLowerCase = withoutArg(TO_LOWERCASE);
export const ToUpperCase = withoutArg(TO_UPPERCASE);
