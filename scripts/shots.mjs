#!/usr/bin/env node
// Screenshots (overview § 10). Writes shots/<name>.png.
//
//   npm run shots                           the standard set (see STANDARD_SET)
//   npm run shots -- --url "/?view=world&shot=start" --name start
//   npm run shots -- --url "/" --name classic-nojs --no-js
//
// Options:
//   --url <path|url>       page to shoot; a path is resolved against the server
//   --name <name>          output file shots/<name>.png (default: from the URL)
//   --viewport <v>         desktop (1440×900, default), mobile (390×844, touch) or WxH
//   --no-js                disable JavaScript
//   --base <url>           use an already-running server instead of starting one
//   --server dev|preview   which server to start when there's no --base (default dev;
//                          preview serves the existing dist/)
//   --timeout <s>          how long to wait for window.__worldReady (default 60)
//   --wait <ms>            extra pause before the screenshot
//   --full-page            capture the whole page (default for Classic pages)
//   --no-full-page         capture the viewport only (default for world pages)
//   --reduced-motion       emulate prefers-reduced-motion: reduce
//   --help
//
// World URLs (?view=world) wait for window.__worldReady, which WP-03 sets once
// the models are loaded and the shot is placed. A world shot that can't render
// yet (no models, or the ready flag never comes) is "pending", not a failure.
// Everything else waits for `load` and network idle. Exits non-zero only when
// a shot fails.

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "./lib/args.mjs";
import {
  collectErrors,
  contextOptionsFor,
  launchBrowser,
  waitForWorld,
} from "./lib/browser.mjs";
import { ROOT, startServer } from "./lib/server.mjs";

/** World shots from overview § 6.2. */
const WORLD_SHOTS = [
  "establish",
  "start",
  "vending",
  "konbini",
  "gate",
  "bell",
  "tower-base",
  "deck",
];

/** @typedef {{ url: string, name: string, viewport?: string, js?: boolean, needsModels?: boolean }} Shot */

/** @type {Shot[]} */
const STANDARD_SET = [
  { url: "/?view=classic", name: "classic-en-desktop", viewport: "desktop" },
  { url: "/?view=classic", name: "classic-en-mobile", viewport: "mobile" },
  { url: "/ja/?view=classic", name: "classic-ja-desktop", viewport: "desktop" },
  { url: "/ja/?view=classic", name: "classic-ja-mobile", viewport: "mobile" },
  ...WORLD_SHOTS.map((shot) => ({
    url: `/?view=world&shot=${shot}`,
    name: shot,
    needsModels: true,
  })),
];

const SHOTS_DIR = join(ROOT, "shots");

function usage() {
  return (
    "Usage: npm run shots -- [--url <path>] [--name <name>] [--viewport desktop|mobile|WxH] [--no-js]\n" +
    "       [--base <url>] [--server dev|preview] [--timeout <s>] [--wait <ms>] [--full-page|--no-full-page]\n" +
    "       [--reduced-motion]\n" +
    "With no --url, runs the standard set: Classic EN and JA at both viewports, plus the world shots\n" +
    `(${WORLD_SHOTS.join(", ")}).`
  );
}

function slug(url) {
  const u = new URL(url, "http://x");
  const s = (u.pathname + u.search)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return s || "root";
}

