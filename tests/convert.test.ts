import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { convertToOpenAPISchema } from "~/vendors/convert.js";

describe("convertToOpenAPISchema", () => {
  it.each([
    ["`/` escaped as `~1`", "alias/entry", "alias~1entry"],
    ["`~` escaped as `~0`", "alias~entry", "alias~0entry"],
    ["a literal `~1` escaped as `~01`", "alias~1entry", "alias~01entry"],
  ])("points a reference with %s at the named definition", (_, key, token) => {
    const components: OpenAPIV3_1.ComponentsObject = {};
    // `ref` names a schema the way vendors annotate one, outside JSON Schema.
    const jsonSchema: Record<string, unknown> = {
      $defs: { [key]: { ref: "Node", type: "string" } },
      properties: { node: { $ref: `#/$defs/${token}` } },
      type: "object",
    };

    const schema = convertToOpenAPISchema(jsonSchema as JSONSchema7, {
      components,
    });

    expect(schema).toEqual({
      properties: { node: { $ref: "#/components/schemas/Node" } },
      type: "object",
    });
    expect(components.schemas).toEqual({ Node: { type: "string" } });
  });

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
