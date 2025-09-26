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
});
