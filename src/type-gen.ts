import { z } from "astro/zod";
import type { EntryCollection } from "@sveltia/cms";
import type { TypeOverrideMap } from "zod-to-ts";
import { createAuxiliaryTypeStore, createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import { frontmatterFormats, sveltiaSchema } from "./schema.js";
import type { SchemaContext } from "./schema.js";
import type { InferCollectionOutput } from "./infer.js";

type TypeOverrideFunction = TypeOverrideMap extends Map<unknown, infer V> ? V : never;

const imageOverride: TypeOverrideFunction = (typescript) =>
  typescript.factory.createTypeReferenceNode("ImageMetadata");

function relationOverride(collectionName: string): TypeOverrideFunction {
  return (typescript) =>
    typescript.factory.createTypeLiteralNode([
      typescript.factory.createPropertySignature(
        undefined,
        typescript.factory.createIdentifier("collection"),
        undefined,
        typescript.factory.createLiteralTypeNode(
          typescript.factory.createStringLiteral(collectionName),
        ),
      ),
      typescript.factory.createPropertySignature(
        undefined,
        typescript.factory.createIdentifier("id"),
        undefined,
        typescript.factory.createKeywordTypeNode(typescript.SyntaxKind.StringKeyword),
      ),
    ]);
}

/**
 * Build a Zod schema and TypeScript type string for a Sveltia CMS collection.
 *
 * When the collection is defined with preserved literal types (via a
 * `const` generic parameter or `as const`), the returned schema carries
 * the inferred output type — enabling downstream type safety without a
 * manually maintained type map.
 *
 * @example
 * ```ts
 * function defineCollection<const C extends EntryCollection>(c: C) { return c; }
 * const authors = defineCollection({ name: "authors", folder: "...", fields: [...] });
 * const { schema } = await buildCollectionSchema(authors);
 * // schema is typed as z.ZodType<{ name: string; bio?: string; ... }>
 * ```
 */
export async function buildCollectionSchema<const C extends EntryCollection>(
  collection: C,
): Promise<{ schema: z.ZodType<InferCollectionOutput<C>>; types: string }> {
  const ctx: SchemaContext = {
    imageSchemas: [],
    relationSchemas: new Map(),
  };
  const schema = sveltiaSchema(collection.fields, {
    excludeBody: frontmatterFormats.has(collection.format),
    ctx,
  });

  const overrides: TypeOverrideMap = new Map();
  for (const s of ctx.imageSchemas) {
    overrides.set(s, imageOverride);
  }
  for (const [s, collectionName] of ctx.relationSchemas) {
    overrides.set(s, relationOverride(collectionName));
  }

  const auxiliaryTypeStore = createAuxiliaryTypeStore();
  const { node } = zodToTs(schema, {
    auxiliaryTypeStore,
    unrepresentable: "any",
    overrides,
  });
  const typeAlias = createTypeAlias(node, "Entry");
  const importLine =
    ctx.imageSchemas.length > 0 ? 'import type { ImageMetadata } from "astro";\n' : "";
  // The runtime schema is correctly typed by z.object() but its return type
  // is ZodObject<Record<string, ZodType>> which doesn't carry the inferred
  // output shape. The cast bridges the gap — InferCollectionOutput<C> mirrors
  // exactly what fieldToZod() produces for each field widget type.
  return {
    schema: schema as unknown as z.ZodType<InferCollectionOutput<C>>,
    types: `${importLine}export ${printNode(typeAlias)}`,
  };
}
