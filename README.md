# @joknoll/astro-sveltia-cms

Sveltia CMS integration for Astro.
Serves the [Sveltia CMS](https://sveltiacms.app) admin UI
and provides a content loader for Astro's content collections,
including automatic Zod schema generation derived fromt the CMS field definitions.

## Installation

```bash
npm install @joknoll/astro-sveltia-cms
# or
bun add @joknoll/astro-sveltia-cms
```

## Quick Start

**`astro.config.mjs`** — register the integration:

```js
import { defineConfig } from "astro/config";
import sveltia from "@joknoll/astro-sveltia-cms";

export default defineConfig({
  integrations: [
    sveltia({
      config: {
        backend: {
          name: "github",
          repo: "my-org/my-site",
          branch: "main",
        },
        media_folder: "public/images",
        collections: [
          {
            name: "posts",
            folder: "src/content/posts",
            fields: [
              { name: "title", widget: "string" },
              { name: "date", widget: "datetime" },
              { name: "draft", widget: "boolean", required: false },
              { name: "body", widget: "markdown" },
            ],
          },
        ],
      },
    }),
  ],
});
```

**`src/content/config.ts`** - use the content loader:

```ts
import { defineCollection } from "astro:content";
import { sveltiaLoader } from "@joknoll/astro-sveltia-cms/loader";

export const collections = {
  posts: defineCollection({
    loader: sveltiaLoader("posts"),
  }),
};
```

**`src/pages/blog/[slug].astro`** - query the collection:

```astro
---
import { getCollection, render } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---

<h1>{post.data.title}</h1>
<Content />
```

---

## Integration Options

```ts
sveltia({
  route?: string,   // URL path for the CMS admin UI. Defaults to "/admin".
  title?: string,   // Browser tab title for the admin UI. Defaults to "Sveltia CMS".
  config: CmsConfig // Full Sveltia CMS configuration object (required).
})
```

The `config` object is passed directly to `CMS.init()`.
`load_config_file` is automatically set to `false` since the config is provided programmatically.

---

## Backend Configuration

The `config.backend` property determines where your content is stored. Sveltia CMS supports various Git-based backends and a local development backend.

### GitHub

```js
backend: {
  name: "github",
  repo: "username/repo",
  branch: "main",
}
```

### Gitea / Codeberg

```js
backend: {
  name: "gitea",
  repo: "username/repo",
  base_url: "https://codeberg.org",
  api_root: "https://codeberg.org/api/v1",
}
```

For all backend options including local development and authentication, see the
[Sveltia CMS Backend Documentation](https://sveltiacms.app/en/docs/backends).
