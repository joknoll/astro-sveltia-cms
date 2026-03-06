import { defineCollection } from "astro:content";
import { sveltiaLoader } from "astro-sveltia-cms/loader";
import { postsCollection } from "./src/collections.ts";

const posts = defineCollection({
  loader: sveltiaLoader(postsCollection),
  // Schema is auto-generated from the Sveltia CMS field definitions:
  //   z.object({
  //     title: z.string(),
  //     date: z.coerce.date(),
  //     draft: z.boolean().optional(),
  //   })
  // The "body" field is excluded (handled by glob loader as document content)
});

export const collections = { posts };
