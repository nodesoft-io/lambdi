export const MOLD = Symbol('design:mold');
export const SCHEMA = Symbol('design:schema');
export const PARENT = Symbol('design:parent');
export const TYPE = 'mold:type';
export const MAX = 'mold:max';
export const MIN = 'mold:min';
export const REQUIRED = 'mold:required';
export const NULLABLE = 'mold:nullable';
export const PATTERN = 'mold:pattern';
export const FORMAT = 'mold:format';
export const ITEM = 'mold:item';
export const ENUM = 'mold:enum';
export const RECORD = 'mold:record';
export const DESCRIPTION = 'mold:description';
export const CUSTOM_ERROR = 'mold:custom-error';
// SCHEMA is the compiled/cached schema, CUSTOM_SCHEMA is the raw schema
export const CUSTOM_SCHEMA = "mold:custom-schema";

// For transform
export const TRIM = 'mold:trim';
export const TO_LOWERCASE = 'mold:to-lowercase';
export const TO_UPPERCASE = 'mold:to-uppercase';
