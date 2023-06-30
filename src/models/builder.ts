import {
    MOLD,
    TYPE,
    REQUIRED,
    NULLABLE,
    MIN,
    MAX,
    PATTERN,
    ITEM,
    ENUM,
    PARENT,
    RECORD,
    DESCRIPTION,
    CUSTOM_ERROR,
    CUSTOM_SCHEMA,
    TRIM,
    TO_LOWERCASE,
    TO_UPPERCASE
} from './constants';

const toArray = <T>(val: T): T[] => [].concat(val).filter(Boolean);

/**
 * type
 *
 * Get JSON Schema type value
 *
 * @param value
 */
function type(value: any, additional = false): Record<string, any> {
    switch (value) {
        case Number:
            return { type: 'number' };
        case String:
            return { type: 'string' };
        case Boolean:
            return { type: 'boolean' };
        case Array:
            return { type: 'array' };
        case undefined:
            return { type: 'null' };
        default:
            if (hasMetadata(value)) {
                return extractSchema(value, additional);
            }
            if (typeof value === 'object' && value.args && value.type) {
                return {
                    type: 'object',
                    additionalProperties: false,
                    properties: Object.keys((value.args as [] || [])
                        .filter(a => typeof a === 'function')
                        .map(v => type(v))
                        .reduce((a, c: any) => ({ ...a, ...c.properties}), {})).reduce((a, c) => ({ ...a, [c]: {} }), {}),
                    [value.type]: value.args.map((va: any) => type(va, true))
                };
            }
            return { type: 'object' };
    }
}

/**
 * min
 *
 * Get JSON Schema min value depending of the data type
 *
 * @param value
 * @param typeValue
 */
function min(value: number, typeValue: any): Record<string, any> {
    switch (typeValue) {
        case Number:
            return { minimum: value };
        case String:
            return { minLength: value };
        case Array:
            return { minItems: value };
    }
}

/**
 * max
 *
 * Get JSON Schema max value depending of the data type
 *
 * @param value
 * @param typeValue
 */
function max(value: number, typeValue: any): Record<string, any> {
    switch (typeValue) {
        case Number:
            return { maximum: value };
        case String:
            return { maxLength: value };
        case Array:
            return { maxItems: value };
    }
}

/**
 * pattern
 *
 * Get JSON Schema pattern value
 *
 * @param value
 * @param typeValue
 */
function pattern(value: string, typeValue: any): Record<string, any> {
    switch (typeValue) {
        case String:
            return { pattern: value };
    }
}

/**
 * record
 *
 * Allows to specify
 *
 * @param value
 * @param typeValue
 */
function record(value: any, typeValue: any): Record<string, any> {
    switch (typeValue) {
        case Object:
            return { additionalProperties: type(value) };
    }
}

function nullable(t: any, value: any): Record<string, any> {
    return { type: ['null', typeof t === 'string' ? t : type(t).type] };
}

/**
 * item
 *
 * Get JSON Schema item value
 *
 * @param value
 * @param typeValue
 */
function item(value: any, typeValue: any): Record<string, any> {
    switch (typeValue) {
        case Array:
            return { items: type(value) };
    }
}

/**
 * enum
 *
 * Get JSON Schema enum values
 * for type string
 *
 * @param value
 * @param typeValue
 */
function enumMapper(value: any, typeValue: any): Record<string, any> {
    switch (typeValue) {
        case String:
            return { enum: toArray(value) };
    }
}

/**
 * description
 *
 * Add description
 *
 * @param value
 */
function description(value: any): Record<string, any> {
    return { description: value };
}

/**
 * buildProperty
 *
 * Build the JSON Schema value for a class property's rule
 *
 * Example:
 *
 * class Account {
 *      @Min(0)
 *      @Max(9999)
 *      balance: integer
 * }
 *
 * Each rule will be processed by this function:
 * buildProperty('balance', TYPE, Number, Account);
 * buildProperty('balance', MIN, 0, Account);
 * buildProperty('balance', MAX, 9999, Account);
 *
 * As a result:
 * { type: 'number' }
 * { minimum: 0 }
 * { maximum: 9999 }
 *
 * @param propertyKey
 * @param rule
 * @param value
 * @param target
 */
function buildProperty(
    propertyKey: string,
    rule: string,
    value: any,
    target: Function[]
): Record<string, any> {
    const typeValue = ruleValue(TYPE, target, propertyKey);
    switch (rule) {
        case TYPE:
            return type(value);
        case MIN:
            return min(value, typeValue);
        case MAX:
            return max(value, typeValue);
        case PATTERN:
            return pattern(value, typeValue);
        case ITEM:
            return item(value, typeValue);
        case ENUM:
            return enumMapper(value, typeValue);
        case RECORD:
            return record(value, typeValue);
        case NULLABLE:
            return nullable(value, typeValue);
        case DESCRIPTION:
            return description(value);
        case TRIM:
            return { transform: ['trim'] };
        case TO_LOWERCASE:
            return { transform: ['toLowerCase'] };
        case TO_UPPERCASE:
            return { transform: ['toUpperCase'] };
    }
}

