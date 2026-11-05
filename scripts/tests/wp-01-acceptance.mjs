#!/usr/bin/env node
// WP-01 acceptance checks in headless Chromium: boot and view mode (§ 8),
// tiers, the world skeleton, the store (§ 6.4), debug parameters (§ 10),
// the Classic-mode request waterfall and the error fallback.
//
//   node scripts/tests/wp-01-acceptance.mjs                  against a fresh production build
//   node scripts/tests/wp-01-acceptance.mjs --no-build       against the existing dist/
//   node scripts/tests/wp-01-acceptance.mjs --server dev     against the dev server
//   node scripts/tests/wp-01-acceptance.mjs --base <url>     against a running server

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parseArgs } from "../lib/args.mjs";
import {
  collectErrors,
  contextOptionsFor,
  launchBrowser,
} from "../lib/browser.mjs";
import { ROOT, startServer } from "../lib/server.mjs";

const args = parseArgs(process.argv.slice(2));
const mode = args.server === "dev" ? "dev" : "preview";

if (
  typeof args.base !== "string" &&
  mode === "preview" &&
  args.build !== false
) {
  console.log("Building…");
  const res = spawnSync(
    process.execPath,
    [join(ROOT, "node_modules/astro/bin/astro.mjs"), "build"],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  if (res.status !== 0) {
    console.error(res.stdout, res.stderr);
    process.exit(1);
  }
}

const server =
  typeof args.base === "string"
    ? { base: args.base.replace(/\/$/, ""), stop: async () => {} }
    : await startServer({ mode });
const { browser } = await launchBrowser({ log: console.log });
console.log(
  `Testing ${server.base} (${typeof args.base === "string" ? "external" : mode})\n`,
);

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed++;
    console.log(
      `FAIL  ${name}\n      ${String(error?.message ?? error)
        .split("\n")
        .join("\n      ")}`,
    );
  }
}

/** A fresh context and page. `init` runs before any page script. */
async function open(
  path,
  { viewport = "desktop", init, contextOptions = {} } = {},
) {
  const context = await browser.newContext({
    ...contextOptionsFor(viewport),
    ...contextOptions,
  });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = collectErrors(page);
  /** @type {string[]} */
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  if (path) await page.goto(server.base + path, { waitUntil: "load" });
  return { context, page, errors, requests };
}

const boot = (page) => page.evaluate(() => window.__ashBoot);
const hasWorldClass = (page) =>
  page.evaluate(() =>
    document.documentElement.classList.contains("world-mode"),
  );
const waitForCanvas = (page) =>
  page.waitForSelector("#world-root canvas", { timeout: 30_000 });
const state = (page) =>
  page.evaluate(() => {
    const s = window.__world.store.getState();
    return Object.fromEntries(
      Object.entries(s).map(([k, v]) => [
        k,
        typeof v === "function" ? "fn" : v,
      ]),
    );
  });
const call = (page, action, ...params) =>
  page.evaluate(
    ([a, p]) => window.__world.store.getState()[a](...p),
    [action, params],
  );

/** Captures three.js renderers through the devtools hook. */
const captureRenderer = () => {
  window.__renderers = [];
  const hook = new EventTarget();
  hook.addEventListener("observe", (e) => {
    if (e.detail?.isWebGLRenderer) window.__renderers.push(e.detail);
  });
  window.__THREE_DEVTOOLS__ = hook;
};

// ---------------------------------------------------------------------------
// Boot and view mode (overview § 8)

await check(
  "headless / (software WebGL) resolves to classic, reason 'software renderer'",
  async () => {
    const { context, page } = await open("/");
    const b = await boot(page);
    assert.equal(b.mode, "classic");
    assert.equal(b.reason, "software renderer");
    assert.equal(b.lang, "en");
    assert.equal(await hasWorldClass(page), false);
    assert.equal(
      await page.isVisible("#boot-card"),
      false,
      "boot card visible in classic",
    );
    assert.equal(await page.locator("#world-root").innerHTML(), "");
    await context.close();
  },
);

