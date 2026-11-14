import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { toOpenAPISchema } from "~/index.js";

// Add this anywhere in your project
declare global {
  interface ArkEnv {
    meta(): {
      // Meta properties should always be optional
      ref?: string;
    };
  }
}

describe("effect", () => {
  it("basic", async () => {
    const schema = Schema.standardSchemaV1(
      Schema.Struct({
        myString: Schema.String,
        myUnion: Schema.Union(Schema.Number, Schema.Boolean),
      }).annotations({ description: "My neat object schema" }),
    );

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("with metadata", async () => {
    const schema = Schema.standardSchemaV1(
      Schema.Struct({
        myString: Schema.String,
        myUnion: Schema.Union(Schema.Number, Schema.Boolean),
      }).annotations({
        description: "My neat object schema",
        identifier: "MyNeatObjectSchema",
      }),
    );

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("lifts $defs into components when the root schema is a container", async () => {
    class Bar extends Schema.Class<Bar>("Bar")({
      baz: Schema.Number,
    }) {}

    class Foo extends Schema.Class<Foo>("Foo")({
      bar: Schema.optional(Bar),
    }) {}

    class Item extends Schema.Class<Item>("Item")({
      foo: Foo,
      id: Schema.String,
    }) {}

    const { schema, components } = await toOpenAPISchema(
      Schema.Array(Item).pipe(Schema.standardSchemaV1),
    );

    // The root schema must reference components, not embed $defs inline
    expect((schema as { $defs?: unknown }).$defs).toBeUndefined();
    expect(schema).toEqual({
      type: "array",
      items: { $ref: "#/components/schemas/Item" },
    });

    // The definitions must be lifted into components.schemas as real schemas
    expect(Object.keys(components?.schemas ?? {})).toEqual(
      expect.arrayContaining(["Item", "Foo", "Bar"]),
    );
    expect(components?.schemas?.Item).toMatchObject({ type: "object" });
    expect(components?.schemas?.Item).toHaveProperty("properties.foo", {
      $ref: "#/components/schemas/Foo",
    });
  });

  it("does not clobber ref-annotated components with $ref stubs", async () => {
    // When schemas carry a `ref` annotation the converter registers the real
    // definition under components AND leaves a self-referential `{ $ref }`
    // stub inside the container's `$defs`. The real component must win.
    class Bar extends Schema.Class<Bar>("Bar")(
      { baz: Schema.Number },
      { jsonSchema: { ref: "Bar" } },
    ) {}

    class Item extends Schema.Class<Item>("Item")(
      { bar: Bar },
      { jsonSchema: { ref: "Item" } },
    ) {}

    const { schema, components } = await toOpenAPISchema(
      Schema.Array(Item).pipe(Schema.standardSchemaV1),
    );

    expect((schema as { $defs?: unknown }).$defs).toBeUndefined();
    expect(components?.schemas?.Item).toMatchObject({ type: "object" });
    expect(components?.schemas?.Bar).toMatchObject({
      type: "object",
      properties: { baz: { type: "number" } },
    });
    expect(components?.schemas?.Item).not.toHaveProperty("$ref");
    expect(components?.schemas?.Bar).not.toHaveProperty("$ref");
  });

  it("describes a tuple with the keywords of JSON Schema 2020-12", async () => {
    const schema = Schema.standardSchemaV1(
      Schema.Tuple([Schema.String, Schema.Number], Schema.Boolean),
    );

    const { schema: openapiSchema } = await toOpenAPISchema(schema);
    expect(openapiSchema).toEqual({
      items: { type: "boolean" },
      minItems: 2,
      prefixItems: [{ type: "string" }, { type: "number" }],
      type: "array",
    });
  });

  it.each([
    ["pets/Pet", "pets~1Pet"],
    ["Pet~v2", "Pet~0v2"],
  ])(
    "escapes the identifier %s in a reference to its component",
    async (identifier, token) => {
      const Pet = Schema.Struct({ name: Schema.String }).annotations({
        identifier,
      });

      const { schema, components } = await toOpenAPISchema(
        Schema.standardSchemaV1(Schema.Struct({ resident: Pet })),
      );

      expect(schema).toMatchObject({
        properties: { resident: { $ref: `#/components/schemas/${token}` } },
      });
      expect(Object.keys(components?.schemas ?? {})).toEqual([identifier]);
    },
  );

  it("escapes the identifiers of schemas that refer to each other in their references", async () => {
    interface Pet {
      readonly legacy?: LegacyPet;
      readonly name: string;
    }
    interface LegacyPet {
      readonly current: Pet;
    }
    const Pet: Schema.Schema<Pet> = Schema.Struct({
      legacy: Schema.optional(
        Schema.suspend((): Schema.Schema<LegacyPet> => LegacyPet),
      ),
      name: Schema.String,
    }).annotations({ identifier: "pets/Pet" });
    const LegacyPet: Schema.Schema<LegacyPet> = Schema.Struct({
      current: Schema.suspend((): Schema.Schema<Pet> => Pet),
    }).annotations({ identifier: "Pet~v2" });
    const shelter = Schema.standardSchemaV1(Schema.Struct({ resident: Pet }));
    const components = {};

    const first = await toOpenAPISchema(shelter, { components });
    const second = await toOpenAPISchema(shelter, { components });

    expect(first.schema).toMatchObject({
      properties: { resident: { $ref: "#/components/schemas/pets~1Pet" } },
    });
    expect(second.schema).toEqual(first.schema);
    expect(components).toMatchObject({
      schemas: {
        "Pet~v2": {
          properties: { current: { $ref: "#/components/schemas/pets~1Pet" } },
        },
        "pets/Pet": {
          properties: { legacy: { $ref: "#/components/schemas/Pet~0v2" } },
        },
      },
    });
    expect(
      Object.keys((components as { schemas: object }).schemas).toSorted(),
    ).toEqual(["Pet~v2", "pets/Pet"]);
  });
});
