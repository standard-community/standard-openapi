import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { OpenAPIV3_1 } from "openapi-types";

export type OpenAPIMetadata = {
  ref?: string;
  example?: unknown;
  examples?: [unknown, ...unknown[]];
};

export type ToOpenAPISchemaContext = {
  components: OpenAPIV3_1.ComponentsObject;
  options?: Record<string, unknown>;
};

export type ToOpenAPISchemaFn = (
  schema: StandardSchemaV1,
  context: ToOpenAPISchemaContext,
) => OpenAPIV3_1.SchemaObject | Promise<OpenAPIV3_1.SchemaObject>;

export const errorMessageWrapper = (message: string) =>
  `standard-openapi: ${message}`;

export const openapiVendorMap = new Map<string, ToOpenAPISchemaFn>();
