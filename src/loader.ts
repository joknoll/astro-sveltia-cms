import { glob } from "astro/loaders";
import type { CmsConfig, EntryCollection, Field } from "@sveltia/cms";
import { readCmsConfig, resolveCollection } from "./config.js";
import { frontmatterFormats, sveltiaSchema } from "./schema.js";

// Re-export everything so `import { ... } from 'astro-sveltia-cms/loader'` continues
// to work regardless of which sub-module a symbol now lives in.
export { readCmsConfig, resolveCollection } from "./config.js";
export {
  frontmatterFormats,
  isOptionalField,
  getSelectValues,
  selectValuesToZod,
  fieldToZod,
  sveltiaSchema,
} from "./schema.js";

/**
 * Structural type for an Astro content loader.
 *
 * Defined here rather than re-exported from `astro/loaders` to avoid type
 * identity mismatches when consumers have a different astro version installed.
 * `load` uses `any` for its context parameter because `LoaderContext` contains
 * deep Vite/Rollup types that differ between astro versions, causing
 * "excessive stack depth" errors. Astro calls `load()` internally — consumers
 * never construct the context themselves.
 */
export interface SveltiaLoader {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  load: (context: any) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: any;
}

/** Type alias for a Sveltia CMS entry collection. */
export type SveltiaEntryCollection = EntryCollection;

/** Type alias for a Sveltia CMS field definition. */
export type SveltiaField = Field;

/** Type alias for the full Sveltia CMS configuration object. */
export type SveltiaConfig = CmsConfig;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loaderFromCollection(collection: EntryCollection): SveltiaLoader {
  const extension = collection.extension ?? "md";
  const isFrontmatter = frontmatterFormats.has(collection.format);
  const inner = glob({ pattern: `**/*.${extension}`, base: collection.folder });

  return {
    name: "sveltia-cms",
    load: (context) => inner.load(context),
    schema: sveltiaSchema(collection.fields, { excludeBody: isFrontmatter }),
  };
}

/**
 * Resolve config and collection once, then cache the result for reuse across
 * the `schema()` and `load()` calls that Astro makes separately.
 */
function makeLazyCollection(name: string): () => EntryCollection {
  let cached: EntryCollection | undefined;
  return () => {
    if (!cached) {
      const config = readCmsConfig();
      cached = resolveCollection(config, name);
    }
    return cached;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an Astro content collection loader from a Sveltia CMS collection.
 *
 * Accepts either a **collection name** (string) or a full **collection object**.
 *
 * **String form** — looks up the collection from the CMS config passed to the
 * `sveltiaCms()` integration in `astro.config.mjs`. This is the recommended
 * approach: define your collections once in the Astro config and reference
 * them by name in `content.config.ts`.
 *
 * **Object form** — pass an `EntryCollection` object directly. Useful when
 * you want to use the loader independently of the integration, or share
 * collection definitions via a separate module.
 *
 * In both cases, the loader wraps Astro's built-in `glob()` loader and
 * auto-generates a Zod schema from the Sveltia CMS field definitions.
 *
 * @example String form (recommended)
 * ```ts
 * // astro.config.mjs — single source of truth
 * import { defineConfig } from 'astro/config';
 * import sveltiaCms from 'astro-sveltia-cms';
 *
 * export default defineConfig({
 *   integrations: [
 *     sveltiaCms({
 *       config: {
 *         backend: { name: 'github', repo: 'user/repo', branch: 'main' },
 *         collections: [
 *           {
 *             name: 'posts',
 *             folder: 'src/content/posts',
 *             create: true,
 *             fields: [
 *               { label: 'Title', name: 'title', widget: 'string' },
 *               { label: 'Date', name: 'date', widget: 'datetime' },
 *               { label: 'Body', name: 'body', widget: 'markdown' },
 *             ],
 *           },
 *         ],
 *       },
 *     }),
 *   ],
 * });
 * ```
 *
 * ```ts
 * // content.config.ts — just reference by name
 * import { defineCollection } from 'astro:content';
 * import { sveltiaLoader } from 'astro-sveltia-cms/loader';
 *
 * export const collections = {
 *   posts: defineCollection({ loader: sveltiaLoader('posts') }),
 * };
 * ```
 *
 * @example Object form
 * ```ts
 * // content.config.ts
 * import { defineCollection } from 'astro:content';
 * import { sveltiaLoader } from 'astro-sveltia-cms/loader';
 * import type { SveltiaEntryCollection } from 'astro-sveltia-cms/loader';
 *
 * const postsCollection = { ... } satisfies SveltiaEntryCollection;
 *
 * export const collections = {
 *   posts: defineCollection({ loader: sveltiaLoader(postsCollection) }),
 * };
 * ```
 */
export function sveltiaLoader(collectionOrName: string | EntryCollection): SveltiaLoader {
  if (typeof collectionOrName !== "string") {
    return loaderFromCollection(collectionOrName);
  }

  const getCollection = makeLazyCollection(collectionOrName);

  return {
    name: "sveltia-cms",

    schema: () => {
      const collection = getCollection();
      const isFrontmatter = frontmatterFormats.has(collection.format);
      return sveltiaSchema(collection.fields, { excludeBody: isFrontmatter });
    },

    load: async (context) => {
      const collection = getCollection();
      const extension = collection.extension ?? "md";
      const inner = glob({ pattern: `**/*.${extension}`, base: collection.folder });
      return inner.load(context);
    },
  };
}
