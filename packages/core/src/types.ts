import type { StandardSchemaV1 } from "@standard-schema/spec";

export type GeneratorFn = (
  schema: StandardSchemaV1,
  metadata?: Record<string, unknown>,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

export type Handler = Promise<{
  generator: GeneratorFn;
}>;
