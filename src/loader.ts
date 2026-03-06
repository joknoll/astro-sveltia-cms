import type { Loader } from "astro/loaders";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import type {
  CmsConfig,
  EntryCollection,
  Field,
  SelectFieldValue,
} from "@sveltia/cms";

/**
 * The file formats that use frontmatter (body is separate from data).
 */
const frontmatterFormats = new Set([
  "yaml-frontmatter",
  "toml-frontmatter",
  "json-frontmatter",
  undefined, // default format is yaml-frontmatter
]);

/**
 * Map of collection file extensions to glob patterns.
 * When a collection doesn't specify an extension, the format determines the default.
 */
const formatExtensions: Record<string, string> = {
  yml: "md",
  yaml: "md",
  toml: "md",
  json: "json",
  "yaml-frontmatter": "md",
  "toml-frontmatter": "md",
  "json-frontmatter": "md",
};

/**
 * Check if a field represents the document body content.
 * Body fields are excluded from the Zod schema because the glob loader
 * handles document body separately.
 */
function isBodyField(
  field: Field,
  collection: EntryCollection,
): boolean {
  if (!("widget" in field)) return false;
  const widget = field.widget;
  const isFrontmatter = frontmatterFormats.has(collection.format);
  return (
    isFrontmatter &&
    field.name === "body" &&
    (widget === "markdown" || widget === "richtext")
  );
}

/**
 * Check if a field should be optional in the Zod schema.
 * Sveltia CMS defaults `required` to `true` for visible fields.
 */
function isOptionalField(field: Field): boolean {
  if (!("required" in field)) return false;
  return field.required === false;
}

/**
 * Convert select field options to an array of values.
 */
function getSelectValues(
  options: SelectFieldValue[] | { label: string; value: SelectFieldValue }[],
): SelectFieldValue[] {
  if (options.length === 0) return [];
  if (typeof options[0] === "object" && options[0] !== null && "value" in options[0]) {
    return (options as { label: string; value: SelectFieldValue }[]).map(
      (o) => o.value,
    );
  }
  return options as SelectFieldValue[];
}

/**
 * Create a Zod schema for select field values.
 * Handles string-only enums, and mixed types (string | number | null).
 */
