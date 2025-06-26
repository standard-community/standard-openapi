import { type } from "arktype";
import { describe, expect, it } from "vitest";
import * as v from "valibot";
import * as z from "zod";

import { toOpenAPISchema } from "../src/index.js";

describe("basic", () => {
  it("arktype", async () => {
    const schema = type({
      myString: "string",
      myUnion: "number | boolean",
    }).describe("My neat object schema");

    const specs = await toOpenAPISchema(schema);
    expect(specs).toEqual({});
  });

  it("valibot", async () => {
    const schema = v.pipe(
      v.object({
        myString: v.string(),
        myUnion: v.union([v.number(), v.boolean()]),
      }),
      v.description("My neat object schema"),
    );

    const specs = await toOpenAPISchema(schema);
    expect(specs).toEqual({});
  });

  it("zod", async () => {
    const schema = z
      .object({
        myString: z.string(),
        myUnion: z.union([z.number(), z.boolean()]),
      })
      .describe("My neat object schema");

    const specs = await toOpenAPISchema(schema);
    expect(specs).toEqual({});
  });
});
