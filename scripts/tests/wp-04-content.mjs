#!/usr/bin/env node
// WP-04 acceptance checks for the site content (docs/spec/wp-04-content.md).
// Node 22 strips the TypeScript types of site.ts itself.
//
//   node scripts/tests/wp-04-content.mjs            content rules and images
//   node scripts/tests/wp-04-content.mjs --links    also check external links (curl)
//   node scripts/tests/wp-04-content.mjs --browser  also load Classic view in Chromium
//   node scripts/tests/wp-04-content.mjs --shots    --browser, plus full-page shots
//                                                   shots/wp-04-classic-<lang>-<viewport>.png
//
// --browser and --shots start this project's own dev server
// (scripts/lib/server.mjs) and stop it afterwards.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parseArgs } from "../lib/args.mjs";
import { ROOT } from "../lib/server.mjs";
import { site } from "../../src/content/site.ts";

const args = parseArgs(process.argv.slice(2), {
  boolean: ["links", "browser", "shots"],
});
const requireFromRoot = createRequire(join(ROOT, "package.json"));

let failed = 0;
let skipped = 0;
/** A check that can't run in this environment: reported, but not a failure. */
class Skip extends Error {}
async function check(name, fn) {
  try {
    const note = await fn();
    console.log(`PASS  ${name}${note ? `\n      ${note}` : ""}`);
  } catch (error) {
    if (error instanceof Skip) {
      skipped++;
      console.log(`SKIP  ${name}\n      ${error.message}`);
      return;
    }
    failed++;
    console.log(
      `FAIL  ${name}\n      ${String(error?.message ?? error)
        .split("\n")
        .join("\n      ")}`,
    );
  }
}

/** Every object whose keys are exactly en and ja is an `L` value. */
function* lValues(node, path = "site") {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++)
      yield* lValues(node[i], `${path}[${i}]`);
  } else if (node && typeof node === "object") {
    const keys = Object.keys(node).sort().join(",");
    if (keys === "en,ja") yield [path, node];
    else
      for (const [k, v] of Object.entries(node))
        yield* lValues(v, `${path}.${k}`);
  }
}

/** Every string in the content, with its path and language (if inside an L). */
function* strings(node, path = "site", lang = null) {
  if (typeof node === "string") yield { path, lang, value: node };
  else if (Array.isArray(node))
    for (let i = 0; i < node.length; i++)
      yield* strings(node[i], `${path}[${i}]`, lang);
  else if (node && typeof node === "object") {
    const isL = Object.keys(node).sort().join(",") === "en,ja";
    for (const [k, v] of Object.entries(node))
      yield* strings(v, `${path}.${k}`, isL ? k : lang);
  }
}

const nonEmpty = (v) =>
  typeof v === "string"
    ? v.trim().length > 0
    : Array.isArray(v) && v.length > 0 && v.every(nonEmpty);

const chars = (s) => [...s].length; // code points, so 「あ」 counts as 1
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

// --- Content rules -----------------------------------------------------------

await check("every L value has non-empty en and ja", () => {
  const found = [...lValues(site)];
  const bad = found
    .filter(([, l]) => !nonEmpty(l.en) || !nonEmpty(l.ja))
    .map(([p]) => p);
  assert.deepEqual(bad, []);
  return `${found.length} L values`;
});

await check("English About: at most 120 words, at most 3 paragraphs", () => {
  const en = site.about.paragraphs.en;
  const ja = site.about.paragraphs.ja;
  const n = words(en.join(" "));
  assert.ok(n <= 120, `${n} words`);
  assert.ok(en.length >= 1 && en.length <= 3, `${en.length} paragraphs`);
  assert.equal(ja.length, en.length, "JA paragraph count differs from EN");
  return `${n} words in ${en.length} paragraphs (JA: ${chars(ja.join(""))} characters)`;
});

await check("every build summary has at most 90 characters (EN and JA)", () => {
  const notes = [];
  for (const b of site.builds.items)
    for (const lang of ["en", "ja"]) {
      const n = chars(b.summary[lang]);
      assert.ok(n <= 90, `${b.id}.summary.${lang}: ${n} characters`);
      notes.push(`${b.id}.${lang}=${n}`);
    }
  return notes.join(", ");
});

await check(
  "builds: drone, gpt2, website, each with 2–3 body paragraphs and tags",
  () => {
    assert.deepEqual(
      site.builds.items.map((b) => b.id),
      ["drone", "gpt2", "website"],
    );
    for (const b of site.builds.items) {
      for (const lang of ["en", "ja"]) {
        const n = b.body[lang].length;
        assert.ok(n >= 2 && n <= 3, `${b.id}.body.${lang}: ${n} paragraphs`);
      }
      assert.ok(b.tags.length > 0, `${b.id} has no tags`);
      assert.ok(b.image, `${b.id} has no image`);
    }
  },
);

