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

  let vendorFnPromise: ToOpenAPISchemaFn | Promise<ToOpenAPISchemaFn>;

  switch (vendor) {
    case "valibot":
      vendorFnPromise = (await import("./valibot.js")).default();
      break;
    case "zod":
      vendorFnPromise = (await import("./zod.js")).default();
      break;
    case "arktype":
    case "effect":
      vendorFnPromise = (await import("./default.js")).default();
      break;
    default:
      throw new Error(
        errorMessageWrapper(`Unsupported schema vendor "${vendor}".`),
      );
  }

  const vendorFn = await vendorFnPromise;
  openapiVendorMap.set(vendor, vendorFn);
  return vendorFn;
};