await check(
  "the inline boot script is the first <head> script, synchronous, under 3 KB",
  async () => {
    const { context, page } = await open("/");
    const info = await page.evaluate(() => {
      const s = document.head.querySelector("script");
      return {
        inline: !s.src,
        sync: !s.async && !s.defer && (!s.type || s.type === "text/javascript"),
        bytes: new TextEncoder().encode(s.textContent).length,
        first: document.head.querySelector("title")
          ? s.compareDocumentPosition(document.head.querySelector("title")) & 4
          : 0,
      };
    });
    assert.ok(info.inline && info.sync, JSON.stringify(info));
    assert.ok(info.first, "boot script should come before <title>");
    assert.ok(info.bytes < 3072, `${info.bytes} bytes`);
    console.log(`      inline boot script: ${info.bytes} bytes`);
    await context.close();
  },
);

await check(
  "Classic mode downloads no 3D code (only the tiny entry script)",
  async () => {
    const { context, page, requests } = await open("/");
    await page.waitForLoadState("networkidle");
    const entry = await page.evaluate(() =>
      [...document.querySelectorAll("script[type=module][src]")].map(
        (s) => s.src,
      ),
    );
    const localJs = requests.filter(
      (u) => u.startsWith(server.base) && /\.(m?[jt]sx?|wasm)(\?|$)/.test(u),
    );
    if (mode === "preview" || typeof args.base === "string") {
      assert.deepEqual(localJs, entry, `requested: ${localJs.join(", ")}`);
    }
    assert.ok(
      !localJs.some((u) =>
        /mount|three|fiber|rapier|App\.tsx|react-dom/.test(u),
      ),
      localJs.join("\n"),
    );
    console.log(
      `      classic JS requests: ${localJs.map((u) => u.replace(server.base, "")).join(", ")}`,
    );
    await context.close();
  },
);

await check(
  "/?view=world resolves to world, shows the boot card and mounts an aria-hidden canvas, no console errors",
  async () => {
    const { context, page, errors, requests } = await open("/?view=world");
    const b = await boot(page);
    assert.equal(b.mode, "world");
    assert.equal(b.reason, "url");
    assert.equal(await hasWorldClass(page), true);
    assert.equal(await page.isVisible("#boot-card"), true, "boot card hidden");
    await waitForCanvas(page);
    await page.waitForTimeout(1500); // let a few frames render
    const hidden = await page.evaluate(
      () =>
        !!document
          .querySelector("#world-root canvas")
          ?.closest('[aria-hidden="true"]'),
    );
    assert.ok(hidden, "canvas isn't inside aria-hidden");
    const classicBox = await page.locator("#classic-content").boundingBox();
    assert.ok(
      classicBox && classicBox.width <= 1 && classicBox.height <= 1,
      `classic content visible: ${JSON.stringify(classicBox)}`,
    );
    assert.ok(
      requests.some((u) => /mount/.test(u)),
      "world chunk not requested",
    );
    assert.deepEqual(errors, []);
    await context.close();
  },
);

await check(
  "?view=classic stays classic even with a saved 'world'; the saved choice survives reloads",
  async () => {
    const { context, page } = await open("/");
    // Classic header: "Enter the 3D world" saves ash.view = world.
    await Promise.all([
      page.waitForURL(/view=world/),
      page.click("a[data-view-choice=world]"),
    ]);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("ash.view")),
      "world",
    );
    assert.equal((await boot(page)).mode, "world");

    await page.goto(server.base + "/", { waitUntil: "load" });
    assert.deepEqual(await boot(page).then((b) => [b.mode, b.reason]), [
      "world",
      "saved",
    ]);
    await page.reload({ waitUntil: "load" });
    assert.deepEqual(await boot(page).then((b) => [b.mode, b.reason]), [
      "world",
      "saved",
    ]);

    await page.goto(server.base + "/?view=classic", { waitUntil: "load" });
    assert.deepEqual(await boot(page).then((b) => [b.mode, b.reason]), [
      "classic",
      "url",
    ]);
    await page.reload({ waitUntil: "load" });
    assert.deepEqual(await boot(page).then((b) => [b.mode, b.reason]), [
      "classic",
      "url",
    ]);
    assert.equal(await hasWorldClass(page), false);

    // A saved "classic" (WP-07's Classic view link) survives reloads too.
    await page.evaluate(() => localStorage.setItem("ash.view", "classic"));
    await page.goto(server.base + "/", { waitUntil: "load" });
    assert.deepEqual(await boot(page).then((b) => [b.mode, b.reason]), [
      "classic",
      "saved",
    ]);
    await page.reload({ waitUntil: "load" });
    assert.deepEqual(await boot(page).then((b) => [b.mode, b.reason]), [
      "classic",
      "saved",
    ]);
    await context.close();
  },
);