await check("section titles: About / Things I've built / Say hi", () => {
  assert.equal(site.about.title.en, "About");
  assert.equal(site.builds.title.en, "Things I've built");
  assert.equal(site.sayhi.title.en, "Say hi");
});

await check('name.ja is "Ash Kuroki", marked TODO(Ash) in site.ts', () => {
  assert.equal(site.name.ja, "Ash Kuroki");
  const src = readFileSync(join(ROOT, "src/content/site.ts"), "utf8");
  assert.ok(src.includes("// TODO(Ash): Japanese name spelling"));
});

await check("ui strings from the spec", () => {
  assert.equal(
    site.ui.controlsHint.en,
    "WASD / arrow keys to walk · click to walk there · E to interact",
  );
  assert.equal(
    site.ui.controlsHintTouch.en,
    "Tap to walk · tap a label to visit",
  );
  assert.equal(
    site.ui.footerCredit.en,
    "Previous version designed by Kayla Purney",
  );
  assert.deepEqual(site.ui.langToggle, { en: "日本語", ja: "English" });
  assert.equal(site.ui.drinks.en.length, 5);
  assert.equal(site.ui.drinks.ja.length, 5);
  for (const lang of ["en", "ja"])
    assert.ok(site.ui.gotDrink[lang].includes("{drink}"), `gotDrink.${lang}`);
});

await check("no WP-01 placeholder text is left", () => {
  const bad = [...strings(site)]
    .filter(
      ({ lang, value }) =>
        (lang !== "ja" && /placeholder/i.test(value)) ||
        (lang === "ja" && value.includes("仮")),
    )
    .map((s) => s.path);
  assert.deepEqual(bad, []);
});

await check(
  "links: GitHub and LinkedIn only, no email, nothing private",
  () => {
    assert.deepEqual(
      site.sayhi.links.map((l) => [l.id, l.href]),
      [
        ["github", "https://github.com/kurokiasahi222"],
        ["linkedin", "https://www.linkedin.com/in/asahi-kuroki/"],
      ],
    );
    const all = [...strings(site)].map((s) => s.value).join("\n");
    assert.ok(!/mailto:|[\w.+-]+@[\w-]+\.\w/.test(all), "an email address");
    const byId = Object.fromEntries(site.builds.items.map((b) => [b.id, b]));
    assert.deepEqual(byId.gpt2.links, [], "GPT-2 is a write-up only");
    assert.deepEqual(byId.website.links, [], "the website repo is private");
    for (const l of byId.drone.links)
      assert.ok(l.href.startsWith("https://"), l.href);
  },
);

await check(
  "images: exist, WebP, at most 1200 px wide and 120 KB",
  async () => {
    const sharp = requireFromRoot("sharp");
    const images = [
      site.about.photo,
      ...site.builds.items.map((b) => b.image).filter(Boolean),
    ];
    const notes = [];
    for (const img of images) {
      const file = join(ROOT, "public", img.src);
      assert.ok(existsSync(file), `${img.src} is missing`);
      const meta = await sharp(file).metadata();
      const kb = statSync(file).size / 1024;
      assert.equal(meta.format, "webp", `${img.src} is ${meta.format}`);
      assert.ok(meta.width <= 1200, `${img.src} is ${meta.width} px wide`);
      assert.ok(kb <= 120, `${img.src} is ${kb.toFixed(1)} KB`);
      notes.push(`${img.src} ${meta.width}×${meta.height} ${kb.toFixed(1)} KB`);
    }
    return notes.join("\n      ");
  },
);

// --- External links ----------------------------------------------------------

function externalLinks() {
  return [
    ...site.builds.items.flatMap((b) => b.links.map((l) => l.href)),
    ...site.sayhi.links.map((l) => l.href),
  ];
}

