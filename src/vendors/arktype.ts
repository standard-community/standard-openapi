import { toJsonSchema } from "@standard-community/standard-json";
import type { JSONSchema7 } from "json-schema";
import { convertToOpenAPISchema } from "./convert.js";
import type { ToOpenAPISchemaFn } from "./utils.js";

export default function getToOpenAPISchemaFn(): ToOpenAPISchemaFn {
  return async (schema, context) => {
    const jsonSchema = await toJsonSchema(schema, {
      io: context.io ?? "input",
      ...context.options,
    });
    // arktype 3 writes only JSON Schema annotations and `x-` keys from a
    // Type's meta, so a `ref` configured on it is read from the Type itself.
    // arktype 2 already wrote it into the JSON Schema, where it's left as is.
    const { ref } = (schema as { meta?: { ref?: unknown } }).meta ?? {};
    return convertToOpenAPISchema(
      typeof ref === "string" && !("ref" in jsonSchema)
        ? ({ ...jsonSchema, ref } as JSONSchema7)
        : jsonSchema,
      context,
    );
  };
}
