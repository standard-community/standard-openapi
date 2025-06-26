# Standard OpenAPI

[![npm version](https://img.shields.io/npm/v/@standard-community/standard-openapi.svg)](https://npmjs.org/package/@standard-community/standard-openapi "View this project on NPM")
[![npm downloads](https://img.shields.io/npm/dm/@standard-community/standard-openapi)](https://www.npmjs.com/package/@standard-community/standard-openapi)
[![license](https://img.shields.io/npm/l/@standard-community/standard-openapi)](LICENSE)

Standard Schema Validator's OpenAPI Schema Converter

## Installation

Install the main package -

```sh
pnpm add @standard-community/standard-openapi
```

For some specific vendor, install the respective package also -

| Vendor  | Package |
| ------- | ------- |
| Zod     | `zod-openapi` |
| Valibot | `@standard-community/standard-json` `@valibot/to-json-schema` `json-schema-walker` |
| ArkType | `@standard-community/standard-json` `json-schema-walker` |
| Effect Schema | `@standard-community/standard-json` `json-schema-walker` |

## Usage

```ts
import { toOpenAPISchema } from "@standard-community/standard-openapi";

// Define your schema
const schema = v.pipe(
    v.object({
        myString: v.string(),
        myUnion: v.union([v.number(), v.boolean()]),
    }),
    v.description("My neat object schema"),
);

// Convert it to OpenAPI Schema
const openapiSchema = await toOpenAPISchema(schema);
```

## Compatibility

List of supported validators -

| Vendor  | Supported |
| ------- | ------- |
| Zod     | ✅ |
| Valibot | ✅ |
| ArkType | ✅ |
| Typebox | ✅ (Using [TypeMap](https://github.com/sinclairzx81/typemap) |
| Effect Schema | 🛠️ |

You can check the compatibility versions at [standardschema.dev](https://standardschema.dev/)