await check("storage that throws doesn't break boot", async () => {
  const init = () => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  };
  const { context, page, errors } = await open("/", { init });
  assert.deepEqual(await boot(page).then((b) => [b.mode, b.reason]), [
    "classic",
    "software renderer",
  ]);
  await page.click("a[data-view-choice=world]");
  await page.waitForURL(/view=world/);
  assert.equal((await boot(page)).mode, "world");
  assert.deepEqual(
    errors.filter((e) => /pageerror/.test(e)),
    [],
  );
  await context.close();
});

await check(
  "automatic detection: no WebGL2 / save data / low-end device / capable device",
  async () => {
    const hardwareGpu = () => {
      const get = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (p) {
        return p === 0x1f01 || p === 0x9246
          ? "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070)"
          : get.call(this, p);
      };
    };
    const cases = [
      [
        "no webgl2",
        () => {
          const get = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (t, ...r) {
            return t === "webgl2" ? null : get.call(this, t, ...r);
          };
        },
        "classic",
      ],
      ["auto", hardwareGpu, "world"],
      [
        "save data",
        `(${hardwareGpu})(); Object.defineProperty(navigator, "connection", { value: { saveData: true } });`,
        "classic",
      ],
      [
        "low-end device",
        `(${hardwareGpu})(); Object.defineProperty(navigator, "hardwareConcurrency", { value: 2 }); Object.defineProperty(navigator, "deviceMemory", { value: 2 });`,
        "classic",
      ],
      [
        "auto",
        `(${hardwareGpu})(); Object.defineProperty(navigator, "hardwareConcurrency", { value: 2 }); Object.defineProperty(navigator, "deviceMemory", { value: undefined });`,
        "world",
      ],
    ];
    for (const [reason, init, expected] of cases) {
      const { context, page } = await open("/?view=", {
        init: typeof init === "string" ? { content: init } : init,
      });
      const b = await boot(page);
      assert.deepEqual(
        [b.mode, b.reason],
        [expected, reason],
        `case ${reason}`,
      );
      await context.close();
    }
  },
);

// ---------------------------------------------------------------------------
// Tiers and the canvas (overview § 8)

await check(
  "tier: desktop high, mobile (coarse pointer) low, ?tier= overrides",
  async () => {
    const expectTier = async (path, viewport, tier) => {
      const { context, page } = await open(path, { viewport });
      const b = await boot(page);
      const inputs = await page.evaluate(() => ({
        mem: navigator.deviceMemory,
        coarse: matchMedia("(pointer: coarse)").matches,
        short: Math.min(screen.width, screen.height),
      }));
      const auto =
        inputs.coarse || inputs.mem < 8 || inputs.short < 700 ? "low" : "high";
      assert.equal(
        b.tier,
        tier ?? auto,
        `${path} ${viewport} ${JSON.stringify(inputs)}`,
      );
      await context.close();
      return b.tier;
    };
    const desktop = await expectTier("/", "desktop");
    console.log(`      desktop auto tier: ${desktop}`);
    assert.equal(await expectTier("/", "mobile"), "low");
    assert.equal(await expectTier("/?tier=high", "mobile", "high"), "high");
    assert.equal(await expectTier("/?tier=low", "desktop", "low"), "low");
  },
);

await check(
  "canvas: AgX tone mapping, sRGB output, DPR capped at 2 (high) / 1.5 (low), live on setTier",
  async () => {
    const { context, page } = await open("/?view=world&debug&tier=high", {
      init: captureRenderer,
      contextOptions: { deviceScaleFactor: 3 },
    });
    await waitForCanvas(page);
    await page.waitForFunction(() => window.__renderers.length > 0);
    const read = () =>
      page.evaluate(() => {
        const r = window.__renderers.at(-1);
        return {
          toneMapping: r.toneMapping,
          colorSpace: r.outputColorSpace,
          dpr: r.getPixelRatio(),
        };
      });
    assert.deepEqual(await read(), {
      toneMapping: 6 /* AgXToneMapping */,
      colorSpace: "srgb",
      dpr: 2,
    });
    await call(page, "setTier", "low");
    await page.waitForFunction(
      () => window.__renderers.at(-1).getPixelRatio() === 1.5,
      null,
      { timeout: 5000 },
    );
    assert.equal((await read()).dpr, 1.5);
    await context.close();
  },
);

// ---------------------------------------------------------------------------
// Store (overview § 6.4)

