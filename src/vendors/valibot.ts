import { toJsonSchema } from "@standard-community/standard-json";
import type { ConversionConfig } from "@valibot/to-json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import { convertToOpenAPISchema } from "./convert.js";
import type { OpenAPIMetadata, ToOpenAPISchemaFn } from "./utils.js";

export default function getToOpenAPISchemaFn(): ToOpenAPISchemaFn {
  return (schema, context) =>
    toJsonSchema(schema, {
      // @ts-expect-error
      overrideAction: ({ valibotAction, jsonSchema }) => {
        const _jsonSchema = convertToOpenAPISchema(jsonSchema, context);
        if (
          valibotAction.kind === "metadata" &&
          valibotAction.type === "metadata" &&
          !("$ref" in _jsonSchema)
        ) {
          // @ts-expect-error
          const metadata = valibotAction.metadata as OpenAPIMetadata;

          // Add example or examples to the JSON Schema
          if (metadata.example !== undefined) {
            _jsonSchema.example = metadata.example;
          }
          if (metadata.examples && metadata.examples.length > 0) {
            _jsonSchema.examples = metadata.examples;
          }

          // If a ref is provided, use it to create a $ref in the OpenAPI components
          if (metadata.ref) {
            context.components.schemas = {
              ...context.components.schemas,
              [metadata.ref]: _jsonSchema,
            };
            return {
              $ref: `#/components/schemas/${metadata.ref}`,
            };
          }
        }

        return _jsonSchema;
      },
      ...context.options,
    } satisfies ConversionConfig) as OpenAPIV3_1.SchemaObject;
}
