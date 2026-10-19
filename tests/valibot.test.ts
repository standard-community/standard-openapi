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
});
