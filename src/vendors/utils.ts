import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { OpenAPIV3_1 } from "openapi-types";

export type OpenAPIMetadata = {
  ref?: string;
  example?: unknown;
  examples?: [unknown, ...unknown[]];
};

export type ToOpenAPISchemaContext = {
  components: OpenAPIV3_1.ComponentsObject;
  /**
   * Whether to describe what a schema accepts or what it outputs, which differ
   * for one that transforms or defaults its input. Defaults to `"input"`.
   */
  io?: "input" | "output";
  options?: Record<string, unknown>;
};

/** A named schema converts to a reference to its component. */
export type SchemaOrReference =
  | OpenAPIV3_1.SchemaObject
  | OpenAPIV3_1.ReferenceObject;

export type ToOpenAPISchemaFn = (
  schema: StandardSchemaV1,
  context: ToOpenAPISchemaContext,
) => SchemaOrReference | Promise<SchemaOrReference>;

/**
 * A JSON Pointer token as the name it stands for: `~1` is `/` and `~0` is `~`,
 * unescaped in that order so `~01` stays `~1`.
 */
export const unescapeToken = (token: string) =>
  token.replaceAll("~1", "/").replaceAll("~0", "~");

/**
 * The `$ref` to the component `name`. A `$ref` is a JSON Pointer, so `~` in the
 * name is escaped as `~0` and `/` as `~1`, or a name like `pets/Pet` would
 * point at `schemas.pets.Pet`.
 */
export const componentReference = (name: string) =>
  `#/components/schemas/${name.replaceAll("~", "~0").replaceAll("/", "~1")}`;

export const errorMessageWrapper = (message: string) =>
  `standard-openapi: ${message}`;

export const openapiVendorMap = new Map<string, ToOpenAPISchemaFn>();
