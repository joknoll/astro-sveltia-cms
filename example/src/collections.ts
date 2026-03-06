// @ts-check
import type { SveltiaEntryCollection } from "astro-sveltia-cms/loader";

/**
 * Shared collection definitions.
 * Used by both the Sveltia CMS integration (astro.config.mjs)
 * and the Astro content layer (content.config.ts).
 */
export const postsCollection = {
  name: "posts",
  label: "Posts",
  folder: "src/content/posts",
  create: true,
  fields: [
    { label: "Title", name: "title", widget: "string" },
    { label: "Date", name: "date", widget: "datetime" },
    { label: "Draft", name: "draft", widget: "boolean", required: false },
    { label: "Body", name: "body", widget: "markdown" },
  ],
} satisfies SveltiaEntryCollection;
