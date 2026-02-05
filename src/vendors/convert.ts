import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import type { ToOpenAPISchemaContext } from "./utils.js";

export function convertToOpenAPISchema(
  jsonSchema: JSONSchema7,
  context: ToOpenAPISchemaContext
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
    if (
      _jsonSchema[key] &&
      (typeof _jsonSchema[key] === "object" || Array.isArray(_jsonSchema[key]))
    ) {
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
            context
          );
        }
      } else if (key === "allOf" || key === "anyOf" || key === "oneOf") {
        // These are arrays of schemas
        _jsonSchema[key] = _jsonSchema[key].map((item: any) =>
          convertToOpenAPISchema(item, context)
        );
      } else if (key === "items") {
        // Items can be a schema or array of schemas
        if (Array.isArray(_jsonSchema[key])) {
          _jsonSchema[key] = _jsonSchema[key].map((item: any) =>
            convertToOpenAPISchema(item, context)
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

  // Hoist any leftover `$defs`/`definitions` into the shared components and
  // strip them from the node. Some vendors (e.g. Effect Schema) emit a
  // top-level `$defs` map alongside a container schema (`array`, `object`,
  // `anyOf`, ...) even after their inner `$ref`s have been rewritten to
  // `#/components/schemas/*`. Without this, the definitions would stay
  // duplicated inline on the returned schema while `components.schemas` never
  // receives them.
  //
  // Existing components win over the lifted defs: when a schema is
  // `ref`/`$id`-annotated the vendor already registered the real definition
  // and only leaves a self-referential `{ $ref }` stub inside `$defs`.
  if (_jsonSchema.$defs || _jsonSchema.definitions) {
    context.components.schemas = {
      ..._jsonSchema.definitions,
      ..._jsonSchema.$defs,
      ...context.components.schemas,
    };

    delete _jsonSchema.$defs;
    delete _jsonSchema.definitions;
  }

  // If a ref is provided, use it to create a $ref in the OpenAPI components
  if (_jsonSchema.ref || _jsonSchema.$id) {
    const { ref, $id, ...component } = _jsonSchema;

    const id = ref || $id;

    context.components.schemas = {
      ...context.components.schemas,
      [id]: component,
    };
    return {
      $ref: `#/components/schemas/${id}`,
    };
  } else if (_jsonSchema.$ref) {
    // The referenced definitions were already hoisted from `$defs` above.
    const { $ref, ...rest } = _jsonSchema;

    // Preserve external URLs as-is.
    const lowerRef = $ref.toLowerCase();
    if (
      lowerRef.startsWith("http://") ||
      lowerRef.startsWith("https://") ||
      $ref.startsWith("//")
    ) {
      return { ...rest, $ref };
    }

    // Convert internal refs (e.g. Effect's #/$defs/) to OpenAPI component refs
    const ref = $ref.split("/").pop();

    return {
      $ref: `#/components/schemas/${ref}`,
    };
  }

  return _jsonSchema;
}
