import { errorMessageWrapper, type ToOpenAPISchemaFn } from "./utils.js";

export const getToOpenAPISchemaFn = async (
  vendor: string,
): Promise<ToOpenAPISchemaFn> => {
  switch (vendor) {
    case "valibot":
      return (await import("./valibot.js")).default();
    case "zod":
      return (await import("./zod.js")).default();
    case "arktype":
    case "effect":
      return (await import("./default.js")).default();
    default:
      throw new Error(
        errorMessageWrapper(`Unsupported schema vendor "${vendor}".`),
      );
  }
};
