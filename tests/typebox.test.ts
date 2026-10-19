import Type from "typebox";
import { Compile } from "typebox/compile";
import { describe, expect, it } from "vitest";
import { toOpenAPISchema } from "~/index.js";

describe("typebox", () => {
  it("basic", async () => {
    const schema = Type.Object(
      {
        myString: Type.String(),
        myUnion: Type.Union([Type.Number(), Type.Boolean()]),
      },
      {
        description: "My neat object schema",
      },
    );

    const specs = await toOpenAPISchema(Compile(schema));
    expect(specs).toMatchSnapshot();
  });

  it("with metadata", async () => {
    const schema = Type.Object(
      {
        myString: Type.String(),
        myUnion: Type.Union([Type.Number(), Type.Boolean()]),
      },
      {
        description: "My neat object schema",
        $id: "MyNeatObjectSchema",
      },
    );

    const specs = await toOpenAPISchema(Compile(schema));
    expect(specs).toMatchSnapshot();
  });

  it("flattens an intersection of intersections", async () => {
    const schema = Type.Intersect([
      Type.Intersect([
        Type.Object({ name: Type.String() }),
        Type.Object({ age: Type.Number() }),
      ]),
      Type.Object({ owner: Type.String() }),
    ]);

    const { schema: openapiSchema } = await toOpenAPISchema(Compile(schema));
    expect(openapiSchema).toEqual({
      allOf: [
        {
          properties: { name: { type: "string" } },
          required: ["name"],
          type: "object",
        },
        {
          properties: { age: { type: "number" } },
          required: ["age"],
          type: "object",
        },
        {
          properties: { owner: { type: "string" } },
          required: ["owner"],
          type: "object",
        },
      ],
    });
  });
});
