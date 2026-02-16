import type { AstroIntegration } from "astro";

// Define a minimal CmsConfig type since the upstream package doesn't export types correctly
export type CmsConfig = Record<string, any>;

export type SveltiaOptions = {
  /**
   * The route where the CMS will be served.
   * @default "/admin"
   */
  adminRoute?: string;
  /**
   * The page title for the CMS admin interface.
   * @default "Content Management"
   */
  adminTitle?: string;
  /**
   * The Sveltia CMS configuration object.
   */
  config: CmsConfig;
};

export default function sveltiaCms(options: SveltiaOptions): AstroIntegration {
  const adminRoute = options.adminRoute || "/admin";
  const adminTitle = options.adminTitle || "Content Management";
  const virtualModuleId = "virtual:astro-sveltia-cms/config";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "astro-sveltia-cms",
    hooks: {
      "astro:config:setup": ({ injectRoute, updateConfig, logger }) => {
        // Inject the admin page route
        injectRoute({
          pattern: adminRoute,
          entrypoint: new URL("./admin.astro", import.meta.url),
        });

        // Register the virtual module plugin
        updateConfig({
          vite: {
            plugins: [
              {
                name: "vite-plugin-astro-sveltia-cms-config",
                resolveId(id) {
                  if (id === virtualModuleId) {
                    return resolvedVirtualModuleId;
                  }
                },
                load(id) {
                  if (id === resolvedVirtualModuleId) {
                    return `
                      export const config = ${JSON.stringify(options.config)};
                      export const title = ${JSON.stringify(adminTitle)};
                    `;
                  }
                },
              },
            ],
          },
        });

        logger.info(`Sveltia CMS injected at ${adminRoute}`);
      },
    },
  };
}