function isWorldUrl(url) {
  return new URL(url, "http://x").searchParams.get("view") === "world";
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    boolean: ["help", "full-page", "reduced-motion"],
  });
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const timeoutMs = Number(args.timeout ?? 60) * 1000;
  const waitMs = Number(args.wait ?? 0);

  /** @type {Shot[]} */
  let shots;
  if (typeof args.url === "string") {
    const viewport =
      typeof args.viewport === "string" ? args.viewport : "desktop";
    const js = args.js !== false;
    const name =
      typeof args.name === "string"
        ? args.name
        : [slug(args.url), viewport !== "desktop" && viewport, !js && "nojs"]
            .filter(Boolean)
            .join("-");
    shots = [{ url: args.url, name, viewport, js }];
  } else {
    shots = STANDARD_SET;
  }
  for (const shot of shots) contextOptionsFor(shot.viewport); // validate early

  mkdirSync(SHOTS_DIR, { recursive: true });
  const log = (/** @type {string} */ msg) => console.log(msg);

  /** @type {{ name: string, status: "ok" | "pending" | "failed", note: string, errors: string[] }[]} */
  const results = [];

  const hasModels = existsSync(join(ROOT, "public/models/street.glb"));
  const runnable = shots.filter((s) => !(s.needsModels && !hasModels));
  for (const s of shots) {
    if (s.needsModels && !hasModels) {
      results.push({
        name: s.name,
        status: "pending",
        note: "public/models/street.glb isn't built yet (WP-02)",
        errors: [],
      });
    }
  }

  if (runnable.length > 0) {
    const server =
      typeof args.base === "string"
        ? { base: args.base.replace(/\/$/, ""), stop: async () => {} }
        : await startServer({
            mode: args.server === "preview" ? "preview" : "dev",
          });
    if (typeof args.base !== "string")
      log(
        `Started astro ${args.server === "preview" ? "preview" : "dev"} at ${server.base}`,
      );
    const { browser } = await launchBrowser({ log });
    try {
      for (const shot of runnable) {
        results.push(
          await takeShot(browser, server.base, shot, {
            timeoutMs,
            waitMs,
            args,
          }),
        );
        const r = results[results.length - 1];
        log(`${r.status.padEnd(7)} ${r.name}: ${r.note}`);
      }
    } finally {
      await browser.close();
      await server.stop();
    }
  }

  // Report
  console.log("\nshot                     status   note");
  for (const name of shots.map((s) => s.name)) {
    const r = results.find((x) => x.name === name);
    if (!r) continue;
    console.log(`${r.name.padEnd(24)} ${r.status.padEnd(8)} ${r.note}`);
    for (const e of r.errors) console.log(`${"".padEnd(33)}! ${e}`);
  }
  const failed = results.filter((r) => r.status === "failed").length;
  const pending = results.filter((r) => r.status === "pending").length;
  console.log(
    `\n${results.length - failed - pending} ok, ${pending} pending, ${failed} failed`,
  );
  return failed > 0 ? 1 : 0;
}

/**
 * @param {import("playwright").Browser} browser
 * @param {string} base
 * @param {Shot} shot
 * @param {{ timeoutMs: number, waitMs: number, args: Record<string, any> }} options
 */
async function takeShot(browser, base, shot, { timeoutMs, waitMs, args }) {
  const url = new URL(shot.url, base + "/").href;
  const js = shot.js !== false;
  const world = js && isWorldUrl(url);
  const fullPage =
    args["full-page"] === true
      ? true
      : args["full-page"] === false
        ? false
        : !world;
  const context = await browser.newContext({
    ...contextOptionsFor(shot.viewport),
    javaScriptEnabled: js,
    reducedMotion: args["reduced-motion"] ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const errors = collectErrors(page);
  const file = join(SHOTS_DIR, `${shot.name}.png`);
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    let status = /** @type {"ok" | "pending" | "failed"} */ ("ok");
    let note = `shots/${shot.name}.png`;
    if (world) {
      const state = await waitForWorld(page, timeoutMs);
      if (state === "fell back") {
        const boot = await page.evaluate(() => window.__ashBoot);
        status = "failed";
        note = `world fell back to Classic view (${JSON.stringify(boot)}); saved what was on screen`;
      } else if (state === "timeout") {
        status = "pending";
        note = `window.__worldReady not set within ${timeoutMs / 1000} s; saved what was on screen`;
      }
    } else {
      // Load lazy images, so full-page shots show everything.
      await page.evaluate(() => {
        for (const img of document.querySelectorAll("img[loading=lazy]"))
          img.loading = "eager";
      });
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {});
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
    }
    if (waitMs > 0) await page.waitForTimeout(waitMs);
    await page.screenshot({ path: file, fullPage });
    return { name: shot.name, status, note, errors };
  } catch (error) {
    return {
      name: shot.name,
      status: "failed",
      note: String(error).split("\n")[0],
      errors,
    };
  } finally {
    await context.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
