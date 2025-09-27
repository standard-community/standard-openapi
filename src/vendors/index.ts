import {
  errorMessageWrapper,
  openapiVendorMap,
  type ToOpenAPISchemaFn,
} from "./utils.js";

export const getToOpenAPISchemaFn = async (
  vendor: string,
): Promise<ToOpenAPISchemaFn> => {
  const cached = openapiVendorMap.get(vendor);
  if (cached) {
    return cached;
  }

  let vendorFn: ToOpenAPISchemaFn;

  switch (vendor) {
    case "valibot":
      vendorFn = (await import("./valibot.js")).default();
      break;
    case "zod":
      vendorFn = (await import("./zod.js")).default();
      break;
    case "arktype":
    case "effect":
    case "typebox":
      vendorFn = (await import("./default.js")).default();
      break;
    default:
      throw new Error(
        errorMessageWrapper(`Unsupported schema vendor "${vendor}".`),
      );
  }

  openapiVendorMap.set(vendor, vendorFn);
  return vendorFn;
};