const FIELDS = {
  phase: "loading",
  loadProgress: 0,
  lang: "en",
  sound: false,
  tier: "high",
  reducedMotion: false,
  openPanel: null,
  nearby: null,
  autoWalk: null,
  toast: null,
};
const ACTIONS = [
  "setPhase",
  "setLoadProgress",
  "setLang",
  "setSound",
  "setTier",
  "openSection",
  "closePanel",
  "setNearby",
  "walkTo",
  "cancelAutoWalk",
  "showToast",
  "clearToast",
];

await check(
  "window.__world.store.getState() exposes exactly the § 6.4 fields and actions",
  async () => {
    const { context, page } = await open("/?view=world&debug&tier=high");
    await waitForCanvas(page);
    const s = await state(page);
    assert.deepEqual(
      Object.keys(s).sort(),
      [...Object.keys(FIELDS), ...ACTIONS].sort(),
    );
    for (const a of ACTIONS) assert.equal(s[a], "fn", a);
    for (const [k, v] of Object.entries(FIELDS))
      assert.deepEqual(s[k], v, `initial ${k}`);
    await context.close();
  },
);

await check("store actions behave as § 6.4 says", async () => {
  const { context, page } = await open("/?view=world&debug=stats&tier=high");
  await waitForCanvas(page);
  const get = async (k) => (await state(page))[k];

  await call(page, "openSection", "about", "menu");
  assert.deepEqual(
    [await get("openPanel"), await get("autoWalk")],
    ["about", "about"],
  );
  await call(page, "closePanel");
  assert.deepEqual(
    [await get("openPanel"), await get("autoWalk")],
    [null, null],
  );
  await call(page, "openSection", "builds", "world");
  assert.deepEqual(
    [await get("openPanel"), await get("autoWalk")],
    ["builds", null],
  );
  await call(page, "walkTo", { x: 1, z: -2 });
  assert.deepEqual(await get("autoWalk"), { x: 1, z: -2 });
  await call(page, "cancelAutoWalk");
  assert.equal(await get("autoWalk"), null);
  await call(page, "walkTo", "bell");
  await call(page, "closePanel");
  assert.equal(await get("autoWalk"), null, "closePanel clears autoWalk");

  for (const p of ["title", "intro", "explore", "deck", "loading"]) {
    await call(page, "setPhase", p);
    assert.equal(await get("phase"), p);
  }
  await call(page, "setLoadProgress", 0.4);
  assert.equal(await get("loadProgress"), 0.4);
  await call(page, "setLoadProgress", 7);
  assert.equal(await get("loadProgress"), 1);
  await call(page, "setSound", true);
  assert.equal(await get("sound"), true);
  await call(page, "setTier", "low");
  assert.equal(await get("tier"), "low");
  await call(page, "setNearby", "vending");
  assert.equal(await get("nearby"), "vending");
  await call(page, "setNearby", null);
  assert.equal(await get("nearby"), null);

  // Toasts auto-clear after 4 s; a newer toast restarts the timer.
  await call(page, "showToast", { kind: "drink", text: "one" });
  await page.waitForTimeout(2000);
  await call(page, "showToast", { kind: "slow", text: "two" });
  await page.waitForTimeout(2500);
  assert.deepEqual(
    await get("toast"),
    { kind: "slow", text: "two" },
    "second toast cleared early",
  );
  await page.waitForTimeout(2000);
  assert.equal(await get("toast"), null, "toast not cleared after 4 s");
  await call(page, "showToast", { kind: "drink", text: "three" });
  await call(page, "clearToast");
  assert.equal(await get("toast"), null);
  await context.close();
});

await check(
  "setLang('ja') updates <html lang>, the URL path (keeping the query) and the title; Classic keeps its own lang",
  async () => {
    const { context, page } = await open("/?view=world&debug");
    await waitForCanvas(page);
    await call(page, "setLang", "ja");
    const ja = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      path: location.pathname,
      search: location.search,
      title: document.title,
      classic: document.getElementById("classic-content").lang,
      store: window.__world.store.getState().lang,
    }));
    assert.deepEqual(ja, {
      lang: "ja",
      path: "/ja/",
      search: "?view=world&debug",
      title: "Ash Kuroki・仮のタイトル",
      classic: "en",
      store: "ja",
    });
    await call(page, "setLang", "en");
    const en = await page.evaluate(() => [
      document.documentElement.lang,
      location.pathname,
      document.title,
    ]);
    assert.deepEqual(en, ["en", "/", "Ash Kuroki · Placeholder title"]);
    await context.close();
  },
);

