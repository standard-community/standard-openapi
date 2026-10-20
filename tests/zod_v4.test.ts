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

  it.each([
    ["the input by default", {}, {}],
    [
      'the output with `io: "output"`',
      { io: "output" as const },
      { additionalProperties: false, required: ["size"] },
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

  describe("a description on a schema named with `ref`", () => {
    it("stays beside each field that gives its own", async () => {
      const Person = z.object({ name: z.string() }).meta({ ref: "Person" });
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

    it("stays on the component when every use agrees on it", async () => {
      const Person = z
        .object({ name: z.string() })
        .meta({ description: "Someone with access", ref: "Person" });

      const { schema, components } = await toOpenAPISchema(
        z.object({ editor: Person, owner: Person }),
      );

      expect(schema).toMatchObject({
        properties: {
          editor: { $ref: "#/components/schemas/Person" },
          owner: { $ref: "#/components/schemas/Person" },
        },
      });
      expect(components?.schemas?.Person).toMatchObject({
        description: "Someone with access",
      });
    });

    it("moves beside a reference converted before a use that disagrees", async () => {
      const Person = z.object({ name: z.string() }).meta({ ref: "Person" });

      const { schema, components } = await toOpenAPISchema(
        z.object({
          owner: Person.describe("Who owns the folder"),
          viewer: Person,
        }),
      );

      expect(schema).toMatchObject({
        properties: {
          owner: {
            $ref: "#/components/schemas/Person",
            description: "Who owns the folder",
          },
          viewer: { $ref: "#/components/schemas/Person" },
        },
      });
      expect(components?.schemas?.Person).not.toHaveProperty("description");
    });

    it("moves beside a reference from an earlier conversion sharing the components", async () => {
      const Person = z.object({ name: z.string() }).meta({ ref: "Person" });
      const components = {};

      const { schema: owned } = await toOpenAPISchema(
        z.object({ owner: Person.describe("Who owns the folder") }),
        { components },
      );
      const { schema: edited } = await toOpenAPISchema(
        z.object({ editor: Person.describe("Who last edited the folder") }),
        { components },
      );

      expect(owned).toMatchObject({
        properties: {
          owner: {
            $ref: "#/components/schemas/Person",
            description: "Who owns the folder",
          },
        },
      });
      expect(edited).toMatchObject({
        properties: {
          editor: {
            $ref: "#/components/schemas/Person",
            description: "Who last edited the folder",
          },
        },
      });
      expect(components).not.toHaveProperty("schemas.Person.description");
    });
    it("moves beside a bare reference to a recursive schema", async () => {
      const Person: z.ZodType<unknown> = z
        .object({
          name: z.string(),
          get friend() {
            return Person.optional();
          },
        })
        .meta({ description: "A person", ref: "Person" });

      const { schema, components } = await toOpenAPISchema(
        z.object({ base: Person, owner: Person.describe("Owner") }),
      );

      expect(schema).toMatchObject({
        properties: {
          base: {
            $ref: "#/components/schemas/Person",
            description: "A person",
          },
          owner: { $ref: "#/components/schemas/Person", description: "Owner" },
        },
      });
      expect(components?.schemas?.Person).toMatchObject({
        properties: {
          friend: {
            $ref: "#/components/schemas/Person",
            description: "A person",
          },
        },
      });
      expect(components?.schemas?.Person).not.toHaveProperty("description");
    });
  });

  describe("recursive schemas", () => {
    const refsIn = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value.flatMap(refsIn);
      }
      if (value === null || typeof value !== "object") {
        return [];
      }
      return Object.entries(value).flatMap(([key, item]) =>
        key === "$ref" && typeof item === "string" ? [item] : refsIn(item),
      );
    };

    it("points a schema that refers to itself at its own component", async () => {
      const Folder: z.ZodType<unknown> = z
        .object({
          name: z.string(),
          get parent() {
            return Folder.optional();
          },
        })
        .meta({ ref: "Folder" });

      const { schema, components } = await toOpenAPISchema(Folder);

      expect(schema).toEqual({ $ref: "#/components/schemas/Folder" });
      expect(Object.keys(components?.schemas ?? {})).toEqual(["Folder"]);
      expect(components?.schemas?.Folder).toMatchObject({
        properties: { parent: { $ref: "#/components/schemas/Folder" } },
      });
    });

    it("resolves a recursive union through z.lazy()", async () => {
      const Condition = z
        .object({ field: z.string() })
        .meta({ ref: "Condition" });
      const ConditionGroup: z.ZodType<unknown> = z
        .object({
          operator: z.enum(["AND", "OR"]),
          conditions: z.array(
            z.lazy(() => z.union([Condition, ConditionGroup])),
          ),
        })
        .meta({ ref: "ConditionGroup" });

      const { components } = await toOpenAPISchema(ConditionGroup);

      expect(refsIn(components)).toEqual([
        "#/components/schemas/Condition",
        "#/components/schemas/ConditionGroup",
      ]);
    });

    it("points `#` at the root schema, not the nearest named one", async () => {
      const Owner: z.ZodType<unknown> = z
        .object({
          name: z.string(),
          get folder() {
            return Folder.optional();
          },
        })
        .meta({ ref: "Owner" });
      const Folder: z.ZodType<unknown> = z
        .object({ owner: Owner })
        .meta({ ref: "Folder" });

      const { components } = await toOpenAPISchema(Folder);

      expect(components?.schemas?.Owner).toMatchObject({
        properties: { folder: { $ref: "#/components/schemas/Folder" } },
      });
    });

    it("names a recursive schema nested in another by its own name", async () => {
      const Folder: z.ZodType<unknown> = z
        .object({
          name: z.string(),
          get parent() {
            return Folder.optional();
          },
        })
        .meta({ ref: "Folder" });

      const { schema, components } = await toOpenAPISchema(
        z.object({ root: Folder }),
      );

      expect(Object.keys(components?.schemas ?? {})).toEqual(["Folder"]);
      expect(refsIn({ schema, components })).toEqual([
        "#/components/schemas/Folder",
        "#/components/schemas/Folder",
      ]);
    });
  });

  it("turns named tuple elements into component references", async () => {
    const First = z.object({ a: z.string() }).meta({ ref: "First" });
    const Second = z.object({ b: z.string() }).meta({ id: "Second" });

    const { schema, components } = await toOpenAPISchema(
      z.tuple([First, Second]),
    );

    expect(schema).toEqual({
      type: "array",
      prefixItems: [
        { $ref: "#/components/schemas/First" },
        { $ref: "#/components/schemas/Second" },
      ],
    });
    expect(Object.keys(components?.schemas ?? {}).toSorted()).toEqual([
      "First",
      "Second",
    ]);
  });

  it("keeps unnamed recursion valid when embedded in an OpenAPI document", async () => {
    const Node: z.ZodType<unknown> = z.object({
      value: z.string(),
      get next() {
        return Node.optional();
      },
    });
    const { schema, components } = await toOpenAPISchema(Node);
    const document = {
      components,
      paths: {
        "/nodes": {
          get: {
            responses: {
              200: {
                description: "OK",
                content: { "application/json": { schema } },
              },
            },
          },
        },
      },
    };
    const responseSchema =
      document.paths["/nodes"].get.responses[200].content["application/json"]
        .schema;
    expect(responseSchema).toHaveProperty("$ref");
    const rootRef = (responseSchema as { $ref: string }).$ref;
    expect(rootRef).toMatch(/^#\/components\/schemas\/[^/]+$/);
    const root = document.components?.schemas?.[rootRef.split("/").pop()!] as {
      properties: Record<string, unknown>;
    };
    expect(root).toMatchObject({
      type: "object",
      properties: {
        value: { type: "string" },
        next: { $ref: rootRef },
      },
    });
  });
  describe("an unnamed recursive schema converted again", () => {
    const Node: z.ZodType<unknown> = z.object({
      value: z.string().default("first"),
      get next() {
        return Node.optional();
      },
    });

    it("reuses the component the first conversion created", async () => {
      const components = {};

      const { schema: first } = await toOpenAPISchema(Node, { components });
      const { schema: second } = await toOpenAPISchema(Node, { components });

      expect(second).toEqual(first);
      expect(Object.keys(components)).toEqual(["schemas"]);
      expect(Object.keys((components as { schemas: object }).schemas)).toEqual([
        "Root",
      ]);
    });

    it("gives a conversion that differs, such as for output, its own component", async () => {
      const components = {};

      const { schema: input } = await toOpenAPISchema(Node, { components });
      const { schema: output } = await toOpenAPISchema(Node, {
        components,
        options: { io: "output" },
      });

      expect(input).toEqual({ $ref: "#/components/schemas/Root" });
      expect(output).toEqual({ $ref: "#/components/schemas/Root2" });
    });
  });
  it("flattens a nullable union", async () => {
    const schema = z.union([z.string(), z.number()]).nullable();

    const { schema: openapiSchema } = await toOpenAPISchema(schema);
    expect(openapiSchema).toEqual({
      anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
    });
  });
});
