import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

const DEV_PAGES_DIR = fileURLToPath(
  new URL("./src/dev-pages/", import.meta.url),
);
const DEV_PAGE_EXT = /\.(astro|md|mdx|ts|js)$/;

/**
 * Serves every file under `src/dev-pages/` at `/dev/<path>`, but only for
 * `astro dev`. `astro build` never sees these routes, so they stay out of
 * production. Restart the dev server after adding a new dev page.
 *
 * @returns {import("astro").AstroIntegration}
 */
function devPages() {
  return {
    name: "dev-pages",
    hooks: {
      "astro:config:setup": ({ command, injectRoute, logger }) => {
        if (command !== "dev") return;
        let files = [];
        try {
          if (!statSync(DEV_PAGES_DIR).isDirectory()) return;
          files = readdirSync(DEV_PAGES_DIR, {
            recursive: true,
            encoding: "utf8",
          });
        } catch {
          return; // no src/dev-pages/ yet
        }
        for (const file of files.map((f) => f.replaceAll("\\", "/")).sort()) {
          if (
            !DEV_PAGE_EXT.test(file) ||
            file.split("/").some((p) => p.startsWith("_"))
          )
            continue;
          const route = file
            .replace(DEV_PAGE_EXT, "")
            .replace(/(^|\/)index$/, "");
          const pattern = route ? `/dev/${route}` : "/dev";
          injectRoute({ pattern, entrypoint: `./src/dev-pages/${file}` });
          logger.info(`dev page ${pattern}`);
        }
      },
    },
  };
}

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: "https://asahikuroki.com",
  output: "static",
  integrations: [react(), devPages()],
  // The dev toolbar would show up in dev-server shots and add focusable
  // buttons to keyboard tests.
  devToolbar: { enabled: false },
  i18n: {
    locales: ["en", "ja"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    // Pre-bundle the 3D stack when the dev server starts, so the first world
    // page load doesn't trigger a dependency re-optimization and full reload.
    optimizeDeps: {
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "three",
        "zustand",
        "@react-three/fiber",
        "@react-three/drei",
        "@react-three/rapier",
        "@react-three/postprocessing",
        "postprocessing",
      ],
    },
  },
});