function selectValuesToZod(values: SelectFieldValue[]): z.ZodTypeAny {
  const allStrings = values.every((v) => typeof v === "string");
  if (allStrings && values.length > 0) {
    return z.enum(values as [string, ...string[]]);
  }
  // Mixed types: use union of literals
  if (values.length === 0) return z.any();
  const literals = values.map((v) => {
    if (v === null) return z.null();
    if (typeof v === "number") return z.literal(v);
    return z.literal(v as string);
  });
  if (literals.length === 1) return literals[0];
  return z.union(literals as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

/**
 * Convert a single Sveltia CMS field definition to a Zod schema type.
 * This recursively handles nested fields (object, list).
 */
function fieldToZod(field: Field): z.ZodTypeAny {
  const widget = "widget" in field ? field.widget : "string";

  switch (widget) {
    // Simple string types
    case "string":
    case "text":
    case "color":
    case "map":
    case "uuid":
    case "compute":
      return z.string();

    // Markdown/richtext as standalone data fields (not body)
    case "markdown":
    case "richtext":
      return z.string();

    // Number field
    case "number": {
      const valueType =
        "value_type" in field ? (field as { value_type?: string }).value_type : "int";
      if (valueType === "int/string" || valueType === "float/string") {
        return z.union([z.number(), z.string()]);
      }
      return z.number();
    }

    // Boolean field
    case "boolean":
      return z.boolean();

    // DateTime field
    case "datetime":
      return z.coerce.date();

    // Image and file fields
    case "image":
    case "file": {
      const multiple = "multiple" in field && (field as { multiple?: boolean }).multiple;
      return multiple ? z.array(z.string()) : z.string();
    }

    // Select field
    case "select": {
      const selectField = field as {
        options: SelectFieldValue[] | { label: string; value: SelectFieldValue }[];
        multiple?: boolean;
      };
      const values = getSelectValues(selectField.options);
      const valueSchema = selectValuesToZod(values);
      return selectField.multiple ? z.array(valueSchema) : valueSchema;
    }

    // Relation field
    case "relation": {
      const multiple = "multiple" in field && (field as { multiple?: boolean }).multiple;
      return multiple ? z.array(z.string()) : z.string();
    }

    // KeyValue field
    case "keyvalue":
      return z.record(z.string(), z.string());

    // Code field
    case "code": {
      const codeField = field as {
        output_code_only?: boolean;
        keys?: { code: string; lang: string };
      };
      if (codeField.output_code_only) {
        return z.string();
      }
      const keys = codeField.keys || { code: "code", lang: "lang" };
      return z.object({
        [keys.code]: z.string(),
        [keys.lang]: z.string(),
      });
    }

    // Hidden field - type depends on the default value
    case "hidden": {
      const hiddenField = field as { default?: unknown };
      if (hiddenField.default !== undefined) {
        switch (typeof hiddenField.default) {
          case "string":
            return z.string();
          case "number":
            return z.number();
          case "boolean":
            return z.boolean();
          default:
            return z.any();
        }
      }
      return z.any();
    }

    // Object field - recursive
    case "object": {
      const objectField = field as {
        fields?: Field[];
        types?: Array<{
          name: string;
          fields?: Field[];
        }>;
        typeKey?: string;
      };

      // Variable types (discriminated union)
      if ("types" in objectField && objectField.types) {
        const typeKey = objectField.typeKey || "type";
        const variants = objectField.types.map((variant) => {
          const shape: Record<string, z.ZodTypeAny> = {
            [typeKey]: z.literal(variant.name),
          };
          if (variant.fields) {
            for (const subField of variant.fields) {
              const subSchema = fieldToZod(subField);
              shape[subField.name] = isOptionalField(subField)
                ? subSchema.optional()
                : subSchema;
            }
          }
          return z.object(shape);
        });
        if (variants.length === 0) return z.object({});
        if (variants.length === 1) return variants[0];
        return z.discriminatedUnion(
          typeKey,
          variants as [
            z.ZodObject<Record<string, z.ZodTypeAny>>,
            z.ZodObject<Record<string, z.ZodTypeAny>>,
            ...z.ZodObject<Record<string, z.ZodTypeAny>>[],
          ],
        );
      }

      // Regular object with subfields
      if ("fields" in objectField && objectField.fields) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const subField of objectField.fields) {
          const subSchema = fieldToZod(subField);
          shape[subField.name] = isOptionalField(subField)
            ? subSchema.optional()
            : subSchema;
        }
        return z.object(shape);
      }

      return z.object({});
    }

    // List field - multiple variants
    case "list": {
      const listField = field as {
        field?: Field;
        fields?: Field[];
        types?: Array<{
          name: string;
          fields?: Field[];
        }>;
        typeKey?: string;
      };

      // List with variable types
      if ("types" in listField && listField.types) {
        const typeKey = listField.typeKey || "type";
        const variants = listField.types.map((variant) => {
          const shape: Record<string, z.ZodTypeAny> = {
            [typeKey]: z.literal(variant.name),
          };
          if (variant.fields) {
            for (const subField of variant.fields) {
              const subSchema = fieldToZod(subField);
              shape[subField.name] = isOptionalField(subField)
                ? subSchema.optional()
                : subSchema;
            }
          }
          return z.object(shape);
        });
        if (variants.length === 0) return z.array(z.any());
        if (variants.length === 1) return z.array(variants[0]);
        return z.array(
          z.discriminatedUnion(
            typeKey,
            variants as [
              z.ZodObject<Record<string, z.ZodTypeAny>>,
              z.ZodObject<Record<string, z.ZodTypeAny>>,
              ...z.ZodObject<Record<string, z.ZodTypeAny>>[],
            ],
          ),
        );
      }

      // List with multiple subfields
      if ("fields" in listField && listField.fields) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const subField of listField.fields) {
          const subSchema = fieldToZod(subField);
          shape[subField.name] = isOptionalField(subField)
            ? subSchema.optional()
            : subSchema;
        }
        return z.array(z.object(shape));
      }

      // List with single subfield
      if ("field" in listField && listField.field) {
        return z.array(fieldToZod(listField.field));
      }

      // Simple list (array of strings)
      return z.array(z.string());
    }

    // Unknown/custom widget
    default:
      return z.any();
  }
}

