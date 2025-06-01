import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Handler } from "./types.js";

export const toOpenAPISchema = async (schema: StandardSchemaV1) => {
  const vendor = schema["~standard"].vendor;

  // keep this switch if any other libs are added
  let mod: Handler;
  switch (vendor) {
    case "arktype":
    case "effect":
    case "valibot":
    case "zod":
      mod = import("./default.js");
      break;
    default:
      throw new Error(
        `standard-openapi: Unsupported schema vendor "${vendor}"`,
      );
  }

  return await (await mod).generator(schema);
};
