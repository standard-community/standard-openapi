import { toJsonSchema } from "@standard-community/standard-json";
import type { ConversionConfig } from "@valibot/to-json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import { convertToOpenAPISchema } from "./convert.js";
import type { OpenAPIMetadata, ToOpenAPISchemaFn } from "./utils.js";

export default function getToOpenAPISchemaFn(): ToOpenAPISchemaFn {
  return async (schema, context) => {
    const { overrideAction, ...options }: ConversionConfig =
      context.options ?? {};

    const openapiSchema = await toJsonSchema(schema, {
      errorMode: "ignore",
      ...options,
      // @ts-expect-error
      overrideAction: (actionContext) => {
        // A caller's own override runs first, so what it returns gets the
        // same handling as the schema `valibot` writes by itself.
        const jsonSchema =
          overrideAction?.(actionContext) ?? actionContext.jsonSchema;
        const { valibotAction } = actionContext;
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
    } satisfies ConversionConfig);

    if ("$schema" in openapiSchema) {
      delete openapiSchema.$schema;
    }

    return openapiSchema as OpenAPIV3_1.SchemaObject;
  };
}
