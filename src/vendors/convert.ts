import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import type { ToOpenAPISchemaContext } from "./utils.js";

export function convertToOpenAPISchema(
  jsonSchema: JSONSchema7,
  context: ToOpenAPISchemaContext,
): OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject {
  const _jsonSchema = JSON.parse(JSON.stringify(jsonSchema));

  // Handle nullable property conversion
  if ("nullable" in _jsonSchema && _jsonSchema.nullable === true) {
    if (_jsonSchema.type) {
      // Convert type + nullable to type array
      if (Array.isArray(_jsonSchema.type)) {
        // If type is already an array, add null if not present
        if (!_jsonSchema.type.includes("null")) {
          _jsonSchema.type.push("null");
        }
      } else {
        // Convert single type to array with null
        _jsonSchema.type = [_jsonSchema.type, "null"];
      }
    } else {
      // If no type specified but nullable is true, add null type
      _jsonSchema.type = ["null"];
    }

    // Remove the nullable property
    delete _jsonSchema.nullable;
  }

  // Remove $schema reference if present
  if (_jsonSchema.$schema) {
    delete _jsonSchema.$schema;
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
    if (_jsonSchema[key]) {
      if (
        key === "properties" ||
        key === "definitions" ||
        key === "$defs" ||
        key === "patternProperties"
      ) {
        // These are objects containing schemas
        for (const subKey in _jsonSchema[key]) {
          _jsonSchema[key][subKey] = convertToOpenAPISchema(
            _jsonSchema[key][subKey],
            context,
          );
        }
      } else if (key === "allOf" || key === "anyOf" || key === "oneOf") {
        // These are arrays of schemas
        _jsonSchema[key] = _jsonSchema[key].map((item: any) =>
          convertToOpenAPISchema(item, context),
        );
      } else if (key === "items") {
        // Items can be a schema or array of schemas
        if (Array.isArray(_jsonSchema[key])) {
          _jsonSchema[key] = _jsonSchema[key].map((item: any) =>
            convertToOpenAPISchema(item, context),
          );
        } else {
          _jsonSchema[key] = convertToOpenAPISchema(_jsonSchema[key], context);
        }
      } else {
        // Single schema properties
        _jsonSchema[key] = convertToOpenAPISchema(_jsonSchema[key], context);
      }
    }
  });

  // If a ref is provided, use it to create a $ref in the OpenAPI components
  if (_jsonSchema.ref) {
    const { ref, ...component } = _jsonSchema;

    context.components.schemas = {
      ...context.components.schemas,
      [ref]: component,
    };
    return {
      $ref: `#/components/schemas/${ref}`,
    };
  }

  return _jsonSchema;
}
