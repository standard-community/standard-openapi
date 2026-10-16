import type { JSONSchema7 } from "json-schema";
import { describe, expect, it } from "vitest";

import { convertToOpenAPISchema } from "~/vendors/convert.js";

describe("convertToOpenAPISchema", () => {
  // The JSON Schema draft 7 types don't know the 2020-12 keywords.
  it.each<[string, Record<string, unknown>]>([
    ["tuple elements", { prefixItems: [true, false], type: "array" }],
    [
      "dependent schemas",
      { dependentSchemas: { blocked: false, open: true }, type: "object" },
    ],
    ["properties", { properties: { anything: true }, type: "object" }],
    ["union members", { anyOf: [true, { type: "string" }] }],
  ])("leaves boolean schemas among %s as they are", (_, jsonSchema) => {
    expect(
      convertToOpenAPISchema(jsonSchema as JSONSchema7, { components: {} }),
    ).toEqual(jsonSchema);
  });
});
