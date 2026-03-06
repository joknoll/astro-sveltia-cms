// @ts-check
import { defineConfig } from "astro/config";
import sveltia from "astro-sveltia-cms";
import { postsCollection } from "./src/collections.ts";

// https://astro.build/config
export default defineConfig({
  integrations: [
    sveltia({
      route: "/cms",
      title: "My Custom CMS",
      config: {
        backend: {
          name: "test-repo",
        },
        media_folder: "public/media",

        collections: [postsCollection],
      },
    }),
  ],
});
