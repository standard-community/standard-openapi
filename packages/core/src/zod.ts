import type { GeneratorFn } from "./types.js";
import { createSchema } from "zod-openapi";
import type * as z from "zod";

// Fallback to use schemaType as input if metadata isn't provided
export const generator: GeneratorFn = (schema, metadata) => 
  createSchema(schema as z.ZodType, { schemaType: "input", ...metadata });
