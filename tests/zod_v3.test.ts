import { describe, expect, it } from "vitest";
import z from "zod";
import "zod-openapi/extend";

import { toOpenAPISchema } from "~/index.js";

describe("zod v3", () => {
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
      .openapi({
        ref: "MyNeatObjectSchema",
      });

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("reports zod-openapi's own error", async () => {
    const schema = z.object({
      first: z.object({ a: z.string() }).openapi({ ref: "Shared" }),
      second: z.object({ b: z.number() }).openapi({ ref: "Shared" }),
    });

    await expect(toOpenAPISchema(schema)).rejects.toThrow(/Shared/);
  });
});
