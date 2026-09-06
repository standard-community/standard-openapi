import { describe, expect, it } from "vitest";
import z from "zod/v4";

import { toOpenAPISchema } from "~/index.js";

describe("zod v4", () => {
  it("basic", async () => {
    const schema = z
      .object({
        myString: z.string(),
        myUnion: z.union([z.number(), z.boolean()]),
      })
      .describe("My neat object schema");

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("with metadata", async () => {
    const schema = z
      .object({
        myString: z.string(),
        myUnion: z.union([z.number(), z.boolean()]),
      })
      .describe("My neat object schema")
      .meta({
        ref: "MyNeatObjectSchema",
      });

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("preserves external $ref URLs", async () => {
    const schema = z
      .object({
        model: z.string().meta({
          $ref: "https://models.dev/model-schema.json#/$defs/Model",
        }),
      })
      .describe("Schema with external ref");

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });
});
