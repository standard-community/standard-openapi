import * as S from "sury";
import { describe, expect, it } from "vitest";

import { toOpenAPISchema } from "~/index.js";

describe("sury", () => {
  it("basic", async () => {
    const schema = S.schema({
      myString: S.string,
      myUnion: S.union([S.number, S.boolean]),
    });

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("with metadata", async () => {
    const schema = S.extendJSONSchema(
      S.schema({
        myString: S.string,
        myUnion: S.union([S.number, S.boolean]),
      }).with(S.meta, {
        description: "My neat object schema",
      }),
      {
        $id: "MyNeatObjectSchema",
      },
    );

    const specs = await toOpenAPISchema(schema);
    expect(specs).toMatchSnapshot();
  });

  it("describes a tuple with the keywords of JSON Schema 2020-12", async () => {
    const schema = S.schema([S.string, S.number]);

    const { schema: openapiSchema } = await toOpenAPISchema(schema);
    expect(openapiSchema).toEqual({
      maxItems: 2,
      minItems: 2,
      prefixItems: [{ type: "string" }, { type: "number" }],
      type: "array",
    });
  });
});