await check("reducedMotion follows prefers-reduced-motion live", async () => {
  const { context, page } = await open("/?view=world&debug", {
    contextOptions: { reducedMotion: "reduce" },
  });
  await waitForCanvas(page);
  assert.equal((await state(page)).reducedMotion, true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(
    () => window.__world.store.getState().reducedMotion === false,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => window.__world.store.getState().reducedMotion === true,
  );
  await context.close();
});

await check("/ja/ in world mode starts the store in Japanese", async () => {
  const { context, page } = await open("/ja/?view=world&debug");
  await waitForCanvas(page);
  assert.equal((await boot(page)).lang, "ja");
  assert.equal((await state(page)).lang, "ja");
  await context.close();
});

// ---------------------------------------------------------------------------
// Runtime and debug parameters (overview § 6.5, § 10)

await check(
  "debug params: shot implies freeze; debug=stats sets stats; no debug param hides window.__world",
  async () => {
    const debugOf = async (path) => {
      const { context, page } = await open(path);
      await waitForCanvas(page);
      const d = await page.evaluate(() =>
        window.__world ? { ...window.__world.runtime.debug } : null,
      );
      const rt = await page.evaluate(() => {
        const c = window.__world?.runtime.character;
        return c
          ? {
              pos: c.position.toArray(),
              yaw: c.yaw,
              speed: c.speed,
              teleport: typeof c.teleport,
            }
          : null;
      });
      await context.close();
      return { d, rt };
    };
    assert.deepEqual((await debugOf("/?view=world&shot=start")).d, {
      shot: "start",
      freeze: true,
      stats: false,
    });
    const stats = await debugOf("/?view=world&debug=stats");
    assert.deepEqual(stats.d, { shot: null, freeze: false, stats: true });
    assert.deepEqual(stats.rt, {
      pos: [0, 0, 0],
      yaw: 0,
      speed: 0,
      teleport: "function",
    });
    assert.equal((await debugOf("/?view=world")).d, null);
  },
);

await check(
  "?debug=stats writes window.__worldStats {calls, triangles} and keeps updating it",
  async () => {
    const { context, page } = await open("/?view=world&debug=stats");
    await waitForCanvas(page);
    await page.waitForFunction(() => window.__worldStats !== undefined, null, {
      timeout: 30_000,
    });
    const first = await page.evaluate(() => {
      window.__firstStats = window.__worldStats;
      return window.__worldStats;
    });
    assert.equal(typeof first.calls, "number");
    assert.equal(typeof first.triangles, "number");
    assert.deepEqual(Object.keys(first).sort(), ["calls", "triangles"]);
    await page.waitForFunction(
      () => window.__worldStats !== window.__firstStats,
      null,
      { timeout: 30_000 },
    );
    console.log(
      `      __worldStats: ${JSON.stringify(await page.evaluate(() => window.__worldStats))}`,
    );
    await context.close();
  },
);

await check(
  "?panel=<id> opens the section via 'world' once window.__worldReady is true",
  async () => {
    const { context, page } = await open("/?view=world&debug&panel=about");
    await waitForCanvas(page);
    await page.waitForTimeout(300);
    assert.equal(
      (await state(page)).openPanel,
      null,
      "opened before __worldReady",
    );
    await page.evaluate(() => (window.__worldReady = true));
    await page.waitForFunction(
      () => window.__world.store.getState().openPanel === "about",
      null,
      { timeout: 2000 },
    );
    assert.equal((await state(page)).autoWalk, null);
    await context.close();

    const bad = await open("/?view=world&debug&panel=nope");
    await waitForCanvas(bad.page);
    await bad.page.evaluate(() => (window.__worldReady = true));
    await bad.page.waitForTimeout(300);
    assert.equal((await state(bad.page)).openPanel, null);
    await bad.context.close();
  },
);

// ---------------------------------------------------------------------------
// Accessibility of world mode (overview § 9) and the fallback

await check(
  "world mode: #world-root leads the DOM; focusing Classic content reveals it",
  async () => {
    const { context, page } = await open("/?view=world");
    await waitForCanvas(page);
    const order = await page.evaluate(
      () =>
        document
          .getElementById("world-root")
          .compareDocumentPosition(document.getElementById("classic-content")) &
        4,
    );
    assert.ok(order, "#world-root should come before #classic-content");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(
      () => !!document.activeElement?.closest("#classic-content"),
    );
    assert.ok(
      focused,
      "first Tab should land in Classic content while the UI is a stub",
    );
    const box = await page.locator("#classic-content").boundingBox();
    assert.ok(
      box && box.width > 300 && box.height > 300,
      `not revealed: ${JSON.stringify(box)}`,
    );
    await context.close();
  },
);

await check(
  "a render error (the renderer can't start) drops to Classic view",
  async () => {
    const init = () => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return type === "webgl2" ? null : get.call(this, type, ...rest);
      };
    };
    // ?view=world skips detection, so the world tries (and fails) to start.
    const { context, page, errors } = await open("/?view=world", { init });
    await page.waitForFunction(
      () => !document.documentElement.classList.contains("world-mode"),
      null,
      { timeout: 15_000 },
    );
    assert.deepEqual(await boot(page).then((b) => [b.mode, b.reason]), [
      "classic",
      "world error",
    ]);
    assert.ok(
      errors.some((e) => /World mode failed/.test(e)),
      errors.join("\n"),
    );
    await page.waitForFunction(
      () => document.getElementById("world-root").childElementCount === 0,
      null,
      { timeout: 5000 },
    );
    const box = await page.locator("#classic-content").boundingBox();
    assert.ok(
      box && box.height > 300,
      "Classic content not visible after fallback",
    );
    await context.close();
  },
);

