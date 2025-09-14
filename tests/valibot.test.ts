import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { toOpenAPISchema } from "~/index.js";

describe("valibot", () => {
  it("basic", async () => {
    const schema = v.object({
      myString: v.string(),
      myUnion: v.union([v.number(), v.boolean()]),
    });

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("basic with pipe", async () => {
    const schema = v.pipe(
      v.object({
        myString: v.string(),
        myUnion: v.union([v.number(), v.boolean()]),
      }),
      v.description("My neat object schema"),
    );

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("with metadata", async () => {
    const schema = v.pipe(
      v.object({
        myString: v.string(),
        myUnion: v.union([v.number(), v.boolean()]),
      }),
      v.description("My neat object schema"),
      v.metadata({
        ref: "MyNeatObjectSchema",
      }),
    );

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });
});
