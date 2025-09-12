import type { StandardSchemaV1 } from "@standard-schema/spec";
import { quansync } from "quansync";
import { getToOpenAPISchemaFn } from "./vendors/index.js";
import {
  errorMessageWrapper,
  openapiVendorMap,
  type ToOpenAPISchemaContext,
  type ToOpenAPISchemaFn,
} from "./vendors/utils.js";

/**
 * Converts a Standard Schema to a OpenAPI schema.
 */
export const toOpenAPISchema = quansync({
  sync: (
    schema: StandardSchemaV1,
    context: Partial<ToOpenAPISchemaContext> = {},
  ) => {
    const fn = openapiVendorMap.get(schema["~standard"].vendor);

    if (!fn) {
      throw new Error(
        errorMessageWrapper(
          `Unsupported schema vendor "${schema["~standard"].vendor}".`,
        ),
      );
    }

    const { components = {}, options } = context;
    const _schema = fn(schema, { components, options });

    // Convert JSON Schema to OpenAPI schema
    return {
      schema: _schema,
      components: Object.keys(components).length > 0 ? components : undefined,
    };
  },
  async: async (
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
  },
});

export function loadVendor(vendor: string, fn: ToOpenAPISchemaFn) {
  openapiVendorMap.set(vendor, fn);
}