/** GET with curl, following redirects: { code, body }. */
function curl(url) {
  const out = execFileSync(
    "curl",
    ["-sS", "-L", "--max-time", "90", "-w", "\n%{http_code}", url],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const i = out.lastIndexOf("\n");
  return { code: out.slice(i + 1).trim(), body: out.slice(0, i) };
}

// Claude Code cloud sessions' egress proxy answers github.com web pages itself,
// with a JSON 403 pointing at this page, so GitHub links can't be fetched there.
const PROXY_BLOCK = "docs.anthropic.com/en/docs/claude-code/github-actions";

if (args.links) {
  for (const url of externalLinks()) {
    await check(`link ${url}`, async () => {
      let res = curl(url);
      // Retry rate limits and flaky errors: 2 s, 4 s, 8 s.
      for (const s of [2, 4, 8]) {
        if (!/^(429|5\d\d|000)$/.test(res.code)) break;
        await new Promise((r) => setTimeout(r, s * 1000));
        res = curl(url);
      }
      if (res.code === "999" && url.includes("linkedin.com"))
        throw new Skip("HTTP 999: LinkedIn refuses automated checks (noted)");
      if (res.code === "403" && res.body.includes(PROXY_BLOCK)) {
        const repo = /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(url);
        if (!repo)
          throw new Skip(
            "HTTP 403 from this session's proxy (github.com pages are blocked here); check it by hand",
          );
        const head = execFileSync("git", ["ls-remote", url, "HEAD"], {
          encoding: "utf8",
        }).split(/\s/)[0];
        assert.match(head, /^[0-9a-f]{40}$/, "git ls-remote found no HEAD");
        return `page blocked by this session's proxy (403); the repo exists: git ls-remote HEAD ${head.slice(0, 7)}`;
      }
      assert.equal(res.code, "200", `HTTP ${res.code}`);
      return "HTTP 200";
    });
  }
}

// --- Classic view in a browser -----------------------------------------------

if (args.browser || args.shots) {
  const { startServer } = await import("../lib/server.mjs");
  const { launchBrowser, contextOptionsFor, collectErrors } =
    await import("../lib/browser.mjs");
  const server = await startServer({ mode: "dev" });
  const { browser } = await launchBrowser();
  try {
    for (const lang of ["en", "ja"])
      for (const viewport of ["desktop", "mobile"])
        for (const js of [true, false]) {
          const path = `${lang === "ja" ? "/ja/" : "/"}?view=classic`;
          await check(
            `Classic ${lang} ${viewport}${js ? "" : " (no JS)"}: images load, text fits, lang and title right`,
            async () => {
              const context = await browser.newContext({
                ...contextOptionsFor(viewport),
                javaScriptEnabled: js,
              });
              const page = await context.newPage();
              const errors = collectErrors(page);
              try {
                await page.goto(server.base + path, { waitUntil: "load" });
                await page.evaluate(() => {
                  for (const img of document.querySelectorAll("img"))
                    img.loading = "eager";
                });
                await page.waitForFunction(() =>
                  [...document.querySelectorAll("img")].every(
                    (i) => i.complete,
                  ),
                );
                const r = await page.evaluate(() => ({
                  lang: document.getElementById("classic-content")?.lang,
                  title: document.title,
                  broken: [...document.querySelectorAll("img")]
                    .filter((i) => !(i.naturalWidth > 0))
                    .map((i) => i.getAttribute("src")),
                  images: document.querySelectorAll("img").length,
                  overflow:
                    document.scrollingElement.scrollWidth - window.innerWidth,
                  cards: document.querySelectorAll(".classic-card").length,
                }));
                assert.equal(r.lang, lang);
                assert.equal(r.title, site.meta.title[lang]);
                assert.deepEqual(r.broken, []);
                assert.equal(r.images, 4, "photo + three build images");
                assert.equal(r.cards, 3);
                assert.ok(
                  r.overflow <= 0,
                  `scrolls sideways by ${r.overflow} px`,
                );
                assert.deepEqual(errors, []);
                let shot = "";
                if (args.shots && js) {
                  // Decode every image first: a full-page capture can race
                  // `decoding="async"` images below the fold and paint them
                  // blank (seen with `npm run shots`).
                  await page.evaluate(() =>
                    Promise.all(
                      [...document.querySelectorAll("img")].map((i) =>
                        i.decode(),
                      ),
                    ),
                  );
                  await page.evaluate(() => document.fonts.ready);
                  mkdirSync(join(ROOT, "shots"), { recursive: true });
                  shot = `shots/wp-04-classic-${lang}-${viewport}.png`;
                  await page.screenshot({
                    path: join(ROOT, shot),
                    fullPage: true,
                  });
                  shot = `; saved ${shot}`;
                }
                return `${r.images} images loaded, no sideways scroll${shot}`;
              } finally {
                await context.close();
              }
            },
          );
        }
  } finally {
    await browser.close();
    await server.stop();
  }
}

const skips = skipped ? ` (${skipped} skipped, see SKIP lines)` : "";
console.log(
  failed
    ? `\n${failed} check(s) failed${skips}`
    : `\nAll WP-04 checks passed${skips}`,
);
process.exit(failed ? 1 : 0);
