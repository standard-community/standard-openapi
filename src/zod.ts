import type { GeneratorFn } from "./types.js";
import { createSchema } from "zod-openapi";
import type * as z from "zod";

export const generator: GeneratorFn = (schema, metadata) =>
  createSchema(schema as z.ZodType, metadata);
