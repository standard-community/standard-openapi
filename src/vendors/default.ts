import { toJsonSchema } from "@standard-community/standard-json";
import { convertToOpenAPISchema } from "./convert.js";
import type { ToOpenAPISchemaFn } from "./utils.js";

export default async function getToOpenAPISchemaFn(): Promise<
  ToOpenAPISchemaFn
> {
  return async (schema, context) =>
    convertToOpenAPISchema(
      await toJsonSchema(schema, context.options),
      context,
    );
}
