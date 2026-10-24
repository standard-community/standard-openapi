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

/**
 * The keywords a vendor names a schema with: `ref`, `$id`, or `id`, which is
 * where Zod 4 writes the name given with `.meta({ id })`.
 */
const nameKeywords = ["ref", "$id", "id"] as const;

const nameOf = (schema: unknown): string | undefined =>
  nameKeywords
    .map(
      (keyword) => (schema as Record<string, unknown> | undefined)?.[keyword],
    )
    .find((name): name is string => typeof name === "string" && name !== "");

const describeDocument = (jsonSchema: JSONSchema7): SchemaDocument => {
  const { $defs, definitions } = jsonSchema as Record<string, any>;

  const named = Object.entries<any>({ ...definitions, ...$defs }).flatMap(
    ([key, entry]) => {
      const name = nameOf(entry);
      return name ? [{ entry, key, name }] : [];
    },
  );
  const root = nameOf(jsonSchema);

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

/** Keywords whose value is a schema, or an array or a map of schemas. */
const subschemaKeywords = [
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

const schemaMapKeywords = new Set<string>([
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
]);

/**
 * `schema` with each of its direct subschemas replaced by what `map` returns
 * for it, visited in keyword order. Every other keyword, such as `const` or
 * `examples`, holds data rather than schemas, and is left as it is.
 */
const mapSubschemas = (
  schema: Record<string, any>,
  map: (subschema: any) => unknown,
) => ({
  ...schema,
  ...Object.fromEntries(
    subschemaKeywords
      .filter(
        (keyword) => schema[keyword] && typeof schema[keyword] === "object",
      )
      .map((keyword) => {
        const value = schema[keyword];
        if (schemaMapKeywords.has(keyword)) {
          return [
            keyword,
            Object.fromEntries(
              Object.entries(value).map(([key, entry]) => [key, map(entry)]),
            ),
          ];
        }
        return [keyword, Array.isArray(value) ? value.map(map) : map(value)];
      }),
  ),
});

/** What a root's references to itself are written as when comparing roots. */
const SELF = "#self";

/**
 * `schema` with its references to the root, `self`, written as `SELF`. Only
 * subschemas are visited, so data that looks like a reference, in a `const`
 * say, still tells two roots apart.
 */
const withSelf = (schema: unknown, self: string): unknown => {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  const { $ref } = schema as OpenAPIV3_1.ReferenceObject;
  return mapSubschemas(
    $ref === self ? { ...schema, $ref: SELF } : schema,
    (subschema) => withSelf(subschema, self),
  );
};

/**
 * A root schema as text, with its references to itself written the same way
 * whatever it's named, and without its description, which each use of it
 * carries on its own.
 */
const rootShape = (schema: unknown, self: string) => {
  const { description: _, ...rest } = schema as OpenAPIV3_1.SchemaObject;
  return JSON.stringify(withSelf(rest, self));
};

/**
 * The generated root that already holds `schema`, an unnamed root whose
 * references to itself are still `#`. Converting the same schema again, for
 * another route say, gives the same content, while a conversion that differs,
 * as the other direction can with a default, doesn't match.
 */
const matchingRoot = (
  schema: OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject,
  components: OpenAPIV3_1.ComponentsObject,
) => {
  const shape = rootShape(schema, "#");
  return [...(generatedRoots.get(components)?.keys() ?? [])].find(
    (name) =>
      Object.hasOwn(components.schemas ?? {}, name) &&
      rootShape(components.schemas?.[name], `#/components/schemas/${name}`) ===
        shape,
  );
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

/**
 * A copy of a schema that converting can change in place. Like a round trip
 * through JSON, it leaves out functions and copies an object used in several
 * places once per place, but it keeps values JSON can't hold, like `Infinity`.
 */
const copy = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(copy);
  }

  const prototype =
    typeof value === "object" && value !== null
      ? Object.getPrototypeOf(value)
      : undefined;
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as object).flatMap(([key, entry]) =>
      typeof entry === "function" ? [] : [[key, copy(entry)]],
    ),
  );
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
  // Copied once here, as converting changes each subschema in place.
  const schema = convert(copy(jsonSchema) as JSONSchema7, context, document);
  if (document.rootReferences.length === 0) {
    return schema;
  }

  // The same unnamed schema converted again reuses its component rather than
  // adding an identical one. Its description is a use's like any other, so
  // `use` keeps it on the component while every use agrees on it. Nested
  // definitions have all been registered, so a generated root name cannot
  // overwrite them or a component from an earlier conversion.
  const existing = matchingRoot(schema, context.components);
  const name = existing ?? freeRootName(context.components);
  const reference = existing
    ? use(
        existing,
        (schema as OpenAPIV3_1.SchemaObject).description,
        context.components,
      ).reference
    : register(name, schema, context);

  // The references to the root, those in named definitions included, are still
  // `#`, whether its component is new or reused.
  for (const use of document.rootReferences) {
    use.$ref = reference.$ref;
  }
  const roots = generatedRoots.get(context.components) ?? new Map();
  roots.set(name, [
    ...(roots.get(name) ?? []),
    reference,
    ...document.rootReferences,
  ]);
  generatedRoots.set(context.components, roots);
  return reference;
};

