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
| Effect Schema | 🛠️ |

You can check the compatibility versions at [standardschema.dev](https://standardschema.dev/)
