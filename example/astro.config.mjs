// @ts-check
import { defineConfig } from "astro/config";
import sveltia from "astro-loader-sveltia-cms";

// https://astro.build/config
export default defineConfig({
  integrations: [
    sveltia({
      // Find docs here https://sveltiacms.app/llms.txt
      route: "/cms",
      title: "My Custom CMS",
      config: {
        backend: {
          name: "github",
          repo: "username/repo",
          branch: "main",
        },

        media_folder: "public/media",

        collections: [
          {
            name: "posts",
            label: "Posts",
            folder: "src/content/posts",
            create: true,
            sortable_fields: ["title", "pubDate"],
            preview_path: "/blog/{{slug}}/",
            preview_path_date_field: "pubDate",
            fields: [
              { label: "Title", name: "title", widget: "string" },
              { label: "Date", name: "date", widget: "datetime" },
              {
                label: "Draft",
                name: "draft",
                widget: "boolean",
                required: false,
              },
              { label: "Body", name: "body", widget: "markdown" },
            ],
          },
        ],
      },
    }),
  ],
});
