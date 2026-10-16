import type { OpenAPIV3_1 } from "openapi-types";
import type { ZodTypeAny } from "zod/v3";
import type { $ZodType } from "zod/v4/core";
import getDefaultToOpenAPISchemaFn from "./default.js";
import { errorMessageWrapper, type ToOpenAPISchemaFn } from "./utils.js";

export default function getToOpenAPISchemaFn(): ToOpenAPISchemaFn {
  return async (schema, context) => {
    // https://zod.dev/library-authors?id=how-to-support-zod-and-zod-mini-simultaneously#how-to-support-zod-3-and-zod-4-simultaneously
    if ("_zod" in (schema as $ZodType | ZodTypeAny)) {
      return getDefaultToOpenAPISchemaFn()(schema, {
        components: context.components,
        options: { io: "input", ...context.options },
      });
    }

    const { createSchema } = await import("zod-openapi").catch(() => {
      throw new Error(
        errorMessageWrapper(`Missing dependencies "zod-openapi v4".`),
      );
    });

    const { schema: _schema, components } = createSchema(
      // @ts-expect-error
      schema,
      { schemaType: "input", ...context.options },
    );

    if (components) {
      // @ts-expect-error
      context.components.schemas = {
        ...context.components.schemas,
        ...components,
      };
    }

    return _schema as OpenAPIV3_1.SchemaObject;
  };
}
