import { toJsonSchema } from "@standard-community/standard-json";
import type { OpenAPIV3_1 } from "openapi-types";
import type { ZodTypeAny } from "zod/v3";
import type { $ZodType } from "zod/v4/core";
import { convertToOpenAPISchema } from "./convert.js";
import { errorMessageWrapper, type ToOpenAPISchemaFn } from "./utils.js";

export default async function getToOpenAPISchemaFn(): Promise<
  ToOpenAPISchemaFn
> {
  return async (schema, context) => {
    // https://zod.dev/library-authors?id=how-to-support-zod-and-zod-mini-simultaneously#how-to-support-zod-3-and-zod-4-simultaneously
    if ("_zod" in (schema as $ZodType | ZodTypeAny)) {
      return convertToOpenAPISchema(
        await toJsonSchema(schema, context.options),
        context,
      );
    }

    try {
      const { createSchema } = await import("zod-openapi");
      const { schema: _schema, components } = createSchema(
        // @ts-expect-error
        schema,
        context.options,
      );

      if (components) {
        // @ts-expect-error
        context.components.schemas = {
          ...context.components.schemas,
          ...components,
        };
      }

      return _schema as OpenAPIV3_1.SchemaObject;
    } catch {
      throw new Error(
        errorMessageWrapper(`Missing dependencies "zod-openapi v4".`),
      );
    }
  };
}
