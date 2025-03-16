import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Handler } from "./types.js";

export const toOpenAPISchema = async (schema: StandardSchemaV1) => {
  const vendor = schema["~standard"].vendor;

  let mod: Handler;
  switch (vendor) {
    case "arktype":
    case "effect":
    case "valibot":
      mod = import("./default.js");
      break;
    case "zod":
      mod = import("./zod.js");
      break;
    default:
      throw new Error(
        `standard-openapi: Unsupported schema vendor "${vendor}"`,
      );
  }

  return await (await mod).generator(schema);
};
