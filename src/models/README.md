# Models

Allows to use Typescript features to generates JSON Schema to validate data with models.
Use internally `ajv` to validate.

## Decorators

## note about default value

all decorators support provided default value

```ts
class MyModel {
    @Simple foo: string = 'bar';
}

Molder.instantiate(MyModel, {}) === { foo: 'bar' };
```

## `@Simple`

Default decorator if you dont have any validation except the type

```ts
class MyModel {
    @Simple foo: string;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "foo": {
            "type": "string"
        }
    },
    "additionalProperties": false
}
```

## `@Required`

Required validation rule

```ts
class MyModel {
    @Required foo: string;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "foo": {
            "type": "string"
        }
    },
    "required": ["foo"],
    "additionalProperties": false
}
```

## `@Nullable`

allow a value to be null

```ts
class MyModel {
    @Nullable(String) foo: string | null;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "foo": {
            "type": ["string", "null"]
        }
    },
    "additionalProperties": false
}
```

## `@Description`

Add a description to the property

```ts
class MyModel {
    @Description('Foo property') foo: string;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "foo": {
            "description": "Foo property",
            "type": "string"
        }
    },
    "additionalProperties": false
}
```

## `@Max`

Max validation for `number`, `string`, `array` types
Respectively use JSON Schema rules:

-   `{ maximum: value }`
-   `{ maxLength: value }`
-   `{ maxItems: value }`

```ts
class MyModel {
    @Max(3) foo: number;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "foo": {
            "type": "number",
            "maximum": 3
        }
    },
    "additionalProperties": false
}
```

## `@Min`

Min validation for `number`, `string`, `array` types
Respectively use JSON Schema rules:

-   `{ minimum: value }`
-   `{ minLength: value }`
-   `{ minItems: value }`

```ts
class MyModel {
    @Min(0) foo: number;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "foo": {
            "type": "number",
            "minimum": 0
        }
    },
    "additionalProperties": false
}
```

## `@Pattern`

Regex validation for `string`

```ts
class MyModel {
    @Pattern('^\\w+$') foo: number;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "foo": {
            "type": "string",
            "pattern": "^\\w+$"
        }
    },
    "additionalProperties": false
}
```

## `@Item`

Specify the item type for an array, unfortunatly, typescript doesn't provide the type of an array item.

```ts
class MyModel {
    @Item(Number) foo: number[];
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "foo": {
            "type": "array",
            "items": {
                "type": "number"
            }
        }
    },
    "additionalProperties": false
}
```

## `@Enum`

Specify a list of values allowed for `string`

```ts
class MyModel {
    @Enum('a', 'b', 'c') foo: string;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "foo": {
            "type": "string",
            "enum": ["a", "b", "c"]
        }
    },
    "additionalProperties": false
}
```

## `@Record`

Allows custom properties with value validation

```ts
class MyModel {
    @Record(String) foo: Record<string, string>;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {},
    "additionalProperties": {
        "type": "string"
    }
}
```

## `@Custom_Error`

Allows custom error message to be returned in case of unvalid data

```ts
class MyModel {
    @CustomError('your name must be valid') name: string;
}

Molder.validate(MyModel, {});

// will throw : 'error while validating MyModel: data/name your name must be valid'
```

## Nested Models

If you want to validate nested object, you need to define a new class. Works also with `@Item`

```ts
class Hello {
    @Required world: string;
}

class MyModel {
    @Simple id: string;
    @Required nested: Hello;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "id": {
            "type": "string"
        },
        "nested": {
            "title": "Hello",
            "type": "object",
            "properties": {
                "world": {
                    "type": "string"
                }
            },
            "required": ["world"],
            "additionalProperties": false
        }
    },
    "required": ["nested"],
    "additionalProperties": false
}
```

## Inheritance

If you want your model to extends the rules of another model, use `@ExtendRules`

```ts
class Hello {
    @Required world: string;
}

@ExtendRules(Hello)
class MyModel extends Hello {
    @Simple id: string;
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "id": {
            "type": "string"
        },
        "world": {
            "type": "string"
        }
    },
    "required": ["world"],
    "additionalProperties": false
}
```

## `@Model`

Provide a way to add a global description to the model

```ts
@Model('Global description')
class MyModel {
    @Simple foo: string;
}
```

## `@CustomSchema`

use the given schema to validate the decorated Class instead of using the attributes.

```ts
import { CustomSchema } from './decorators';

// either a or b, but not both
@CustomSchema({
    properties: {
        a: { type: 'string' },
        b: { type: 'number' }
    },
    allOf: [
        { oneOf: [{ required: ['a'] }, { required: ['b'] }] },
        {
            not: { required: ['a', 'b'] }
        }
    ],
    additionalProperties: false
})
class Either {
    a: string;
    b: number;
}
```

## `class Any`

the special model `Any` will bypass molder validation via a custom schema with additionalProperties = true

## AnyOf, AllOf, OneOf

If you need to specify different types in array, you can do:

```ts
@Item(AnyOf(Schema1, Schema2)) props: (Schema1 | Schema2)[];
```

## Transformations: `@Trim`, `@ToLowerCase`, `@ToUpperCase`

Transform data **before** validation.
Works on `string` and `string[]` (for `string[]`, `@Item(String)` must be used).

```js
class MyModel {
    @Required @Trim @ToLowerCase hello: string;
    @Required @Trim @ToLowerCase @Item(String) world: string[];
}
```

Generates the JSON Schema:

```json
{
    "title": "MyModel",
    "type": "object",
    "properties": {
        "hello": {
            "allOf": [
                { "transform": ["toLowerCase", "trim"] },
                { "type": "string" }
            ]
        },
        "world": {
            "type": "array",
            "items": {
                "allOf": [
                    { "transform": ["toLowerCase", "trim"] },
                    { "type": "string" }
                ]
            }
        }
    },
    "required": ["hello", "world"],
    "additionalProperties": false
}
```

Note: `allOf` is used to transform data **before** validation, otherwise `@Min(1)` could pass on `'   '` and then transform to `''`

## Molder utils

-   `Molder.validate(<model>, <payload>)`: Validate the payload with `ajv`
-   `Molder.instantiate(<model>, <payload>)`: Validate and instantiate the class model with properties populated from the payload
-   `Molder.jsonSchema(<model>)`: Return the JSON Schema of the model
