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
    expect(
      (components?.schemas?.Item as { properties: Record<string, unknown> })
        .properties.foo,
    ).toEqual({ $ref: "#/components/schemas/Foo" });
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
    expect(
      (components?.schemas?.Item as { $ref?: string }).$ref,
    ).toBeUndefined();
    expect(
      (components?.schemas?.Bar as { $ref?: string }).$ref,
    ).toBeUndefined();
  });
});