/**
 * Keywords that describe a schema rather than restrict the values it accepts,
 * along with the definitions it carries and the name vendors give it.
 */
const annotationKeywords = new Set([
  "$comment",
  "$defs",
  "$id",
  "$schema",
  "default",
  "definitions",
  "deprecated",
  "description",
  "example",
  "examples",
  "externalDocs",
  "id",
  "readOnly",
  "ref",
  "title",
  "writeOnly",
  "xml",
]);

const isAnnotation = (keyword: string) =>
  annotationKeywords.has(keyword) || keyword.startsWith("x-");

// Keywords that apply to values of every type, so `null` has to satisfy them
// too, whatever `type` says.
const typeIndependentKeywords = [
  "$ref",
  "allOf",
  "anyOf",
  "const",
  "if",
  "not",
  "oneOf",
];

/**
 * Turns OpenAPI 3.0's `nullable` into the JSON Schema that OpenAPI 3.1 uses.
 * When only `type` and `enum` can reject `null`, `null` joins whichever of them
 * the schema has; with neither, it accepts `null` already. Otherwise the
 * schema's restrictions become one alternative and `null` the other, and its
 * annotations stay on the whole.
 */
const withoutNullable = ({ nullable, ...schema }: Record<string, any>) => {
  if (nullable !== true) {
    return schema;
  }

  // Apart from `type` and `enum`, every keyword left applies to values of one
  // type only, so `null` passes it.
  if (
    !typeIndependentKeywords.some((keyword) => Object.hasOwn(schema, keyword))
  ) {
    const types = schema.type === undefined ? [] : [schema.type].flat();
    return {
      ...schema,
      ...(Array.isArray(schema.enum) && !schema.enum.includes(null)
        ? { enum: [...schema.enum, null] }
        : {}),
      ...(types.length > 0 && !types.includes("null")
        ? { type: [...types, "null"] }
        : {}),
    };
  }

  const entries = Object.entries(schema);
  const restrictions = entries.filter(([keyword]) => !isAnnotation(keyword));

  return {
    ...Object.fromEntries(entries.filter(([keyword]) => isAnnotation(keyword))),
    anyOf: [Object.fromEntries(restrictions), { type: "null" }],
  };
};

/**
 * Replaces each member of an `allOf` or `anyOf` that holds nothing but the
 * same keyword with that keyword's members, as both mean the same side by side.
 * A member with anything beside it, such as its own description or a `$ref`,
 * keeps its place.
 * `oneOf` stays nested: a value matching every member of
 * `{ oneOf: [{ oneOf: [a, b] }, c] }` is accepted, but `{ oneOf: [a, b, c] }`
 * rejects it.
 */
const flatten = (keyword: string, members: unknown[]) => {
  if (keyword !== "allOf" && keyword !== "anyOf") {
    return members;
  }

  return members.flatMap((member) => {
    if (typeof member !== "object" || member === null) {
      return [member];
    }

    const nested = (member as Record<string, unknown>)[keyword];
    return Array.isArray(nested) &&
      nested.length > 0 &&
      Object.keys(member).length === 1
      ? nested
      : [member];
  });
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

  const _jsonSchema = withoutNullable(jsonSchema as Record<string, any>);

  // Remove $schema reference if present
  if (_jsonSchema.$schema) {
    delete _jsonSchema.$schema;
  }

  // Draft-07's `dependencies` was split in JSON Schema 2020-12, the dialect of
  // OpenAPI 3.1, into `dependentSchemas` for schema values and
  // `dependentRequired` for property lists, and a 3.1 validator ignores it.
  // Rewriting it keeps what it says, and its schemas are converted below.
  const { dependencies } = _jsonSchema;
  if (dependencies && typeof dependencies === "object") {
    const entries = Object.entries<unknown>(dependencies);
    const lists = entries.filter(([, value]) => Array.isArray(value));
    const schemas = entries.filter(([, value]) => !Array.isArray(value));
    if (schemas.length > 0) {
      _jsonSchema.dependentSchemas = {
        ...Object.fromEntries(schemas),
        ..._jsonSchema.dependentSchemas,
      };
    }
    if (lists.length > 0) {
      _jsonSchema.dependentRequired = {
        ...Object.fromEntries(lists),
        ..._jsonSchema.dependentRequired,
      };
    }
    delete _jsonSchema.dependencies;
  }

  // Recursively process nested schemas
  Object.assign(
    _jsonSchema,
    mapSubschemas(_jsonSchema, (subschema) =>
      convert(subschema, context, document),
    ),
  );
  // Members have been converted recursively before the wrappers are flattened.
  for (const keyword of ["allOf", "anyOf"]) {
    const members = _jsonSchema[keyword];
    if (Array.isArray(members)) {
      _jsonSchema[keyword] = flatten(keyword, members);
    }
  }

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

  // If a name is provided, use it to create a $ref in the OpenAPI components
  const name = nameOf(_jsonSchema);
  if (name) {
    const component = Object.fromEntries(
      Object.entries(_jsonSchema).filter(
        ([keyword]) => !(nameKeywords as readonly string[]).includes(keyword),
      ),
    );

    return register(name, component, context);
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