/**
 * hasMetadata
 *
 * Check if the class provided has Molder metadata.
 *
 * @param target
 */
export function hasMetadata(target: Function): boolean {
    return !!Reflect.getMetadata(MOLD, target);
}

/**
 * Extract and merge metadata for a list of target
 *
 * @param target
 */
function extractMetadata(target: Function[]): Record<string, any> {
    return toArray(target)
        .map((f) => Reflect.getOwnMetadata(MOLD, f) || {})
        .reduce((acc, cur) => ({ ...acc, ...cur }), {});
}

/**
 * requiredProperties
 *
 * Get the required property key list of a class
 *
 * @param target
 */
function requiredProperties(target: Function[]): string[] {
    const metadata = extractMetadata(target);
    return Object.keys(metadata).filter((key) => ruleValue(REQUIRED, target, key));
}

/**
 * rulesByProperty
 *
 * Get the rules for a class property
 *
 * @param target
 * @param propertyKey
 */
function rulesByProperty(target: Function[], propertyKey: string): [string, any][] {
    const metadata = extractMetadata(target);
    const rules = metadata[propertyKey] || {};
    return Object.entries(rules);
}

/**
 * transform
 *
 * Return a schema for a key that transform the input first, then validate
 */
function transform(validators: Record<string, any>, transformations: string[]): Record<string, any> {
    if (validators.type === 'string') {
        return {
            allOf: [{ transform: transformations }, validators]
        }
    } else if (validators.type === 'array' && validators.items?.type === 'string') {
        return {
            ...validators,
            items: { allOf: [{ transform: transformations }, validators.items] }
        }
    }

    return validators
}

/**
 * buildProperties
 *
 * Build by merging all the JSON Schema values
 * into one object per property
 *
 * @param target
 */
function buildProperties(target: Function[]): Record<string, any> {
    return properties(target)
        .map((key) => {
            const propRules = rulesByProperty(target, key)
                .map(([rule, value]) => buildProperty(key, rule, value, target));
            const transformations = propRules
                .filter(propRule => propRule?.transform)
                .reduce((acc, cur) => acc.concat(cur.transform), []);
            const validators = propRules
                .filter(propRule => !propRule?.transform)
                .reduce((acc, cur) => ({ ...acc, ...cur }), {});

            if (transformations?.length) {
                return { [key]: transform(validators, transformations) }
            }

            return { [key]: validators };
        })
        .reduce((acc, cur) => ({ ...acc, ...cur }), {});
}

/**
 *
 */
function buildErrorMessage(target: Function[]): Record<string, Record<string, string>> {
    return {
        properties: properties(target)
            .map((key) => [key, ruleValue(CUSTOM_ERROR, target, key)])
            .reduce(
                (acc, [key, message]) => (message === undefined ? acc : { ...acc, [key]: message }),
                {}
            )
    };
}

/**
 * Extract the parent list for a token
 *
 * @param token
 */
function extractParent(token: Function): Function[] {
    const parent = Reflect.getOwnMetadata(PARENT, token);
    if (parent) {
        return [].concat(parent, extractParent(parent)).filter(Boolean);
    }
}

/**
 * properties
 *
 * Get the property key list of a class
 *
 * @param target
 */
export function properties(target: Function[]): string[] {
    const metadata = extractMetadata(target);
    return Object.keys(metadata);
}

/**
 * extractSchema
 *
 * Use all the stored rules in metadata
 * to build a JSON Schema with inheritance
 *
 * @param target
 */
export function extractSchema(target: Function, additional = false): Record<string, any> {
    const customSchema = Reflect.getOwnMetadata(CUSTOM_SCHEMA, target);
    if (customSchema) {
        return customSchema;
    }
    const tokens = toArray(target).concat(...toArray(extractParent(target)));
    const req = requiredProperties(tokens) || [];
    return {
        title: target.name,
        description: Reflect.getOwnMetadata(DESCRIPTION, target),
        type: 'object',
        properties: buildProperties(tokens),
        required: req.length ? req : undefined,
        additionalProperties: additional,
        errorMessage: buildErrorMessage(tokens)
    };
}

/**
 * ruleValue
 *
 * Get the rule value for provided class and property.
 *
 * @param rule
 * @param target
 * @param propertyKey
 */
export function ruleValue(rule: string, target: Function[], propertyKey?: string): any {
    const metadata = extractMetadata(target);
    const rules = metadata[propertyKey] || {};
    return rules[rule];
}
