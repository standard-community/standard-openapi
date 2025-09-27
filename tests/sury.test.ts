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
});
