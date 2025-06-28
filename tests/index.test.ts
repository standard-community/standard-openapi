import { type } from "arktype";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import * as z from "zod";

import { toOpenAPISchema } from "../src/index.js";

// add this anywhere in your project
declare global {
  interface ArkEnv {
    meta(): {
      // meta properties should always be optional
      ref?: string;
    };
  }
}

describe("basic", () => {
  it("arktype", async () => {
    const schema = type({
      myString: "string",
      myUnion: "number | boolean",
    }).describe("My neat object schema");

    const specs = await toOpenAPISchema(schema);
    expect(specs).toEqual({
      schema: {
        description: "My neat object schema",
        properties: {
          myString: {
            type: "string",
          },
          myUnion: {
            anyOf: [{ type: "number" }, { type: "boolean" }],
          },
        },
        required: ["myString", "myUnion"],
        type: "object",
      },
    });
  });

  it("valibot", async () => {
    const schema = v.pipe(
      v.object({
        myString: v.string(),
        myUnion: v.union([v.number(), v.boolean()]),
      }),
      v.description("My neat object schema"),
    );

    const specs = await toOpenAPISchema(schema);
    expect(specs).toEqual({
      schema: {
        description: "My neat object schema",
        properties: {
          myString: {
            type: "string",
          },
          myUnion: {
            anyOf: [{ type: "number" }, { type: "boolean" }],
          },
        },
        required: ["myString", "myUnion"],
        type: "object",
      },
    });
  });

  it("zod", async () => {
    const schema = z
      .object({
        myString: z.string(),
        myUnion: z.union([z.number(), z.boolean()]),
      })
      .describe("My neat object schema");

    const specs = await toOpenAPISchema(schema);
    expect(specs).toEqual({
      schema: {
        additionalProperties: false,
        description: "My neat object schema",
        properties: {
          myString: {
            type: "string",
          },
          myUnion: {
            type: ["number", "boolean"],
          },
        },
        required: ["myString", "myUnion"],
        type: "object",
      },
    });
  });
});

describe("with metadata", () => {
  it("arktype", async () => {
    const schema = type({
      myString: "string",
      myUnion: "number | boolean",
    })
      .describe("My neat object schema")
      .configure({
        ref: "MyNeatObjectSchema",
      });

    const specs = await toOpenAPISchema(schema);
    expect(specs).toEqual({
      schema: {
        $ref: "#/components/schemas/MyNeatObjectSchema",
      },
      components: {
        schemas: {
          MyNeatObjectSchema: {
            description: "My neat object schema",
            properties: {
              myString: {
                type: "string",
              },
              myUnion: {
                anyOf: [{ type: "number" }, { type: "boolean" }],
              },
            },
            required: ["myString", "myUnion"],
            type: "object",
          },
        },
      },
    });
  });

  it.only("valibot", async () => {
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
    expect(specs).toEqual({
      schema: {
        $ref: "#/components/schemas/MyNeatObjectSchema",
      },
      components: {
        schemas: {
          MyNeatObjectSchema: {
            description: "My neat object schema",
            properties: {
              myString: {
                type: "string",
              },
              myUnion: {
                anyOf: [{ type: "number" }, { type: "boolean" }],
              },
            },
            required: ["myString", "myUnion"],
            type: "object",
          },
        },
      },
    });
  });

  it("zod", async () => {
    const schema = z
      .object({
        myString: z.string(),
        myUnion: z.union([z.number(), z.boolean()]),
      })
      .describe("My neat object schema");

    const specs = await toOpenAPISchema(schema);
    expect(specs).toEqual({
      schema: {
        $ref: "#/components/schemas/MyNeatObjectSchema",
      },
      components: {
        schemas: {
          MyNeatObjectSchema: {
            additionalProperties: false,
            description: "My neat object schema",
            properties: {
              myString: {
                type: "string",
              },
              myUnion: {
                type: ["number", "boolean"],
              },
            },
            required: ["myString", "myUnion"],
            type: "object",
          },
        },
      },
    });
  });
});
