#!/usr/bin/env node
// Size budgets (overview § 7), measured on the production build.
//
//   npm run budget                 builds, then checks
//   npm run budget -- --no-build   checks the existing dist/
//   npm run budget -- --json       also prints the rows as JSON
//   npm run budget -- --verbose    also lists the files behind each page row
//
// It answers the § 7 rows that file sizes can answer:
// - Classic page weight, per page: the HTML plus every local file the page
//   loads in Classic mode (stylesheets, module scripts and their static
//   imports, images). Text files count gzipped, images as stored. External
//   requests (Google Fonts, Google Analytics) can't be measured from files
//   and are listed separately.
// - World JS: the page's module scripts plus everything they import,
//   statically or dynamically (JS and WASM), gzipped.
// - Each .glb (as stored: meshopt-compressed already), the audio total, and
//   "downloaded before Enter" = world JS + street + ash, per tier.
// Sizes use decimal units: 1 KB = 1000 bytes, 1 MB = 1000 KB.
// A model or audio row whose files don't exist yet says "missing" and is not
// a violation. The script exits non-zero on any violation.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { parseArgs } from "./lib/args.mjs";
import { ROOT } from "./lib/server.mjs";

const DIST = join(ROOT, "dist");
const KB = 1000;
const MB = 1000 * KB;

const LIMITS = {
  classicPage: 400 * KB,
  worldJs: 1.8 * MB,
  beforeEnterHigh: 10 * MB,
  beforeEnterLow: 6 * MB,
  street: 5 * MB,
  streetLow: 2.5 * MB,
  ash: 0.8 * MB,
  deck: 2 * MB,
  deckLow: 1 * MB,
  audio: 1.5 * MB,
};

const PAGES = [
  { route: "/", file: "index.html" },
  { route: "/ja/", file: "ja/index.html" },
];

const TEXT_EXT = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".svg",
  ".txt",
  ".xml",
  ".webmanifest",
  ".wasm",
]);
const AUDIO_EXT = new Set([
  ".mp3",
  ".ogg",
  ".opus",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
  ".webm",
]);

function fmt(bytes) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
  return `${(bytes / KB).toFixed(1)} KB`;
}

const sizeCache = new Map();
/** Transfer size estimate: gzip (level 9) for text, stored size for binaries. */
function transferSize(file) {
  if (!sizeCache.has(file)) {
    const buf = readFileSync(file);
    sizeCache.set(
      file,
      TEXT_EXT.has(extname(file))
        ? gzipSync(buf, { level: 9 }).length
        : buf.length,
    );
  }
  return sizeCache.get(file);
}

/** Maps a URL path in the built site ("/_astro/x.js") to a file in dist/. */
function distFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  const file = join(DIST, clean);
  return file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()
    ? file
    : null;
}

function attrs(tag) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const m of tag.matchAll(
    /([a-zA-Z:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
  )) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return out;
}

/** Local resources a page references, and external URLs it requests. */
function pageResources(html) {
  const css = new Set();
  const scripts = new Set();
  const preloads = new Set();
  const images = new Set();
  const external = new Set();
  for (const [tag, name] of html.matchAll(/<(script|link|img)\b[^>]*>/gi)) {
    const a = attrs(tag.slice(name.length + 1, -1));
    const url = name.toLowerCase() === "link" ? a.href : a.src;
    if (!url) continue;
    const rel = (a.rel ?? "").toLowerCase();
    if (/^(https?:)?\/\//.test(url)) {
      if (name.toLowerCase() === "script" || rel === "stylesheet")
        external.add(url);
      continue;
    }
    if (name.toLowerCase() === "script") scripts.add(url);
    else if (name.toLowerCase() === "img") images.add(url);
    else if (rel === "stylesheet") css.add(url);
    else if (rel === "modulepreload") preloads.add(url);
  }
  return { css, scripts, preloads, images, external };
}

