import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3_1 } from "openapi-types"

export function convertToOpenAPISchema(jsonSchema: JSONSchema7): OpenAPIV3_1.SchemaObject {

  // Handle nullable property converstion
  if ("nullable" in jsonSchema && jsonSchema.nullable === true) {
    if (jsonSchema.type) {
      // Convert type + nullable to type array
      if (Array.isArray(jsonSchema.type)) {
        // If type is already an array, add null if not present
        if (!jsonSchema.type.includes("null")) {
          jsonSchema.type.push("null");
        }
      } else {
        // Convert single type to array with null
        jsonSchema.type = [jsonSchema.type, "null"];
      }
    } else {
      // If no type specified but nullable is true, add null type
      jsonSchema.type = ["null"];
    }

    // Remove the nullable property
    delete jsonSchema.nullable;
  }

  // Remove $schema reference if present
  if (jsonSchema.$schema) {
    delete jsonSchema.$schema;
  }

  // Recursively process nested schemas
  const nestedSchemaKeys = [
    "properties",
    "additionalProperties",
    "items",
    "additionalItems",
    "allOf",
    "anyOf",
    "oneOf",
    "not",
    "if",
    "then",
    "else",
    "definitions",
    "$defs",
    "patternProperties",
    "propertyNames",
    "contains",
    // "unevaluatedProperties",
    // "unevaluatedItems",
  ] as const;

  nestedSchemaKeys.forEach((key) => {
    if (jsonSchema[key]) {
      if (
        key === "properties" ||
        key === "definitions" ||
        key === "$defs" ||
        key === "patternProperties"
      ) {
        // These are objects containing schemas
        for (const subKey in jsonSchema[key]) {
          jsonSchema[key][subKey] = convertToOpenAPISchema(
            jsonSchema[key][subKey],
          );
        }
      } else if (key === "allOf" || key === "anyOf" || key === "oneOf") {
        // These are arrays of schemas
        jsonSchema[key] = jsonSchema[key].map(convertToOpenAPISchema);
      } else if (key === "items") {
        // Items can be a schema or array of schemas
        if (Array.isArray(jsonSchema[key])) {
          jsonSchema[key] = jsonSchema[key].map(convertToOpenAPISchema);
        } else {
          jsonSchema[key] = convertToOpenAPISchema(jsonSchema[key]);
        }
      } else {
        // Single schema properties
        jsonSchema[key] = convertToOpenAPISchema(jsonSchema[key]);
      }
    }
  });

  return jsonSchema;
}
