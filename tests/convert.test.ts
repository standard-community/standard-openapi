import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { convertToOpenAPISchema } from "~/vendors/convert.js";

describe("convertToOpenAPISchema", () => {
  it.each([
    ["`/` escaped as `~1`", "alias/entry", "alias~1entry"],
    ["`~` escaped as `~0`", "alias~entry", "alias~0entry"],
    ["a literal `~1` escaped as `~01`", "alias~1entry", "alias~01entry"],
  ])("points a reference with %s at the named definition", (_, key, token) => {
    const components: OpenAPIV3_1.ComponentsObject = {};
    // `ref` names a schema the way vendors annotate one, outside JSON Schema.
    const jsonSchema: Record<string, unknown> = {
      $defs: { [key]: { ref: "Node", type: "string" } },
      properties: { node: { $ref: `#/$defs/${token}` } },
      type: "object",
    };

    const schema = convertToOpenAPISchema(jsonSchema as JSONSchema7, {
      components,
    });

    expect(schema).toEqual({
      properties: { node: { $ref: "#/components/schemas/Node" } },
      type: "object",
    });
    expect(components.schemas).toEqual({ Node: { type: "string" } });
  });

  // The JSON Schema draft 7 types don't know the 2020-12 keywords.
  it.each<[string, Record<string, unknown>]>([
    ["tuple elements", { prefixItems: [true, false], type: "array" }],
    [
      "dependent schemas",
      { dependentSchemas: { blocked: false, open: true }, type: "object" },
    ],
    ["properties", { properties: { anything: true }, type: "object" }],
    ["union members", { anyOf: [true, { type: "string" }] }],
  ])("leaves boolean schemas among %s as they are", (_, jsonSchema) => {
    expect(
      convertToOpenAPISchema(jsonSchema as JSONSchema7, { components: {} }),
    ).toEqual(jsonSchema);
  });

  it("keeps values that JSON can't hold", () => {
    const jsonSchema = {
      properties: {
        count: { default: 10n, type: "integer" },
        ratio: { maximum: Infinity, type: "number" },
      },
      type: "object",
    };

    expect(
      convertToOpenAPISchema(jsonSchema as unknown as JSONSchema7, {
        components: {},
      }),
    ).toEqual(jsonSchema);
  });

  it("leaves out functions and leaves the schema it's given as it is", () => {
    const jsonSchema = {
      nullable: true,
      properties: { name: { transform: () => "", type: "string" } },
      type: "object",
    };

    expect(
      convertToOpenAPISchema(jsonSchema as JSONSchema7, { components: {} }),
    ).toEqual({
      properties: { name: { type: "string" } },
      type: ["object", "null"],
    });
    expect(jsonSchema.nullable).toBe(true);
    expect(jsonSchema.properties.name.transform).toBeTypeOf("function");
  });

  it("registers anonymous recursive roots without taking existing or nested names", () => {
    const components: OpenAPIV3_1.ComponentsObject = {
      schemas: { Root: { type: "string" } },
    };
    const jsonSchema = {
      type: "object",
      properties: {
        next: { $ref: "#", description: "The next node" },
        named: { ref: "Root2", type: "integer" },
      },
    };
    const first = convertToOpenAPISchema(jsonSchema as JSONSchema7, {
      components,
    });
    const second = convertToOpenAPISchema(
      { type: "array", items: { $ref: "#" } },
      { components },
    );
    const repeated = convertToOpenAPISchema(jsonSchema as JSONSchema7, {
      components,
    });

    expect(first).toEqual({ $ref: "#/components/schemas/Root3" });
    expect(second).toEqual({ $ref: "#/components/schemas/Root4" });
    expect(repeated).toEqual({ $ref: "#/components/schemas/Root3" });
    expect(components.schemas).toMatchObject({
      Root: { type: "string" },
      Root2: { type: "integer" },
      Root3: {
        type: "object",
        properties: {
          next: {
            $ref: "#/components/schemas/Root3",
            description: "The next node",
          },
          named: { $ref: "#/components/schemas/Root2" },
        },
      },
      Root4: { type: "array", items: { $ref: "#/components/schemas/Root4" } },
    });
    expect(components.schemas).not.toHaveProperty("Root5");
  });

  it("reuses an anonymous recursive root, keeping each use's description beside its reference", () => {
    const components: OpenAPIV3_1.ComponentsObject = {};
    const node = (description: string) =>
      ({
        description,
        properties: { next: { $ref: "#" }, value: { type: "string" } },
        type: "object",
      }) as JSONSchema7;

    const head = convertToOpenAPISchema(node("The first node"), { components });
    const tail = convertToOpenAPISchema(node("The last node"), { components });

    expect(head).toEqual({
      $ref: "#/components/schemas/Root",
      description: "The first node",
    });
    expect(tail).toEqual({
      $ref: "#/components/schemas/Root",
      description: "The last node",
    });
    expect(Object.keys(components.schemas ?? {})).toEqual(["Root"]);
    expect(components.schemas?.Root).not.toHaveProperty("description");
  });

  it("points a named definition converted again at the anonymous root it reuses", () => {
    const components: OpenAPIV3_1.ComponentsObject = {};
    // `ref` names a schema the way vendors annotate one, outside JSON Schema.
    const category = () =>
      ({
        $defs: {
          Subcategory: {
            properties: { parent: { $ref: "#" } },
            ref: "Subcategory",
            type: "object",
          },
        },
        properties: {
          children: { items: { $ref: "#/$defs/Subcategory" }, type: "array" },
        },
        type: "object",
      }) as JSONSchema7;

    const first = convertToOpenAPISchema(category(), { components });
    const second = convertToOpenAPISchema(category(), { components });

    expect(first).toEqual({ $ref: "#/components/schemas/Root" });
    expect(second).toEqual({ $ref: "#/components/schemas/Root" });
    expect(components.schemas).toEqual({
      Root: {
        properties: {
          children: {
            items: { $ref: "#/components/schemas/Subcategory" },
            type: "array",
          },
        },
        type: "object",
      },
      Subcategory: {
        properties: { parent: { $ref: "#/components/schemas/Root" } },
        type: "object",
      },
    });
  });

  it.each([
    ["const", (value: unknown) => value],
    ["default", (value: unknown) => value],
    ["enum", (value: unknown) => [value]],
    ["examples", (value: unknown) => [value]],
  ])(
    "tells anonymous recursive roots apart by `%s` values shaped like references",
    (keyword, literal) => {
      const components: OpenAPIV3_1.ComponentsObject = {};
      const link = ($ref: string) =>
        ({
          properties: {
            next: { $ref: "#" },
            target: { [keyword]: literal({ $ref }), type: "object" },
          },
          type: "object",
        }) as JSONSchema7;

      const first = convertToOpenAPISchema(link("#/components/schemas/Root"), {
        components,
      });
      const second = convertToOpenAPISchema(link("#"), { components });

      expect(first).toEqual({ $ref: "#/components/schemas/Root" });
      expect(second).toEqual({ $ref: "#/components/schemas/Root2" });
      expect(components.schemas?.Root2).toEqual({
        properties: {
          next: { $ref: "#/components/schemas/Root2" },
          target: { [keyword]: literal({ $ref: "#" }), type: "object" },
        },
        type: "object",
      });
    },
  );

  it("rewrites draft-07 dependencies to the keywords JSON Schema 2020-12 splits them into", () => {
    const components: OpenAPIV3_1.ComponentsObject = {};
    const jsonSchema = {
      $defs: {
        Billing: {
          properties: { address: { type: "string" } },
          required: ["address"],
          type: "object",
        },
      },
      dependencies: {
        card: { $ref: "#/$defs/Billing" },
        coupon: ["campaign"],
        gift: false,
      },
      type: "object",
    };

    const schema = convertToOpenAPISchema(jsonSchema as JSONSchema7, {
      components,
    });

    expect(schema).toEqual({
      dependentRequired: { coupon: ["campaign"] },
      dependentSchemas: {
        card: { $ref: "#/components/schemas/Billing" },
        gift: false,
      },
      type: "object",
    });
    expect(components.schemas).toHaveProperty("Billing");
  });

  it("keeps a 2020-12 dependency over a draft-07 one for the same property", () => {
    const jsonSchema = {
      dependencies: { card: ["billing"] },
      dependentRequired: { card: ["address"] },
      type: "object",
    };

    expect(
      convertToOpenAPISchema(jsonSchema as JSONSchema7, { components: {} }),
    ).toEqual({ dependentRequired: { card: ["address"] }, type: "object" });
  });

  it("leaves anonymous nonrecursive schemas inline, including literal root references", () => {
    const components: OpenAPIV3_1.ComponentsObject = {};
    const schema = {
      type: "object",
      examples: [{ $ref: "#" }],
      default: { $ref: "#" },
    };
    expect(
      convertToOpenAPISchema(schema as JSONSchema7, { components }),
    ).toEqual(schema);
    expect(components).toEqual({});
  });

  it.each([
    [
      "metadata",
      [
        { ref: "Root", type: "string", description: "Explicit" },
        { ref: "Root2", type: "integer" },
      ],
    ],
    [
      "hoisted definitions",
      [
        {
          $defs: {
            Root: { type: "string", description: "Explicit" },
            Root2: { type: "integer" },
          },
        },
      ],
    ],
  ])(
    "moves generated roots when later %s claim their names",
    (_, definitions) => {
      const components: OpenAPIV3_1.ComponentsObject = {};
      const schema = convertToOpenAPISchema(
        {
          type: "object",
          description: "Recursive",
          properties: { next: { $ref: "#" } },
        },
        { components },
      );
      for (const definition of definitions) {
        convertToOpenAPISchema(definition as JSONSchema7, { components });
      }
      expect(schema).toEqual({ $ref: "#/components/schemas/Root3" });
      expect(components.schemas).toEqual({
        Root: { type: "string", description: "Explicit" },
        Root2: { type: "integer" },
        Root3: {
          type: "object",
          description: "Recursive",
          properties: { next: { $ref: "#/components/schemas/Root3" } },
        },
      });
    },
  );

  it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
    [
      "a type",
      { minLength: 1, nullable: true, type: "string" },
      { minLength: 1, type: ["string", "null"] },
    ],
    [
      "several types",
      { nullable: true, type: ["string", "number"] },
      { type: ["string", "number", "null"] },
    ],
    [
      "an enum",
      { enum: ["cat", "dog"], nullable: true, type: "string" },
      { enum: ["cat", "dog", null], type: ["string", "null"] },
    ],
    [
      "an enum and no type",
      { enum: ["cat", "dog"], nullable: true },
      { enum: ["cat", "dog", null] },
    ],
    [
      "a union",
      {
        anyOf: [{ type: "string" }, { type: "number" }],
        description: "A name or a number",
        nullable: true,
      },
      {
        anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
        description: "A name or a number",
      },
    ],
    [
      "a reference",
      { $ref: "https://example.com/pet.json", nullable: true },
      {
        anyOf: [{ $ref: "https://example.com/pet.json" }, { type: "null" }],
      },
    ],
    [
      "a constant",
      { const: "cat", nullable: true, type: "string" },
      { anyOf: [{ const: "cat", type: "string" }, { type: "null" }] },
    ],
    [
      "nothing to restrict",
      { description: "Anything", nullable: true },
      { description: "Anything" },
    ],
    [
      "only keywords for other types",
      { format: "date", minLength: 10, nullable: true },
      { format: "date", minLength: 10 },
    ],
  ])(
    "accepts null for a nullable schema with %s",
    (_, jsonSchema, expected) => {
      expect(
        convertToOpenAPISchema(jsonSchema as JSONSchema7, { components: {} }),
      ).toEqual(expected);
    },
  );

  it("registers a nullable named schema with null as one of its alternatives", () => {
    const components: OpenAPIV3_1.ComponentsObject = {};
    const jsonSchema = {
      allOf: [{ properties: { name: { type: "string" } }, type: "object" }],
      description: "A pet, if there is one",
      nullable: true,
      ref: "Pet",
    };

    const schema = convertToOpenAPISchema(jsonSchema as JSONSchema7, {
      components,
    });

    expect(schema).toEqual({ $ref: "#/components/schemas/Pet" });
    expect(components.schemas).toEqual({
      Pet: {
        anyOf: [
          {
            allOf: [
              { properties: { name: { type: "string" } }, type: "object" },
            ],
          },
          { type: "null" },
        ],
        description: "A pet, if there is one",
      },
    });
  });

  it("drops `nullable: false`", () => {
    expect(
      convertToOpenAPISchema(
        { nullable: false, type: "string" } as JSONSchema7,
        { components: {} },
      ),
    ).toEqual({ type: "string" });
  });

  it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
    [
      "a union of unions",
      {
        anyOf: [
          { anyOf: [{ type: "string" }, { anyOf: [{ type: "number" }] }] },
          { type: "null" },
        ],
      },
      { anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }] },
    ],
    [
      "an intersection of intersections",
      {
        allOf: [
          { allOf: [{ required: ["name"] }, { required: ["age"] }] },
          { required: ["owner"] },
        ],
      },
      {
        allOf: [
          { required: ["name"] },
          { required: ["age"] },
          { required: ["owner"] },
        ],
      },
    ],
  ])("flattens %s", (_, jsonSchema, expected) => {
    expect(
      convertToOpenAPISchema(jsonSchema as JSONSchema7, { components: {} }),
    ).toEqual(expected);
  });

  it.each<[string, Record<string, unknown>]>([
    [
      "a member with its own description",
      {
        anyOf: [
          {
            anyOf: [{ type: "string" }, { type: "number" }],
            description: "An identifier",
          },
          { type: "null" },
        ],
      },
    ],
    [
      "exclusive alternatives",
      {
        oneOf: [
          { oneOf: [{ type: "string" }, { type: "number" }] },
          { type: "null" },
        ],
      },
    ],
    [
      "a union inside an intersection",
      {
        allOf: [
          { anyOf: [{ required: ["name"] }, { required: ["company"] }] },
          { required: ["owner"] },
        ],
      },
    ],
    [
      "an intersection inside a union",
      {
        anyOf: [
          { allOf: [{ required: ["name"] }, { required: ["age"] }] },
          { required: ["owner"] },
        ],
      },
    ],
  ])("keeps %s nested", (_, jsonSchema) => {
    expect(
      convertToOpenAPISchema(jsonSchema as JSONSchema7, { components: {} }),
    ).toEqual(jsonSchema);
  });

  it("keeps a reference to a named union as one member", () => {
    const components: OpenAPIV3_1.ComponentsObject = {};
    const jsonSchema = {
      anyOf: [
        { anyOf: [{ type: "string" }, { type: "number" }], ref: "Id" },
        { type: "null" },
      ],
    };

    const schema = convertToOpenAPISchema(jsonSchema as JSONSchema7, {
      components,
    });

    expect(schema).toEqual({
      anyOf: [{ $ref: "#/components/schemas/Id" }, { type: "null" }],
    });
    expect(components.schemas).toEqual({
      Id: { anyOf: [{ type: "string" }, { type: "number" }] },
    });
  });
});
