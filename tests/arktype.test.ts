import { type } from "arktype";
import { describe, expect, it } from "vitest";

import { toOpenAPISchema } from "~/index.js";

// Add this anywhere in your project: arktype 3 reads `declare module "arktype"`,
// arktype 2 `declare global`
declare module "arktype" {
  interface ArkEnv {
    meta(): {
      // Meta properties should always be optional
      ref?: string;
    };
  }
}

declare global {
  interface ArkEnv {
    meta(): {
      ref?: string;
    };
  }
}

describe("arktype", () => {
  it("basic", async () => {
    const schema = type({
      myString: "string",
      myUnion: "number | boolean",
    }).describe("My neat object schema");

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("with metadata", async () => {
    const schema = type({
      myString: "string",
      myUnion: "number | boolean",
    })
      .describe("My neat object schema")
      .configure({
        ref: "MyNeatObjectSchema",
      });

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });
});
