// Headless Chromium with working WebGL, for shots and test scripts.
//
// Playwright is NOT a project dependency: the cloud image ships it globally
// with a matching browser. `createRequire` resolves it through NODE_PATH,
// which ESM `import` ignores.

import { createRequire } from "node:module";

/** Viewports from overview § 10. Mobile emulates a phone: touch, coarse pointer. */
export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

/** @returns {typeof import("playwright")} */
export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require("playwright");
  } catch (error) {
    throw new Error(
      "Playwright isn't available. It's preinstalled globally in the cloud image " +
        "(found through NODE_PATH); don't add it to package.json.\n" +
        String(error),
    );
  }
}

/**
 * Resolves `desktop`, `mobile` or `WxH` into Playwright context options.
 * @param {string} name
 */
export function contextOptionsFor(name = "desktop") {
  if (name in VIEWPORTS)
    return structuredClone(
      VIEWPORTS[/** @type {keyof typeof VIEWPORTS} */ (name)],
    );
  const m = /^(\d+)x(\d+)$/.exec(name);
  if (!m)
    throw new Error(`Unknown viewport "${name}". Use desktop, mobile or WxH.`);
  return {
    viewport: { width: Number(m[1]), height: Number(m[2]) },
    deviceScaleFactor: 1,
  };
}

/** Renders a WebGL2 clear color and reads it back: true if the pixel isn't black. */
async function webglWorks(browser) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 4;
      const gl = canvas.getContext("webgl2");
      if (!gl) return false;
      gl.clearColor(1, 0.5, 0.25, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px[0] + px[1] + px[2] > 0;
    });
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

/**
 * Launches Chromium and checks that WebGL draws non-black pixels; if it
 * doesn't, relaunches with `--enable-unsafe-swiftshader` (software WebGL).
 * @param {{ log?: (msg: string) => void }} [options]
 * @returns {Promise<{ browser: import("playwright").Browser, webgl: boolean, args: string[] }>}
 */
export async function launchBrowser({ log = () => {} } = {}) {
  const { chromium } = loadPlaywright();
  const attempts = [
    [],
    ["--enable-unsafe-swiftshader"],
    ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  ];
  for (const args of attempts) {
    const browser = await chromium.launch({ args });
    if (await webglWorks(browser)) {
      log(
        `Chromium ${browser.version()}, WebGL OK${args.length ? ` with ${args.join(" ")}` : ""}`,
      );
      return { browser, webgl: true, args };
    }
    await browser.close();
  }
  log(
    "WARNING: WebGL draws nothing in this Chromium; world shots will be blank.",
  );
  const browser = await chromium.launch({ args: attempts[1] });
  return { browser, webgl: false, args: attempts[1] };
}

/**
 * Collects console errors and page errors from a page.
 * @param {import("playwright").Page} page
 */
export function collectErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/**
 * Waits until the world is ready (WP-03 sets `window.__worldReady`), or until
 * the page has fallen back to Classic view.
 * @param {import("playwright").Page} page
 * @param {number} timeoutMs
 * @returns {Promise<"ready" | "fell back" | "timeout">}
 */
export async function waitForWorld(page, timeoutMs = 60_000) {
  try {
    const handle = await page.waitForFunction(
      () =>
        window.__worldReady === true
          ? "ready"
          : window.__ashBoot?.mode === "classic"
            ? "fell back"
            : false,
      null,
      { timeout: timeoutMs, polling: 100 },
    );
    return /** @type {"ready" | "fell back"} */ (await handle.jsonValue());
  } catch {
    return "timeout";
  }
}
