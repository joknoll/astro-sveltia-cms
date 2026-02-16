# astro-sveltia-cms

Sveltia CMS integration for Astro.

## Installation

```bash
npm install astro-sveltia-cms @sveltia/cms
```

## Usage

In your `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import sveltia from "astro-sveltia-cms";

export default defineConfig({
  integrations: [
    sveltia({
      route: "/cms", // Optional, defaults to "/admin"
      title: "My CMS", // Optional, defaults to "Sveltia CMS"
      config: {
        load_config_file: false,
        backend: {
          name: "github",
          repo: "my/repo",
          branch: "main",
        },
        media_folder: "public/images",
        collections: [
          // ... your collections
        ],
      },
    }),
  ],
});
```

This will serve the Sveltia CMS admin interface at `/cms` (or `/admin` by default).
The configuration object is passed directly to `CMS.init()`.

## TypeScript

You can import `CmsConfig` from `@sveltia/cms` to type your configuration (if supported by your version of Sveltia CMS).

```ts
import type { CmsConfig } from "@sveltia/cms";

const config: CmsConfig = { ... };
```