/**
 * Imports of a built JS chunk, resolved to files in dist/.
 * static: `import … from "./x.js"`, `import "./x.js"`, `export … from`.
 * dynamic: `import("./x.js")` (the minifier may use backticks), Vite's preload
 * lists ("_astro/x.js"), and
 * `new URL("x.wasm", import.meta.url)` style assets.
 */
function chunkImports(file) {
  const code = readFileSync(file, "utf8");
  const here = "/" + relative(DIST, file).split(sep).join("/");
  const resolve = (spec) => {
    if (/^(https?:)?\/\//.test(spec) || spec.startsWith("data:")) return null;
    const path = spec.startsWith("_astro/")
      ? "/" + spec
      : new URL(spec, "http://x" + here).pathname;
    return distFile(path);
  };
  const statics = new Set();
  const dynamics = new Set();
  for (const m of code.matchAll(
    /\b(?:from|import)\s*["']([^"']+\.m?js)["']/g,
  )) {
    const f = resolve(m[1]);
    if (f) statics.add(f);
  }
  for (const m of code.matchAll(/\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const f = resolve(m[1]);
    if (f) dynamics.add(f);
  }
  for (const m of code.matchAll(
    /["'`]((?:_astro\/|\.\.?\/)[^"'`]+\.(?:m?js|wasm))["'`]/g,
  )) {
    const f = resolve(m[1]);
    if (f && !statics.has(f)) dynamics.add(f);
  }
  return { statics, dynamics };
}

/** All files reachable from `entries`; with `dynamic`, through import() too. */
function closure(entries, { dynamic }) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.m?js$/.test(file)) continue;
    const { statics, dynamics } = chunkImports(file);
    for (const f of statics) stack.push(f);
    if (dynamic) for (const f of dynamics) stack.push(f);
  }
  return seen;
}

/** Local url(...) references inside a stylesheet (fonts, images). */
function cssAssets(file) {
  const out = new Set();
  const here = "/" + relative(DIST, file).split(sep).join("/");
  for (const m of readFileSync(file, "utf8").matchAll(
    /url\(\s*["']?([^"')]+)["']?\s*\)/g,
  )) {
    if (/^(data:|https?:|\/\/)/.test(m[1])) continue;
    const f = distFile(new URL(m[1], "http://x" + here).pathname);
    if (f) out.add(f);
  }
  return out;
}

const sum = (files) => [...files].reduce((n, f) => n + transferSize(f), 0);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((f) => join(dir, f))
    .filter((f) => statSync(f).isFile());
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    boolean: ["json", "verbose"],
  });

  if (args.build !== false) {
    console.log("Building (astro build)…");
    const res = spawnSync(
      process.execPath,
      [join(ROOT, "node_modules/astro/bin/astro.mjs"), "build"],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
      },
    );
    if (res.status !== 0) {
      console.error(res.stdout, res.stderr);
      console.error("astro build failed.");
      return 1;
    }
  }
  if (!existsSync(join(DIST, "index.html"))) {
    console.error(
      "No dist/index.html. Run `npm run build` first (or drop --no-build).",
    );
    return 1;
  }

  /** @type {{ budget: string, measured: number | null, limit: number, status: "ok" | "OVER" | "missing", note?: string }[]} */
  const rows = [];
  const row = (budget, measured, limit, note) =>
    rows.push({
      budget,
      measured,
      limit,
      status:
        measured === null || note === "partial"
          ? "missing"
          : measured <= limit
            ? "ok"
            : "OVER",
      note,
    });

  // Classic page weight, and the page's JS graph.
  let worldJs = 0;
  const externals = new Set();
  for (const page of PAGES) {
    const htmlFile = join(DIST, page.file);
    if (!existsSync(htmlFile)) {
      row(`Classic page weight ${page.route}`, null, LIMITS.classicPage);
      continue;
    }
    const html = readFileSync(htmlFile, "utf8");
    const res = pageResources(html);
    for (const e of res.external) externals.add(e);
    const local = (set) => new Set([...set].map(distFile).filter(Boolean));
    const scripts = local(res.scripts);
    const css = local(res.css);
    const classicFiles = new Set([
      htmlFile,
      ...css,
      ...[...css].flatMap((f) => [...cssAssets(f)]),
      ...closure([...scripts, ...local(res.preloads)], { dynamic: false }),
      ...local(res.images),
    ]);
    row(
      `Classic page weight ${page.route}`,
      sum(classicFiles),
      LIMITS.classicPage,
    );

    const worldFiles = [...closure([...scripts], { dynamic: true })].filter(
      (f) => /\.(m?js|wasm)$/.test(f),
    );
    worldJs = Math.max(worldJs, sum(worldFiles));
    if (args.verbose) {
      const list = (label, files) => {
        console.log(`${label}:`);
        for (const f of files)
          console.log(
            `  ${fmt(transferSize(f)).padStart(10)}  ${relative(DIST, f)}`,
          );
      };
      list(`Classic files for ${page.route}`, classicFiles);
      list(`World JS for ${page.route}`, worldFiles);
    }
  }
  row("World JS + WASM, gzipped", worldJs, LIMITS.worldJs);

  // Models.
  const model = (name) => {
    const f = join(DIST, "models", name);
    return existsSync(f) ? statSync(f).size : null;
  };
  const street = model("street.glb");
  const streetLow = model("street-low.glb");
  const ash = model("ash.glb");
  const beforeEnter = (streetSize) => {
    const known = worldJs + (streetSize ?? 0) + (ash ?? 0);
    return { known, partial: streetSize === null || ash === null };
  };
  const high = beforeEnter(street);
  const low = beforeEnter(streetLow);
  row(
    "Before Enter, high (JS + street + ash)",
    high.known,
    LIMITS.beforeEnterHigh,
    high.partial ? "partial" : undefined,
  );
  row(
    "Before Enter, low (JS + street-low + ash)",
    low.known,
    LIMITS.beforeEnterLow,
    low.partial ? "partial" : undefined,
  );
  row("street.glb", street, LIMITS.street);
  row("street-low.glb", streetLow, LIMITS.streetLow);
  row("ash.glb", ash, LIMITS.ash);
  row("deck.glb", model("deck.glb"), LIMITS.deck);
  row("deck-low.glb", model("deck-low.glb"), LIMITS.deckLow);

  // Audio.
  const audioFiles = walk(join(DIST, "audio")).filter((f) =>
    AUDIO_EXT.has(extname(f).toLowerCase()),
  );
  row(
    "Audio total (public/audio)",
    audioFiles.length
      ? audioFiles.reduce((n, f) => n + statSync(f).size, 0)
      : null,
    LIMITS.audio,
  );

  // Table.
  const w = Math.max(...rows.map((r) => r.budget.length));
  console.log(
    `\n${"Budget (overview § 7)".padEnd(w)}  ${"Measured".padStart(11)}  ${"Limit".padStart(9)}  Status`,
  );
  console.log(`${"-".repeat(w)}  ${"-".repeat(11)}  ${"-".repeat(9)}  -------`);
  for (const r of rows) {
    const measured =
      r.measured === null
        ? "—"
        : (r.note === "partial" ? "≥ " : "") + fmt(r.measured);
    console.log(
      `${r.budget.padEnd(w)}  ${measured.padStart(11)}  ${fmt(r.limit).padStart(9)}  ${r.status}`,
    );
  }
  if (externals.size) {
    console.log(`\nNot counted (external, can't be measured from files):`);
    for (const e of externals) console.log(`  ${e}`);
  }
  console.log(
    "\nMeasured: text files gzipped (level 9), binaries as stored; 1 MB = 1000 KB.\n" +
      'Draw calls and triangles: use ?debug=stats (window.__worldStats). "missing" rows aren\'t violations.',
  );
  if (args.json) console.log(JSON.stringify(rows, null, 2));

  const over = rows.filter((r) => r.status === "OVER");
  if (over.length) {
    console.error(`\nOVER BUDGET: ${over.map((r) => r.budget).join(", ")}`);
    return 1;
  }
  console.log("\nAll measured budgets pass.");
  return 0;
}

process.exit(main());
