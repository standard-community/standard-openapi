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
  /** Uses of an unnamed root, registered after its nested components. */
  rootReferences: OpenAPIV3_1.ReferenceObject[];
  /** The component name of each `$defs`/`definitions` entry that has one. */
  names: Record<string, string>;
  /** The description each named schema gives itself, by component name. */
  descriptions: Record<string, string>;
};

const describeDocument = (jsonSchema: JSONSchema7): SchemaDocument => {
  const { $defs, $id, definitions, ref } = jsonSchema as Record<string, any>;

  const named = Object.entries<any>({ ...definitions, ...$defs }).flatMap(
    ([key, entry]) => {
      const name = entry?.ref ?? entry?.$id;
      return typeof name === "string" ? [{ entry, key, name }] : [];
    },
  );
  const root = ref ?? $id;

  const descriptions = Object.fromEntries(
    [...named, ...(root ? [{ entry: jsonSchema, name: root }] : [])].flatMap(
      ({ entry, name }) =>
        typeof entry?.description === "string"
          ? [[name, entry.description]]
          : [],
    ),
  );

  return {
    descriptions,
    names: Object.fromEntries(named.map(({ key, name }) => [key, name])),
    root,
    rootReferences: [],
  };
};

/** The component a local `$ref` points at, when it's a named schema. */
const namedComponent = ($ref: string, { names, root }: SchemaDocument) => {
  if ($ref === "#") {
    return root;
  }

  const token = /^#\/(?:\$defs|definitions)\/(.+)$/.exec($ref)?.[1];
  // A JSON Pointer token escapes `/` as `~1` and `~` as `~0`, in that order.
  const key = token?.replaceAll("~1", "/").replaceAll("~0", "~");
  return key && Object.hasOwn(names, key) ? names[key] : undefined;
};

/**
 * How a named schema has been described so far, per components object.
 *
 * Vendors copy a schema's metadata, its name included, onto the copy that a
 * field describes, so a named schema arrives with either its own description
 * or the field's, and nothing tells the two apart. While every use agrees, the
 * description is taken to be the schema's own. Once two uses differ, each
 * description belongs to the field that gave it, so it moves beside that
 * field's reference, and the component keeps none.
 */
type Uses = {
  description?: string;
  /** The references returned while the description looked like the schema's. */
  references: OpenAPIV3_1.ReferenceObject[];
  shared: boolean;
};

const usesByComponents = new WeakMap<
  OpenAPIV3_1.ComponentsObject,
  Map<string, Uses>
>();

// Generated names remain movable until callers finish filling components.
const generatedRoots = new WeakMap<
  OpenAPIV3_1.ComponentsObject,
  Map<string, OpenAPIV3_1.ReferenceObject[]>
>();

const freeRootName = (
  components: OpenAPIV3_1.ComponentsObject,
  reserved?: ReadonlySet<string>,
): string => {
  let name = "Root";
  for (
    let suffix = 2;
    Object.hasOwn(components.schemas ?? {}, name) || reserved?.has(name);
    suffix++
  ) {
    name = `Root${suffix}`;
  }
  return name;
};

/** Give an explicit component its name without overwriting an unnamed root. */
const moveGeneratedRoot = (
  id: string,
  components: OpenAPIV3_1.ComponentsObject,
  reserved?: ReadonlySet<string>,
) => {
  const roots = generatedRoots.get(components);
  const references = roots?.get(id);
  if (!references || !components.schemas) return;

  const name = freeRootName(components, reserved);
  components.schemas[name] = components.schemas[id];
  delete components.schemas[id];
  for (const reference of references) {
    reference.$ref = `#/components/schemas/${name}`;
  }
  roots?.delete(id);
  roots?.set(name, references);

  const uses = usesByComponents.get(components);
  const previous = uses?.get(id);
  if (previous) {
    uses?.delete(id);
    uses?.set(name, previous);
  }
};

/**
 * Records a use of the named schema `id` with the description it carries, and
 * returns the reference for it, beside any `siblings`: without the description
 * while every use agrees, and with it once they don't.
 */
const use = (
  id: string,
  description: string | undefined,
  components: OpenAPIV3_1.ComponentsObject,
  siblings: Record<string, unknown> = {},
) => {
  const uses = usesByComponents.get(components) ?? new Map<string, Uses>();
  usesByComponents.set(components, uses);

  const previous = uses.get(id);
  const shared =
    !previous || (previous.shared && previous.description === description);

  // The references returned before the uses disagreed went out without a
  // description, as it looked like the schema's own, so they get it now, and
  // the component, which was given it, no longer has it.
  if (previous?.shared && !shared) {
    if (previous.description !== undefined) {
      previous.references.forEach((reference) => {
        reference.description = previous.description;
      });
    }

    const current = components.schemas?.[id];
    if (current) {
      const { description: _, ...undescribed } =
        current as OpenAPIV3_1.SchemaObject;
      components.schemas = { ...components.schemas, [id]: undescribed };
    }
  }

  const reference: OpenAPIV3_1.ReferenceObject = {
    ...siblings,
    $ref: `#/components/schemas/${id}`,
    ...(!shared && description !== undefined ? { description } : {}),
  };

  // A schema can be used many times, so its references are collected in place
  // rather than copied on every use.
  if (shared && previous) {
    previous.references.push(reference);
  } else {
    uses.set(id, {
      description,
      references: shared ? [reference] : [],
      shared,
    });
  }

  return { reference, shared };
};

const register = (
  id: string,
  schema: OpenAPIV3_1.SchemaObject,
  { components }: ToOpenAPISchemaContext,
): OpenAPIV3_1.ReferenceObject => {
  moveGeneratedRoot(id, components);
  const { description, ...undescribed } = schema;
  const { reference, shared } = use(id, description, components);

  components.schemas = {
    ...components.schemas,
    [id]: shared ? schema : undescribed,
  };

  return reference;
};

export const convertToOpenAPISchema = (
  jsonSchema: JSONSchema7,
  context: ToOpenAPISchemaContext,
): OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject => {
  const document = describeDocument(jsonSchema);
  const names = new Set(Object.values(document.names));
  if (document.root) names.add(document.root);
  for (const name of names) {
    moveGeneratedRoot(name, context.components, names);
  }
  const schema = convert(jsonSchema, context, document);
  if (document.rootReferences.length === 0) {
    return schema;
  }

  // Nested definitions have all been registered, so the generated root name
  // cannot overwrite them or a component from an earlier conversion.
  const name = freeRootName(context.components);
  const reference = register(name, schema, context);
  for (const use of document.rootReferences) {
    use.$ref = reference.$ref;
  }
  const roots = generatedRoots.get(context.components) ?? new Map();
  roots.set(name, [reference, ...document.rootReferences]);
  generatedRoots.set(context.components, roots);
  return reference;
};

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
    "contentSchema",
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

    const names = new Set(lifted.map(([name]) => name));
    for (const name of names) {
      moveGeneratedRoot(name, context.components, names);
    }
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

    return register(ref || $id, component, context);
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
    if ($ref === "#" && !document.root) {
      const reference = { ...rest, $ref };
      document.rootReferences.push(reference);
      return reference;
    }

    const named = namedComponent($ref, document);

    // A bare reference to a named schema uses it as it describes itself, which
    // counts towards whether that description is the schema's own.
    if (named && rest.description === undefined) {
      return use(named, document.descriptions[named], context.components, rest)
        .reference;
    }

    return {
      ...rest,
      $ref: `#/components/schemas/${named ?? $ref.split("/").pop()}`,
    };
  }

  return _jsonSchema;
};
