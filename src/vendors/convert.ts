import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import type { ToOpenAPISchemaContext } from "./utils.js";

/**
 * What a local `$ref` in a converted schema can point at: `#` is the root
 * schema, and `#/$defs/<key>` an entry that may be a named schema.
 */
type SchemaDocument = {
  /** The component name of the root schema, when it has one. */
  root?: string;
  /** The component name of each `$defs`/`definitions` entry that has one. */
  names: Record<string, string>;
};

const describeDocument = (jsonSchema: JSONSchema7): SchemaDocument => {
  const { $defs, $id, definitions, ref } = jsonSchema as Record<string, any>;

  const names = Object.fromEntries(
    Object.entries<any>({ ...definitions, ...$defs }).flatMap(
      ([key, entry]) => {
        const name = entry?.ref ?? entry?.$id;
        return typeof name === "string" ? [[key, name]] : [];
      },
    ),
  );

  return { names, root: ref ?? $id };
};

const componentName = ($ref: string, { names, root }: SchemaDocument) => {
  if ($ref === "#" && root) {
    return root;
  }

  const token = /^#\/(?:\$defs|definitions)\/(.+)$/.exec($ref)?.[1];
  // A JSON Pointer token escapes `/` as `~1` and `~` as `~0`, in that order.
  const key = token?.replaceAll("~1", "/").replaceAll("~0", "~");
  if (key && Object.hasOwn(names, key)) {
    return names[key];
  }

  return $ref.split("/").pop();
};

export const convertToOpenAPISchema = (
  jsonSchema: JSONSchema7,
  context: ToOpenAPISchemaContext,
): OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject =>
  convert(jsonSchema, context, describeDocument(jsonSchema));

const convert = (
  jsonSchema: JSONSchema7,
  context: ToOpenAPISchemaContext,
  document: SchemaDocument,
): OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject => {
  // `true` and `false` are schemas too, wherever a subschema can be, and
  // there's nothing in them to convert.
  if (typeof jsonSchema === "boolean") {
    return jsonSchema;
  }

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
    "prefixItems",
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
    "dependentSchemas",
    "propertyNames",
    "contains",
    "unevaluatedProperties",
    "unevaluatedItems",
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
        key === "patternProperties" ||
        key === "dependentSchemas"
      ) {
        // These are objects containing schemas
        for (const subKey in _jsonSchema[key]) {
          _jsonSchema[key][subKey] = convert(
            _jsonSchema[key][subKey],
            context,
            document,
          );
        }
      } else if (
        key === "allOf" ||
        key === "anyOf" ||
        key === "oneOf" ||
        key === "prefixItems"
      ) {
        // These are arrays of schemas
        _jsonSchema[key] = _jsonSchema[key].map((item: any) =>
          convert(item, context, document),
        );
      } else if (key === "items") {
        // Items can be a schema or array of schemas
        if (Array.isArray(_jsonSchema[key])) {
          _jsonSchema[key] = _jsonSchema[key].map((item: any) =>
            convert(item, context, document),
          );
        } else {
          _jsonSchema[key] = convert(_jsonSchema[key], context, document);
        }
      } else {
        // Single schema properties
        _jsonSchema[key] = convert(_jsonSchema[key], context, document);
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
  // An entry that is a named schema was registered under its own name while
  // converting it, and references to its key point at that name, so only its
  // `{ $ref }` stub is left here, and it isn't lifted.
  if (_jsonSchema.$defs || _jsonSchema.definitions) {
    const lifted = Object.entries<OpenAPIV3_1.SchemaObject>({
      ..._jsonSchema.definitions,
      ..._jsonSchema.$defs,
    }).filter(([key]) => !Object.hasOwn(document.names, key));

    context.components.schemas = {
      ...Object.fromEntries(lifted),
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

    // Preserve external URLs (http/https) and protocol-relative URLs as-is
    const lowerRef = $ref.toLowerCase();
    if (
      lowerRef.startsWith("http://") ||
      lowerRef.startsWith("https://") ||
      $ref.startsWith("//")
    ) {
      return { ...rest, $ref };
    }

    // Convert internal refs (e.g. Effect's #/$defs/) to OpenAPI component refs.
    // Keywords beside the reference, such as the description a field gives the
    // schema it refers to, belong to that use of it, so they stay beside it.
    const ref = componentName($ref, document);

    return {
      ...rest,
      $ref: `#/components/schemas/${ref}`,
    };
  }

  return _jsonSchema;
};