await check(
  "a lost WebGL context drops to Classic view, logs the reason and unmounts the world",
  async () => {
    const { context, page, errors } = await open("/?view=world", {
      init: captureRenderer,
    });
    await waitForCanvas(page);
    await page.waitForFunction(() => window.__renderers.length > 0);
    await page.waitForTimeout(500); // running for a few frames
    await page.evaluate(() =>
      window.__renderers
        .at(-1)
        .getContext()
        .getExtension("WEBGL_lose_context")
        .loseContext(),
    );
    await page.waitForFunction(
      () => !document.documentElement.classList.contains("world-mode"),
      null,
      { timeout: 5000 },
    );
    const b = await boot(page);
    assert.deepEqual([b.mode, b.reason], ["classic", "world error"]);
    assert.ok(
      errors.some((e) => /World mode failed \(WebGL context lost\)/.test(e)),
      errors.join("\n"),
    );
    await page.waitForFunction(
      () => document.getElementById("world-root").childElementCount === 0,
      null,
      { timeout: 5000 },
    );
    assert.equal(await page.isVisible("#boot-card"), false);
    const box = await page.locator("#classic-content").boundingBox();
    assert.ok(
      box && box.height > 300,
      "Classic content not visible after fallback",
    );
    await context.close();
  },
);

// ---------------------------------------------------------------------------
// Classic view details

await check(
  "lang attributes and the language link (keeps ?view=)",
  async () => {
    for (const [path, lang, other, href] of [
      ["/", "en", "ja", "/ja/"],
      ["/ja/", "ja", "en", "/"],
      ["/?view=classic", "en", "ja", "/ja/?view=classic"],
    ]) {
      const { context, page } = await open(path, {
        contextOptions: { javaScriptEnabled: true },
      });
      const info = await page.evaluate(() => {
        const link = document.querySelector("a[data-lang-link]");
        return {
          html: document.documentElement.lang,
          main: document.getElementById("classic-content").lang,
          link: link.lang,
          hreflang: link.hreflang,
          href: link.getAttribute("href"),
          alternates: [
            ...document.querySelectorAll("link[rel=alternate][hreflang]"),
          ].map((l) => l.hreflang),
          titles: document.querySelectorAll("title").length,
          theme: document.querySelector('meta[name="theme-color"]').content,
        };
      });
      assert.deepEqual(info, {
        html: lang,
        main: lang,
        link: other,
        hreflang: other,
        href,
        alternates: ["en", "ja", "x-default"],
        titles: 1,
        theme: "#0D1322",
      });
      await context.close();
    }
  },
);

await check("favicons and the GA tag are served", async () => {
  const res = await fetch(server.base + "/favicon/favicon-32x32.png");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /image\/png/);
  const html = await (await fetch(server.base + "/")).text();
  assert.ok(html.includes("googletagmanager.com/gtag/js?id=G-20VY92PLKM"));
  assert.ok(html.includes('gtag("config", "G-20VY92PLKM")'));
});

await browser.close();
await server.stop();
console.log(
  failed ? `\n${failed} check(s) failed` : "\nAll acceptance checks passed",
);
process.exit(failed ? 1 : 0);
