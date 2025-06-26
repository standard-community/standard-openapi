import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { JSONSchema7 } from "json-schema";

export const vendorHooks: Record<
  string,
  | ((schema: StandardSchemaV1, jsonSchema: JSONSchema7) => JSONSchema7)
  | undefined
> = {};
