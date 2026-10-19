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
      v.description("My neat object schema")
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
      })
    );

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("with nested metadata", async () => {
    const userSchema = v.pipe(
      v.object({
        id: v.string(),
      }),
      v.metadata({
        ref: "UserSchema",
      })
    );

    const responseSchema = v.pipe(
      v.object({
        user: userSchema,
      }),
      v.metadata({
        ref: "ResponseSchema",
      })
    );

    const specs = await toOpenAPISchema(responseSchema);
    expect(specs).toMatchSnapshot();
  });

  it("moves definitions into the components", async () => {
    const Pet = v.object({ name: v.string() });
    const Owner = v.object({ pets: v.array(Pet) });
    const components = {};

    const { schema } = await toOpenAPISchema(Owner, {
      components,
      options: { definitions: { Pet } },
    });

    expect(schema).toEqual({
      properties: {
        pets: { items: { $ref: "#/components/schemas/Pet" }, type: "array" },
      },
      required: ["pets"],
      type: "object",
    });
    expect(components).toEqual({
      schemas: {
        Pet: {
          properties: { name: { type: "string" } },
          required: ["name"],
          type: "object",
        },
      },
    });
  });
});
