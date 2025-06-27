import { toJsonSchema } from "@standard-community/standard-json";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { convertToOpenAPISchema } from "./convert.js";
import { vendorHooks } from "./vendors/index.js";

/**
 * Converts a Standard Schema to a OpenAPI schema.
 */
export const toOpenAPISchema = async (
  schema: StandardSchemaV1,
  options?: Record<string, unknown>,
) => {
  let jsonSchema = await toJsonSchema(schema, options);

  const hook = vendorHooks[schema["~standard"].vendor];

  if (hook) jsonSchema = hook(schema, jsonSchema);

  // Convert JSON Schema to OpenAPI schema
  return convertToOpenAPISchema(jsonSchema);
};
