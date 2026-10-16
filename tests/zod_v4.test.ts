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

  it("keeps a description beside the reference to a named schema", async () => {
    const Person = z.object({ name: z.string() }).meta({ id: "Person" });
    const Folder = z.object({
      owner: Person.describe("Who owns the folder"),
      editor: Person.describe("Who last edited the folder"),
      viewer: Person,
    });

    const { schema, components } = await toOpenAPISchema(Folder);

    expect(schema).toMatchObject({
      properties: {
        owner: {
          $ref: "#/components/schemas/Person",
          description: "Who owns the folder",
        },
        editor: {
          $ref: "#/components/schemas/Person",
          description: "Who last edited the folder",
        },
        viewer: { $ref: "#/components/schemas/Person" },
      },
    });
    expect(
      (schema as { properties: Record<string, object> }).properties.viewer,
    ).toEqual({ $ref: "#/components/schemas/Person" });
    expect(components?.schemas?.Person).not.toHaveProperty("description");
  });
});
