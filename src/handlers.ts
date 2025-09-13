import type { StandardSchemaV1 } from "@standard-schema/spec";
import { getToOpenAPISchemaFn } from "./vendors/index.js";
import {
  openapiVendorMap,
  type ToOpenAPISchemaContext,
  type ToOpenAPISchemaFn,
} from "./vendors/utils.js";

/**
 * Converts a Standard Schema to a OpenAPI schema.
 */
export const toOpenAPISchema = async (
  schema: StandardSchemaV1,
  context: Partial<ToOpenAPISchemaContext> = {},
) => {
  const fn = await getToOpenAPISchemaFn(schema["~standard"].vendor);

  const { components = {}, options } = context;
  const _schema = await fn(schema, { components, options });

  // Convert JSON Schema to OpenAPI schema
  return {
    schema: _schema,
    components: Object.keys(components).length > 0 ? components : undefined,
  };
};

/**
 * Load vendor before calling toOpenAPISchema,
 * for imporving performance and adding support for unsupported vendors
 */
export function loadVendor(vendor: string, fn: ToOpenAPISchemaFn) {
  openapiVendorMap.set(vendor, fn);
}
