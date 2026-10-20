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

  it.each([
    ["the input by default", {}, {}],
    [
      'the output with `io: "output"`',
      { io: "output" as const },
      { required: ["size"] },
    ],
  ])("describes %s", async (_, context, output) => {
    const Order = z.object({ size: z.string().default("small") });

    const { schema } = await toOpenAPISchema(Order, context);

    expect(schema).toEqual({
      properties: { size: { default: "small", type: "string" } },
      type: "object",
      ...output,
    });
  });
});
