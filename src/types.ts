import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { SchemaResult } from "zod-openapi";

export type GeneratorFn = (
  schema: StandardSchemaV1,
  metadata?: Record<string, unknown>,
) => SchemaResult | Promise<SchemaResult>;

export type Handler = Promise<{
  generator: GeneratorFn;
}>;
