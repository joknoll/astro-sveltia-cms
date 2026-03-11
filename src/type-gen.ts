import { z } from "astro/zod";
import type { EntryCollection } from "@sveltia/cms";
import type { TypeOverrideMap } from "zod-to-ts";
import { createAuxiliaryTypeStore, createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import { frontmatterFormats, sveltiaSchema } from "./schema.js";
import type { SchemaContext } from "./schema.js";

export async function buildCollectionSchema(
  collection: EntryCollection,
): Promise<{ schema: z.ZodType; types: string }> {
  const ctx: SchemaContext = { imageSchemas: [] };
  const schema = sveltiaSchema(collection.fields, {
    excludeBody: frontmatterFormats.has(collection.format),
    ctx,
  });

  const overrides: TypeOverrideMap = new Map(
    ctx.imageSchemas.map((s) => [s, (ts) => ts.factory.createTypeReferenceNode("ImageMetadata")]),
  );

  const auxiliaryTypeStore = createAuxiliaryTypeStore();
  const { node } = zodToTs(schema, {
    auxiliaryTypeStore,
    unrepresentable: "any",
    overrides,
  });
  const typeAlias = createTypeAlias(node, "Entry");
  const importLine =
    ctx.imageSchemas.length > 0 ? 'import type { ImageMetadata } from "astro";\n' : "";
  return { schema, types: `${importLine}export ${printNode(typeAlias)}` };
}
