import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { OpenAPIV3_1 } from "openapi-types";
import { getToOpenAPISchemaFn } from "./vendors/index.js";

/**
 * Converts a Standard Schema to a OpenAPI schema.
 */
export const toOpenAPISchema = async (
  schema: StandardSchemaV1,
  options?: Record<string, unknown>,
) => {
  const components: OpenAPIV3_1.ComponentsObject = {};
  const _schema = await getToOpenAPISchemaFn(schema["~standard"].vendor).then(
    (toOpenAPISchemaFn) => toOpenAPISchemaFn(schema, { components, options }),
  );

  // Convert JSON Schema to OpenAPI schema
  return {
    schema: _schema,
    components: Object.keys(components).length > 0 ? components : undefined,
  };
};
