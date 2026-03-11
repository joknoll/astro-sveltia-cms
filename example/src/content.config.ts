import { defineCollection } from "astro:content";
import { sveltiaLoader } from "astro-loader-sveltia-cms/loader";

const posts = defineCollection({
  loader: sveltiaLoader("posts"),
});

export const collections = { posts };
