import { glob } from "astro/loaders";
import type { Loader } from "astro/loaders";
import { z } from "astro/zod";
import type { CmsConfig, EntryCollection, Field } from "@sveltia/cms";
import { createAuxiliaryTypeStore, createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import { readCmsConfig, resolveCollection } from "./config.js";
import { frontmatterFormats, sveltiaSchema } from "./schema.js";

export { readCmsConfig, resolveCollection } from "./config.js";
export {
  frontmatterFormats,
  isOptionalField,
  getSelectValues,
  selectValuesToZod,
  fieldToZod,
  sveltiaSchema,
} from "./schema.js";

export type SveltiaLoader = Loader;
export type SveltiaEntryCollection = EntryCollection;
export type SveltiaField = Field;
export type SveltiaConfig = CmsConfig;

// Module-level cache: keyed by collection name so multiple sveltiaLoader("posts")
// calls share the same resolved EntryCollection without repeated disk reads.
const collectionCache = new Map<string, EntryCollection>();

function getCachedCollection(name: string): EntryCollection {
  const cached = collectionCache.get(name);
  if (cached) return cached;
  const config = readCmsConfig();
  const collection = resolveCollection(config, name);
  collectionCache.set(name, collection);
  return collection;
}

async function buildSchema(
  collection: EntryCollection,
): Promise<{ schema: z.ZodType; types: string }> {
  const schema = sveltiaSchema(collection.fields, {
    excludeBody: frontmatterFormats.has(collection.format),
  });
  const auxiliaryTypeStore = createAuxiliaryTypeStore();
  const { node } = zodToTs(schema, {
    auxiliaryTypeStore,
    unrepresentable: "any",
  });
  const typeAlias = createTypeAlias(node, "Entry");
  return { schema, types: `export ${printNode(typeAlias)}` };
}

function loaderFromCollection(collection: EntryCollection): Loader {
  const extension = collection.extension ?? "md";
  const inner = glob({ pattern: `**/*.${extension}`, base: collection.folder });

  return {
    name: "sveltia-cms",
    load: (context) => inner.load(context),
    createSchema: () => buildSchema(collection),
  } satisfies Loader;
}

export function sveltiaLoader(collectionOrName: string | EntryCollection): Loader {
  if (typeof collectionOrName !== "string") {
    return loaderFromCollection(collectionOrName);
  }

  const name = collectionOrName;

  return {
    name: "sveltia-cms",
    createSchema: async () => buildSchema(getCachedCollection(name)),
    load: async (context) => loaderFromCollection(getCachedCollection(name)).load(context),
  } satisfies Loader;
}
