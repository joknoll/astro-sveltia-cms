import { beforeEach, describe, expect, it, vi } from "vitest";
import { readCmsConfig, resolveCollection, sveltiaLoader } from "../src/loader.ts";
import type { CmsConfig, EntryCollection } from "@sveltia/cms";

describe("resolveCollection", () => {
  const postsCollection: EntryCollection = {
    name: "posts",
    folder: "src/content/posts",
    fields: [
      { name: "title", widget: "string" },
      { name: "date", widget: "datetime" },
    ],
  };

  const pagesCollection: EntryCollection = {
    name: "pages",
    folder: "src/content/pages",
    fields: [{ name: "title", widget: "string" }],
  };

  const config: CmsConfig = {
    backend: { name: "test-repo" },
    collections: [postsCollection, pagesCollection],
  };

  it("returns the matching EntryCollection by name", () => {
    const result = resolveCollection(config, "posts");
    expect(result).toBe(postsCollection);
  });

  it("returns the correct collection among multiple", () => {
    const result = resolveCollection(config, "pages");
    expect(result).toBe(pagesCollection);
  });

  it("throws when collection name is not found", () => {
    expect(() => resolveCollection(config, "authors")).toThrowError(
      /Collection "authors" not found/,
    );
  });

  it("includes available collection names in error message", () => {
    expect(() => resolveCollection(config, "unknown")).toThrowError(/posts.*pages|pages.*posts/);
  });

  it("throws with '(none)' message when collections array is empty", () => {
    const emptyConfig: CmsConfig = {
      backend: { name: "test-repo" },
      collections: [],
    };
    expect(() => resolveCollection(emptyConfig, "posts")).toThrowError(/\(none\)/);
  });

  it("throws when collections is undefined", () => {
    const noCollections: CmsConfig = { backend: { name: "test-repo" } };
    expect(() => resolveCollection(noCollections, "posts")).toThrowError(
      /Collection "posts" not found/,
    );
  });

  it("throws for a file-based collection (has name but no folder/fields)", () => {
    const fileConfig: CmsConfig = {
      backend: { name: "test-repo" },
      collections: [
        {
          name: "settings",
          files: [{ name: "general", file: "data/general.json", fields: [] }],
        },
      ],
    };
    expect(() => resolveCollection(fileConfig, "settings")).toThrowError(
      /not a folder-based entry collection/,
    );
  });
});

describe("readCmsConfig", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws a descriptive error when file is missing", () => {
    expect(() => readCmsConfig()).toThrowError(/Could not read CMS config/);
  });

  it("error message includes the config path hint", () => {
    expect(() => readCmsConfig()).toThrowError(/astro-loader-sveltia-cms/);
  });

  it("error message tells user to add the integration", () => {
    expect(() => readCmsConfig()).toThrowError(/astro\.config\.mjs/);
  });
});

describe("sveltiaLoader — object form", () => {
  const collection: EntryCollection = {
    name: "posts",
    folder: "src/content/posts",
    fields: [
      { name: "title", widget: "string" },
      { name: "date", widget: "datetime" },
      { name: "draft", widget: "boolean", required: false },
    ],
  };

  it('returns a loader with name "sveltia-cms"', () => {
    const loader = sveltiaLoader(collection);
    expect(loader.name).toBe("sveltia-cms");
  });

  it("returns a loader with a load function", () => {
    const loader = sveltiaLoader(collection);
    expect(typeof loader.load).toBe("function");
  });

  it("has a createSchema function", () => {
    const loader = sveltiaLoader(collection);
    expect(typeof loader.createSchema).toBe("function");
  });

  it("createSchema() returns a schema that validates data matching the fields", async () => {
    const loader = sveltiaLoader(collection);
    const { schema } = await loader.createSchema!();
    const s = schema as { safeParse: (v: unknown) => { success: boolean } };
    expect(s.safeParse({ title: "Hello", date: "2024-01-01" }).success).toBe(true);
    expect(s.safeParse({ date: "2024-01-01" }).success).toBe(false); // missing title
  });

  it("createSchema() excludes body by default (frontmatter format)", async () => {
    const col: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [
        { name: "title", widget: "string" },
        { name: "body", widget: "markdown" },
      ],
    };
    const loader = sveltiaLoader(col);
    const { schema } = await loader.createSchema!();
    const s = schema as unknown as { shape: Record<string, unknown> };
    expect(s.shape).not.toHaveProperty("body");
    expect(s.shape).toHaveProperty("title");
  });

  it("createSchema() includes body when format is not frontmatter", async () => {
    const col: EntryCollection = {
      name: "data",
      folder: "src/data",
      format: "json",
      fields: [
        { name: "name", widget: "string" },
        { name: "body", widget: "markdown" },
      ],
    };
    const loader = sveltiaLoader(col);
    const { schema } = await loader.createSchema!();
    const s = schema as unknown as { shape: Record<string, unknown> };
    expect(s.shape).toHaveProperty("body");
    expect(s.shape).toHaveProperty("name");
  });

  it("uses default extension 'md' when extension is not specified", () => {
    const loader = sveltiaLoader({
      name: "posts",
      folder: "src/posts",
      fields: [],
    });
    expect(loader.name).toBe("sveltia-cms");
    expect(loader.load).toBeDefined();
  });
});

describe("sveltiaLoader — string form", () => {
  it('returns a loader with name "sveltia-cms"', () => {
    const loader = sveltiaLoader("posts");
    expect(loader.name).toBe("sveltia-cms");
  });

  it("returns a loader with a load function", () => {
    const loader = sveltiaLoader("posts");
    expect(typeof loader.load).toBe("function");
  });

  it("has a createSchema function", () => {
    const loader = sveltiaLoader("posts");
    expect(typeof loader.createSchema).toBe("function");
  });

  it("createSchema() throws when config file is missing (no integration setup)", async () => {
    const loader = sveltiaLoader("posts");
    await expect(loader.createSchema!()).rejects.toThrowError(/Could not read CMS config/);
  });

  it("load() throws when config file is missing (no integration setup)", async () => {
    const loader = sveltiaLoader("posts");
    await expect(loader.load({} as never)).rejects.toThrowError(/Could not read CMS config/);
  });
});
