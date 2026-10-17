import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { convertToOpenAPISchema } from "~/vendors/convert.js";

describe("contentSchema", () => {
  it("converts references and hoists definitions inside contentSchema", () => {
    const components: OpenAPIV3_1.ComponentsObject = {};
    const jsonSchema = {
      type: "string",
      contentMediaType: "application/json",
      contentSchema: { $ref: "#/$defs/Value" },
      $defs: { Value: { type: "integer" } },
    };

    expect(
      convertToOpenAPISchema(jsonSchema as JSONSchema7, { components }),
    ).toEqual({
      type: "string",
      contentMediaType: "application/json",
      contentSchema: { $ref: "#/components/schemas/Value" },
    });
    expect(components.schemas).toEqual({ Value: { type: "integer" } });
  });

  it.each([true, false])(
    "preserves boolean contentSchema %s",
    (contentSchema) => {
      const schema = { type: "string", contentSchema };
      expect(
        convertToOpenAPISchema(schema as JSONSchema7, { components: {} }),
      ).toEqual(schema);
    },
  );
});