/**
 * Generate a Zod schema from an array of Sveltia CMS field definitions.
 *
 * This can be used standalone when you want to provide your own loader
 * but still auto-generate the schema from Sveltia CMS field definitions.
 *
 * @param fields - Array of Sveltia CMS field definitions
 * @param options - Options for schema generation
 * @param options.excludeBody - Whether to exclude body fields (default: true).
 *   Set to false if your collection doesn't use a frontmatter format.
 * @returns A Zod object schema
 *
 * @example
 * ```ts
 * import { defineCollection } from 'astro:content';
 * import { glob } from 'astro/loaders';
 * import { sveltiaSchema } from 'astro-sveltia-cms/loader';
 *
 * const posts = defineCollection({
 *   loader: glob({ pattern: '**\/*.md', base: './src/content/posts' }),
 *   schema: sveltiaSchema([
 *     { name: 'title', widget: 'string' },
 *     { name: 'date', widget: 'datetime' },
 *     { name: 'body', widget: 'markdown' },
 *   ]),
 * });
 * ```
 */
export function sveltiaSchema(
  fields: Field[],
  options?: {
    /** Whether to exclude body fields from the schema. Default: true. */
    excludeBody?: boolean;
  },
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const excludeBody = options?.excludeBody ?? true;
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    // Skip body fields by default
    if (
      excludeBody &&
      field.name === "body" &&
      "widget" in field &&
      (field.widget === "markdown" || field.widget === "richtext")
    ) {
      continue;
    }

    const schema = fieldToZod(field);
    shape[field.name] = isOptionalField(field) ? schema.optional() : schema;
  }

  return z.object(shape);
}

/**
 * Create an Astro content collection loader from a Sveltia CMS entry collection definition.
 *
 * This wraps Astro's built-in `glob()` loader and auto-generates a Zod schema
 * from the Sveltia CMS field definitions, providing type-safe content collections
 * that stay in sync with your CMS configuration.
 *
 * @param collection - A Sveltia CMS entry collection definition (must have `folder` and `fields`)
 * @returns An Astro Loader object
 *
 * @example
 * ```ts
 * // src/collections.ts - shared between astro.config.mjs and content.config.ts
 * import type { SveltiaEntryCollection } from 'astro-sveltia-cms/loader';
 *
 * export const postsCollection = {
 *   name: 'posts',
 *   folder: 'src/content/posts',
 *   create: true,
 *   fields: [
 *     { label: 'Title', name: 'title', widget: 'string' },
 *     { label: 'Date', name: 'date', widget: 'datetime' },
 *     { label: 'Body', name: 'body', widget: 'markdown' },
 *   ],
 * } satisfies SveltiaEntryCollection;
 * ```
 *
 * ```ts
 * // src/content.config.ts
 * import { defineCollection } from 'astro:content';
 * import { sveltiaLoader } from 'astro-sveltia-cms/loader';
 * import { postsCollection } from './collections';
 *
 * const posts = defineCollection({
 *   loader: sveltiaLoader(postsCollection),
 * });
 *
 * export const collections = { posts };
 * ```
 */
export function sveltiaLoader(collection: EntryCollection): Loader {
  const extension = collection.extension || "md";
  const pattern = `**/*.${extension}`;
  const base = collection.folder;

  const isFrontmatter = frontmatterFormats.has(collection.format);

  // Use glob loader for file loading
  const inner = glob({ pattern, base });

  return {
    ...inner,
    name: "sveltia-cms",
    schema: sveltiaSchema(collection.fields, {
      excludeBody: isFrontmatter,
    }),
  };
}

/**
 * A Sveltia CMS entry collection definition (folder-based collection with `folder` and `fields`).
 * Re-exported from `@sveltia/cms` as `EntryCollection`.
 */
export type SveltiaEntryCollection = EntryCollection;

/**
 * A Sveltia CMS field definition.
 * Re-exported from `@sveltia/cms` as `Field`.
 */
export type SveltiaField = Field;

/**
 * The full Sveltia CMS configuration object.
 * Re-exported from `@sveltia/cms` as `CmsConfig`.
 */
export type SveltiaConfig = CmsConfig;
