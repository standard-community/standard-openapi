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

  it.each([
    [
      "describes the input of a pipe that transforms it by default",
      {},
      "string",
    ],
    [
      'describes its output with `typeMode: "output"`',
      { typeMode: "output" },
      "number",
    ],
  ])("%s", async (_, options, type) => {
    const Order = v.object({
      quantity: v.pipe(v.string(), v.transform(Number), v.number()),
    });

    const { schema } = await toOpenAPISchema(Order, { options });

    expect(schema).toEqual({
      properties: { quantity: { type } },
      required: ["quantity"],
      type: "object",
    });
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

  it.each([
    ["changes nothing", () => undefined, undefined],
    [
      "changes the schema",
      ({ jsonSchema, valibotAction }: any) =>
        valibotAction.type === "metadata"
          ? { ...jsonSchema, title: "A pet" }
          : undefined,
      "A pet",
    ],
  ])(
    "keeps `ref` and `example` metadata when an `overrideAction` %s",
    async (_, overrideAction, title) => {
      const Pet = v.pipe(
        v.object({ name: v.string() }),
        v.metadata({ example: { name: "Rex" }, ref: "Pet" }),
      );
      const components = {};

      const { schema } = await toOpenAPISchema(Pet, {
        components,
        options: { overrideAction },
      });

      expect(schema).toEqual({ $ref: "#/components/schemas/Pet" });
      expect(components).toEqual({
        schemas: {
          Pet: {
            example: { name: "Rex" },
            properties: { name: { type: "string" } },
            required: ["name"],
            ...(title ? { title } : {}),
            type: "object",
          },
        },
      });
    },
  );

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
