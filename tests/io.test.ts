import { type } from "arktype";
import { Schema } from "effect";
import * as S from "sury";
import { describe, expect, it } from "vitest";

import { toOpenAPISchema } from "~/index.js";

const cases = [
  [
    "arktype",
    type({ pinned: "boolean = false", title: "string" }),
    { required: ["title"] },
    { required: ["pinned", "title"] },
  ],
  [
    "effect",
    Schema.standardSchemaV1(
      Schema.Struct({
        quantity: Schema.transform(Schema.String, Schema.Number, {
          decode: Number,
          encode: String,
        }),
      }),
    ),
    { properties: { quantity: { type: "string" } } },
    { properties: { quantity: { type: "number" } } },
  ],
  [
    "sury",
    S.schema({ quantity: S.to(S.string, S.number) }),
    { properties: { quantity: { type: "string" } } },
    { properties: { quantity: { type: "number" } } },
  ],
] as const;

describe("io for vendors converted through standard-json", () => {
  it.each(cases)(
    "describes the input of %s by default or when requested",
    async (_, schema, input) => {
      expect((await toOpenAPISchema(schema)).schema).toMatchObject(input);
      expect(
        (await toOpenAPISchema(schema, { io: "input" })).schema,
      ).toMatchObject(input);
    },
  );

  it.each(cases)(
    "describes the output of %s when requested",
    async (_, schema, __, output) => {
      expect(
        (await toOpenAPISchema(schema, { io: "output" })).schema,
      ).toMatchObject(output);
    },
  );

  it.each(cases)(
    "lets explicit options override the context io for %s",
    async (_, schema, input, output) => {
      expect(
        (
          await toOpenAPISchema(schema, {
            io: "output",
            options: { io: "input" },
          })
        ).schema,
      ).toMatchObject(input);
      expect(
        (
          await toOpenAPISchema(schema, {
            options: { io: "output" },
          })
        ).schema,
      ).toMatchObject(output);
    },
  );
});
