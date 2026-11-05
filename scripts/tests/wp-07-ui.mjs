#!/usr/bin/env node
// WP-07 acceptance checks for the UI overlay (src/world/ui/), in headless
// Chromium against the dev server: the title card, menu, panels, toasts,
// controls hint and skip link; the keyboard walkthrough; touch; uiClick;
// contrast; and that the UI imports no scene, character or camera code.
// Also saves the WP-07 shots to shots/wp-07/.
//
//   node scripts/tests/wp-07-ui.mjs              checks + shots (starts its own dev server)
//   node scripts/tests/wp-07-ui.mjs --no-shots   checks only
//   node scripts/tests/wp-07-ui.mjs --only-shots shots only
//   node scripts/tests/wp-07-ui.mjs --base <url> against a running dev server
//
// The scene stub never sets window.__worldReady, so every check drives the
// store through window.__world (exposed by the `debug` URL parameter). It
// needs the dev server: it imports /src/world/events.ts and
// /src/content/site.ts in the page, to count uiClick events and to read the
// copy the UI should show.

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "../lib/args.mjs";
import {
  collectErrors,
  contextOptionsFor,
  launchBrowser,
} from "../lib/browser.mjs";
import { ROOT, startServer } from "../lib/server.mjs";

const args = parseArgs(process.argv.slice(2), {
  boolean: ["only-shots"],
});
const runChecks = args["only-shots"] !== true;
const runShots = args.shots !== false;
const SHOTS_DIR = join(ROOT, "shots", "wp-07");

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed++;
    console.log(
      `FAIL  ${name}\n      ${String(error?.stack ?? error)
        .split("\n")
        .slice(0, 24)
        .join("\n      ")}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Static checks (no browser)

/** Every file under src/world/ui/. */
function uiFiles(dir = join(ROOT, "src/world/ui")) {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(tsx?|css)$/.test(f))
    .map((f) => join(dir, f));
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const channel = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (rgb) =>
  0.2126 * channel(rgb[0]) +
  0.7152 * channel(rgb[1]) +
  0.0722 * channel(rgb[2]);
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** `top` at `alpha` over `bottom`. */
const over = (top, alpha, bottom) =>
  top.map((c, i) => c * alpha + bottom[i] * (1 - alpha));

function readTokens() {
  const css = readFileSync(join(ROOT, "src/styles/tokens.css"), "utf8");
  const tokens = {};
  for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi))
    tokens[m[1]] = hex(m[2]);
  return tokens;
}

/**
 * Every text / background pair the UI uses (ui.css), measured on the glass
 * in three conditions: over the night scene (the usual case), over pure
 * white (the worst glow behind the glass; the backdrop is dimmed by
 * brightness(0.4)), and the no-backdrop-filter fallback (dusk 92%) over
 * white. Inner surfaces (cards, chips, link rows) sit on the glass at their
 * own alpha.
 */
function contrastTable() {
  const t = readTokens();
  const white = [255, 255, 255];
  const glass = {
    "over night": over(
      t.dusk,
      0.7,
      t.night.map((c) => c * 0.4),
    ),
    "over white (dimmed)": over(
      t.dusk,
      0.7,
      white.map((c) => c * 0.4),
    ),
    "fallback over white": over(t.dusk, 0.92, white),
  };
  const surfaces = (mix) => ({
    glass: (g) => g,
    "card (night 40%)": (g) => over(t.night, 0.4, g),
    "tag chip (night 70%)": (g) => over(t.night, 0.7, over(t.night, 0.4, g)),
    "active menu item (lamp 14%)": (g) => over(t.lamp, 0.14, g),
    "hover (ink 10%)": (g) => over(t.ink, 0.1, g),
    ...mix,
  });
  const pairs = [
    ["ink", "glass", "body text, titles, menu, buttons, toasts, hint"],
    ["ink-dim", "glass", "tagline, intros, loading label, sound off icon"],
    ["lamp", "active menu item (lamp 14%)", "active menu item"],
    ["ink", "hover (ink 10%)", "hovered button"],
    ["ink", "card (night 40%)", "card titles, body"],
    ["ink-dim", "card (night 40%)", "card summaries"],
    ["lamp", "card (night 40%)", "card links, Say hi badges"],
    ["ink-dim", "tag chip (night 70%)", "tags"],
  ];
  const rows = [];
  for (const [fg, surface, use] of pairs) {
    const r = {};
    for (const [cond, g] of Object.entries(glass))
      r[cond] = ratio(t[fg], surfaces()[surface](g));
    rows.push({ pair: `${fg} on ${surface}`, use, ...r });
  }
  // Opaque pairs: primary buttons and the skip link.
  const solid = [
    [
      "night",
      "lamp",
      "Enter with sound, Ride down, Switch to Classic, skip link",
    ],
    ["night", "tower-white", "primary button hover"],
  ];
  for (const [fg, bg, use] of solid) {
    const v = ratio(t[fg], t[bg]);
    rows.push({
      pair: `${fg} on ${bg}`,
      use,
      ...Object.fromEntries(Object.keys(glass).map((k) => [k, v])),
    });
  }
  return { rows, conditions: Object.keys(glass) };
}

if (runChecks) {
  await check(
    "the UI imports nothing from scene, character or camera",
    async () => {
      const offenders = [];
      for (const file of uiFiles()) {
        const src = readFileSync(file, "utf8");
        for (const m of src.matchAll(
          /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g,
        )) {
          if (/(^|\/)(scene|character|camera)(\/|$)/.test(m[1]))
            offenders.push(`${file.replace(ROOT, "")}: ${m[1]}`);
        }
      }
      assert.deepEqual(offenders, []);
    },
  );

  await check(
    "contrast: every text / background pair is at least 4.5:1",
    async () => {
      const { rows, conditions } = contrastTable();
      const width = Math.max(...rows.map((r) => r.pair.length));
      console.log(
        `      ${"pair".padEnd(width)}  ${conditions.map((c) => c.padStart(20)).join("")}`,
      );
      for (const r of rows)
        console.log(
          `      ${r.pair.padEnd(width)}  ${conditions
            .map((c) => r[c].toFixed(2).padStart(20))
            .join("")}`,
        );
      const low = rows.flatMap((r) =>
        conditions
          .filter((c) => r[c] < 4.5)
          .map((c) => `${r.pair} ${c}: ${r[c].toFixed(2)}`),
      );
      assert.deepEqual(low, []);
    },
  );
}

// ---------------------------------------------------------------------------
// Browser

const server =
  typeof args.base === "string"
    ? { base: args.base.replace(/\/$/, ""), stop: async () => {} }
    : await startServer({ mode: "dev" });
const { browser } = await launchBrowser({ log: console.log });
console.log(`Testing ${server.base}\n`);

/** @type {string[]} */
const allErrors = [];

/** A fresh context and page on a world URL, with the UI mounted. */
async function open(path, { viewport = "desktop", contextOptions = {} } = {}) {
  const context = await browser.newContext({
    ...contextOptionsFor(viewport),
    ...contextOptions,
  });
  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(server.base + path, { waitUntil: "load" });
  await page.waitForSelector(".ui-root", { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  // Count uiClick events and expose the copy (same modules as the app).
  await page.evaluate(async () => {
    const { events } = await import("/src/world/events.ts");
    const { site } = await import("/src/content/site.ts");
    window.__uiClicks = 0;
    events.on("uiClick", () => window.__uiClicks++);
    window.__site = site;
  });
  const close = async () => {
    allErrors.push(...errors.map((e) => `${path}: ${e}`));
    await context.close();
  };
  return { context, page, errors, close };
}

const call = (page, action, ...params) =>
  page.evaluate(
    ([a, p]) => window.__world.store.getState()[a](...p),
    [action, params],
  );
const get = (page, key) =>
  page.evaluate((k) => window.__world.store.getState()[k], key);
const clicks = (page) => page.evaluate(() => window.__uiClicks);
const copy = (page, path) =>
  page.evaluate(
    (p) => p.split(".").reduce((o, k) => o[k], window.__site),
    path,
  );

/** A short name for the focused element. */
const focusName = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "body";
    if (el.getAttribute("role") === "dialog")
      return `dialog:${el.getAttribute("data-section")}`;
    if (el.closest("#classic-content")) return "classic-content";
    return el.getAttribute("data-control") ?? el.tagName.toLowerCase();
  });

/** Presses Tab `n` times and returns the focus names after each press. */
async function tabs(page, n, key = "Tab") {
  const seen = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(key);
    seen.push(await focusName(page));
  }
  return seen;
}

/** Clicks empty world (the canvas), which moves the Tab start before the UI. */
async function clickWorld(page) {
  const size = page.viewportSize();
  await page.mouse.click(size.width / 2, size.height / 2);
}

const dialog = (page) => page.locator('[role="dialog"]');
const waitGone = (page, selector) =>
  page.waitForSelector(selector, { state: "detached", timeout: 3000 });

/** From a fresh page: phase `explore`, menu up, title card gone. */
async function enterWorld(page, phase = "explore") {
  await call(page, "setPhase", phase);
  await page.waitForSelector(".ui-menu");
  await waitGone(page, ".ui-title");
}

if (runChecks) {
  await check(
    "title card: shown while loading with a live loading bar; #boot-card removed; Enter impossible before `title`",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await page.waitForSelector(".ui-title");
      assert.equal(await page.locator("#boot-card").count(), 0, "boot card");
      assert.equal(await get(page, "phase"), "loading");
      const name = await copy(page, "name.en");
      assert.equal(await page.locator(".ui-title__name").innerText(), name);
      assert.equal(
        await page.locator(".ui-title__tagline").innerText(),
        await copy(page, "tagline.en"),
      );
      const bar = page.locator('.ui-title [role="progressbar"]');
      assert.equal(await bar.getAttribute("aria-valuenow"), "0");
      await call(page, "setLoadProgress", 0.5);
      await page.waitForFunction(
        () =>
          document
            .querySelector('.ui-title [role="progressbar"]')
            ?.getAttribute("aria-valuenow") === "50",
      );
      // No Enter buttons, and keys do nothing, before `title`.
      assert.equal(
        await page.locator('[data-control^="enter-"]').count(),
        0,
        "Enter buttons before title",
      );
      for (const key of ["Enter", "Space", "Tab", "Enter"])
        await page.keyboard.press(key);
      assert.equal(await get(page, "phase"), "loading");
      await close();
    },
  );

  await check(
    "title: focus lands on Enter with sound; Tab order skip link → Enter buttons; Enter with sound → sound on, uiClick, intro",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await page.waitForSelector(".ui-title");
      await call(page, "setPhase", "title");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("data-control") ===
          "enter-sound",
        null,
        { timeout: 3000 },
      );
      assert.deepEqual(await tabs(page, 1, "Shift+Tab"), ["skip"]);
      assert.deepEqual(await tabs(page, 3), [
        "enter-sound",
        "enter-muted",
        "title-classic",
      ]);
      await tabs(page, 2, "Shift+Tab");
      assert.equal(await focusName(page), "enter-sound");
      await page.keyboard.press("Enter");
      assert.equal(await get(page, "phase"), "intro");
      assert.equal(await get(page, "sound"), true);
      assert.equal(await clicks(page), 1, "uiClick");
      await waitGone(page, ".ui-title");
      await page.waitForSelector(".ui-menu");
      // Focus went with the card; the next Tab goes on into the UI.
      const next = await tabs(page, 1);
      console.log(`      first Tab after entering: ${next[0]}`);
      assert.ok(["skip", "menu-about"].includes(next[0]), next[0]);
      await close();
    },
  );

  await check(
    "Enter muted → sound off, uiClick, intro; the title card leaves",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await page.waitForSelector(".ui-title");
      await call(page, "setSound", true);
      await call(page, "setPhase", "title");
      await page.click('[data-control="enter-muted"]');
      assert.deepEqual(
        [await get(page, "phase"), await get(page, "sound")],
        ["intro", false],
      );
      assert.equal(await clicks(page), 1);
      await waitGone(page, ".ui-title");
      await close();
    },
  );

  await check(
    "once in: Tab order skip link → menu items → toggles → Classic view",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await enterWorld(page, "intro");
      await clickWorld(page);
      assert.deepEqual(await tabs(page, 7), [
        "skip",
        "menu-about",
        "menu-builds",
        "menu-sayhi",
        "lang",
        "sound",
        "classic",
      ]);
      // The hint isn't up in `intro`, and nothing else is focusable.
      await call(page, "setPhase", "explore");
      await clickWorld(page);
      assert.deepEqual(await tabs(page, 2), ["skip", "menu-about"]);
      await close();
    },
  );

  await check(
    "menu: items are the section titles in order; each opens its panel with openSection(id, 'menu')",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await enterWorld(page);
      const labels = await page
        .locator(".ui-menu__item")
        .evaluateAll((els) => els.map((e) => e.textContent));
      assert.deepEqual(labels, [
        await copy(page, "about.title.en"),
        await copy(page, "builds.title.en"),
        await copy(page, "sayhi.title.en"),
      ]);
      for (const id of ["about", "builds", "sayhi"]) {
        await page.click(`[data-control="menu-${id}"]`);
        assert.equal(await get(page, "openPanel"), id);
        assert.equal(await get(page, "autoWalk"), id);
        assert.equal(
          await page.getAttribute(
            `[data-control="menu-${id}"]`,
            "aria-expanded",
          ),
          "true",
        );
        assert.equal(await dialog(page).getAttribute("data-section"), id);
      }
      assert.equal(await clicks(page), 3);
      await close();
    },
  );

  await check(
    "panels by keyboard: Enter opens, focus moves in, Tab stays inside, Esc closes and returns focus",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await enterWorld(page);
      for (const [i, id] of ["about", "builds", "sayhi"].entries()) {
        await clickWorld(page);
        await tabs(page, 2 + i); // skip link, then the menu item
        assert.equal(await focusName(page), `menu-${id}`);
        const before = await clicks(page);
        await page.keyboard.press("Enter");
        await dialog(page).waitFor();
        assert.equal(await focusName(page), `dialog:${id}`);
        assert.equal(await clicks(page), before + 1, "uiClick on Enter");
        const info = await dialog(page).evaluate((d) => ({
          modal: d.getAttribute("aria-modal"),
          labelled: document.getElementById(d.getAttribute("aria-labelledby"))
            ?.textContent,
        }));
        assert.deepEqual(info, {
          modal: "true",
          labelled: await copy(page, `${id}.title.en`),
        });
        // Tab cycles inside the dialog.
        const count = await dialog(page).evaluate(
          (d) =>
            [...d.querySelectorAll("a[href], button")].filter(
              (e) => !e.closest("[hidden]"),
            ).length,
        );
        const ring = await tabs(page, count + 1);
        assert.equal(ring[0], "close", "first stop is the close button");
        assert.equal(ring[count], "close", `wraps after ${count}: ${ring}`);
        assert.ok(
          await page.evaluate(
            () => !!document.activeElement?.closest('[role="dialog"]'),
          ),
          "focus left the dialog",
        );
        await tabs(page, 1, "Shift+Tab");
        assert.ok(
          await page.evaluate(
            () => !!document.activeElement?.closest('[role="dialog"]'),
          ),
          "Shift+Tab left the dialog",
        );
        await page.keyboard.press("Escape");
        assert.equal(await get(page, "openPanel"), null);
        assert.equal(await get(page, "autoWalk"), null);
        await waitGone(page, '[role="dialog"]');
        assert.equal(await focusName(page), `menu-${id}`, "focus returned");
      }
      await close();
    },
  );

  await check(
    "panel content: About photo then paragraphs; three build cards with expandable body; Say hi links; close button",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await enterWorld(page);
      await call(page, "openSection", "about", "world");
      await dialog(page).waitFor();
      const about = await dialog(page).evaluate((d) => ({
        first: d.querySelector(".ui-panel__body > * > *")?.tagName,
        src: d.querySelector("img")?.getAttribute("src"),
        alt: d.querySelector("img")?.getAttribute("alt"),
        paragraphs: [...d.querySelectorAll(".ui-prose p")].map(
          (p) => p.textContent,
        ),
      }));
      assert.deepEqual(about, {
        first: "IMG",
        src: await copy(page, "about.photo.src"),
        alt: await copy(page, "about.photo.alt.en"),
        paragraphs: await copy(page, "about.paragraphs.en"),
      });

      await call(page, "openSection", "builds", "world");
      await page.waitForSelector('[role="dialog"][data-section="builds"]');
      const items = await copy(page, "builds.items");
      const cards = await dialog(page).evaluate((d) =>
        [...d.querySelectorAll(".ui-card")].map((c) => ({
          id: c.getAttribute("data-build"),
          title: c.querySelector(".ui-card__toggle")?.textContent,
          summary: c.querySelector(".ui-card__summary")?.textContent,
          image: !!c.querySelector(".ui-card__image"),
          expanded: c
            .querySelector(".ui-card__toggle")
            ?.getAttribute("aria-expanded"),
          bodyHidden: c.querySelector(".ui-card__body")?.hidden,
          tags: [...c.querySelectorAll(".ui-tags li")].map(
            (t) => t.textContent,
          ),
          links: [...c.querySelectorAll(".ui-card__links a")].map((a) =>
            a.getAttribute("href"),
          ),
        })),
      );
      assert.deepEqual(
        cards,
        items.map((b) => ({
          id: b.id,
          title: b.title.en,
          summary: b.summary.en,
          image: true,
          expanded: "false",
          bodyHidden: true,
          tags: b.tags,
          links: b.links.map((l) => l.href),
        })),
      );
      const before = await clicks(page);
      await page.click(
        '.ui-card[data-build="drone"] [data-control="build-toggle"]',
      );
      assert.equal(await clicks(page), before + 1);
      const body = page.locator('.ui-card[data-build="drone"] .ui-card__body');
      assert.equal(await body.isVisible(), true);
      assert.deepEqual(
        await body.locator("p").allTextContents(),
        items[0].body.en,
      );
      await page.keyboard.press("Enter"); // the toggle has focus: collapse
      assert.equal(await body.isVisible(), false);

      await call(page, "openSection", "sayhi", "world");
      await page.waitForSelector('[role="dialog"][data-section="sayhi"]');
      const links = await dialog(page)
        .locator(".ui-sayhi__link")
        .evaluateAll((as) =>
          as.map((a) => [a.getAttribute("href"), a.textContent.trim()]),
        );
      assert.deepEqual(
        links,
        (await copy(page, "sayhi.links")).map((l) => [l.href, l.label.en]),
      );
      assert.equal(
        await page.locator('[data-control="ride-down"]').count(),
        0,
        "Ride down outside the deck",
      );
      const n = await clicks(page);
      await page.click('[data-control="close"]');
      assert.equal(await get(page, "openPanel"), null);
      assert.equal(await clicks(page), n + 1);
      await close();
    },
  );

  await check(
    "switching language with a panel open swaps the text in place, and every text element carries lang",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await enterWorld(page);
      await page.click('[data-control="menu-builds"]');
      await dialog(page).waitFor();
      await page.click(
        '.ui-card[data-build="drone"] [data-control="build-toggle"]',
      );
      await dialog(page).evaluate((d) => (d.__marker = "same element"));
      assert.equal(
        await page.locator('[data-control="lang"]').innerText(),
        await copy(page, "ui.langToggle.en"),
      );
      assert.equal(
        await page.getAttribute('[data-control="lang"]', "lang"),
        "ja",
      );
      const n = await clicks(page);
      await page.click('[data-control="lang"]');
      assert.equal(await clicks(page), n + 1);
      assert.equal(await get(page, "lang"), "ja");
      const ja = await dialog(page).evaluate((d) => ({
        marker: d.__marker,
        lang: d.lang,
        title: d.querySelector(".ui-panel__title")?.textContent,
        card: d.querySelector(".ui-card__toggle")?.textContent,
        expanded: d
          .querySelector(".ui-card__toggle")
          ?.getAttribute("aria-expanded"),
      }));
      assert.deepEqual(ja, {
        marker: "same element",
        lang: "ja",
        title: await copy(page, "builds.title.ja"),
        card: await copy(page, "builds.items.0.title.ja"),
        expanded: "true",
      });
      assert.equal(
        await page.locator(".ui-menu__item").first().innerText(),
        await copy(page, "about.title.ja"),
      );
      assert.deepEqual(
        await page.evaluate(() => [
          document.documentElement.lang,
          location.pathname,
        ]),
        ["ja", "/ja/"],
      );

      // Every element with its own text has a lang inside the UI: the store's
      // language, except the language toggle (the other language) and tags.
      await call(page, "showToast", { kind: "slow", text: "テスト" });
      await page.waitForSelector(".ui-toast");
      const wrong = await page.evaluate(() => {
        const out = [];
        const root = document.querySelector(".ui-root");
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent.trim()) continue;
          const el = n.parentElement;
          const holder = el.closest("[lang]");
          const expected = el.closest('[data-control="lang"]')
            ? "en"
            : el.closest(".ui-tags")
              ? "en"
              : "ja";
          if (!holder || !root.contains(holder) || holder.lang !== expected)
            out.push(`${n.textContent.trim()} → ${holder?.lang}`);
        }
        return out;
      });
      assert.deepEqual(wrong, []);
      await close();
    },
  );

  await check(
    "toggles by keyboard: sound (aria-pressed) and language; Classic view saves ash.view and goes to ?view=classic",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await enterWorld(page);
      await clickWorld(page);
      await tabs(page, 6);
      assert.equal(await focusName(page), "sound");
      const sound = page.locator('[data-control="sound"]');
      assert.equal(await sound.getAttribute("aria-pressed"), "false");
      assert.equal(
        await sound.getAttribute("aria-label"),
        await copy(page, "ui.soundOn.en"),
      );
      assert.ok(await sound.locator("svg").count(), "speaker icon");
      await page.keyboard.press("Space");
      assert.equal(await get(page, "sound"), true);
      assert.equal(await sound.getAttribute("aria-pressed"), "true");
      await page.keyboard.press("Enter");
      assert.equal(await get(page, "sound"), false);
      assert.equal(await clicks(page), 2);

      await page.keyboard.press("Shift+Tab");
      assert.equal(await focusName(page), "lang");
      await page.keyboard.press("Enter");
      assert.equal(await get(page, "lang"), "ja");
      await page.keyboard.press("Enter");
      assert.equal(await get(page, "lang"), "en");
      await page.keyboard.press("Enter"); // back to Japanese for the next step

      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      assert.equal(await focusName(page), "classic");
      const link = page.locator('[data-control="classic"]');
      assert.equal(await link.getAttribute("data-view-choice"), "classic");
      await Promise.all([
        page.waitForURL(/view=classic/),
        page.keyboard.press("Enter"),
      ]);
      const after = await page.evaluate(() => ({
        saved: localStorage.getItem("ash.view"),
        mode: window.__ashBoot?.mode,
        path: location.pathname,
        search: location.search,
      }));
      assert.deepEqual(after, {
        saved: "classic",
        mode: "classic",
        path: "/ja/",
        search: "?view=classic",
      });
      await close();
    },
  );

  await check("Classic view link works with storage blocked", async () => {
    const context = await browser.newContext(contextOptionsFor("desktop"));
    await context.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto(server.base + "/?view=world&debug", { waitUntil: "load" });
    await page.waitForSelector(".ui-root");
    await call(page, "setPhase", "explore");
    await Promise.all([
      page.waitForURL(/view=classic/),
      page.click('[data-control="classic"]'),
    ]);
    assert.equal(await page.evaluate(() => window.__ashBoot?.mode), "classic");
    assert.deepEqual(
      errors.filter((e) => /pageerror/.test(e)),
      [],
    );
    await context.close();
  });

  await check(
    "skip link: first focusable; Enter reveals and focuses the Classic content",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await page.keyboard.press("Tab");
      assert.equal(await focusName(page), "skip");
      const skip = page.locator('[data-control="skip"]');
      assert.equal(await skip.getAttribute("href"), "#classic-content");
      assert.equal(
        await skip.innerText(),
        await copy(page, "ui.skipToText.en"),
      );
      assert.equal(await skip.isVisible(), true);
      const box = await skip.boundingBox();
      assert.ok(
        box && box.y >= 0,
        `skip link off screen: ${JSON.stringify(box)}`,
      );
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => !!document.activeElement?.closest("#classic-content"),
      );
      const classic = await page.locator("#classic-content").boundingBox();
      assert.ok(classic && classic.height > 300, JSON.stringify(classic));
      await close();
    },
  );

  await check(
    "toasts: polite live region; auto-clear; `slow` adds Switch to Classic + Dismiss, reachable by keyboard and kept while focused",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await enterWorld(page);
      const region = page.locator(".ui-toast-region");
      assert.deepEqual(
        await region.evaluate((r) => [
          r.getAttribute("role"),
          r.getAttribute("aria-live"),
        ]),
        ["status", "polite"],
      );
      await call(page, "showToast", {
        kind: "drink",
        text: "Got a melon soda",
      });
      await page.waitForSelector(".ui-toast-region .ui-toast");
      assert.equal(
        await page.locator(".ui-toast__text").innerText(),
        "Got a melon soda",
      );
      assert.equal(
        await page.locator(".ui-toast button, .ui-toast a").count(),
        0,
      );
      await page.waitForSelector(".ui-toast", {
        state: "detached",
        timeout: 6000,
      });

      const text = await copy(page, "ui.slowToast.en");
      await call(page, "showToast", { kind: "slow", text });
      await page.waitForSelector(".ui-toast");
      const sw = page.locator('[data-control="switch-classic"]');
      assert.equal(
        await sw.innerText(),
        await copy(page, "ui.switchToClassic.en"),
      );
      assert.deepEqual(
        [
          await sw.getAttribute("href"),
          await sw.getAttribute("data-view-choice"),
        ],
        ["?view=classic", "classic"],
      );
      await clickWorld(page);
      assert.deepEqual(await tabs(page, 3), [
        "skip",
        "switch-classic",
        "dismiss",
      ]);
      await page.waitForTimeout(4600);
      assert.equal(await get(page, "toast"), null, "store auto-clears");
      assert.equal(
        await page.locator(".ui-toast").isVisible(),
        true,
        "toast kept while focused",
      );
      const n = await clicks(page);
      await page.keyboard.press("Enter");
      assert.equal(await clicks(page), n + 1);
      await page.waitForSelector(".ui-toast", {
        state: "detached",
        timeout: 3000,
      });

      // Switch to Classic behaves like the menu link.
      await call(page, "showToast", { kind: "slow", text });
      await Promise.all([
        page.waitForURL(/view=classic/),
        page.click('[data-control="switch-classic"]'),
      ]);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("ash.view")),
        "classic",
      );
      await close();
    },
  );

  await check(
    "controls hint: from `explore` until the character moves; touch copy with a coarse pointer",
    async () => {
      const { page, close } = await open("/?view=world&debug");
      await call(page, "setPhase", "intro");
      await page.waitForSelector(".ui-menu");
      assert.equal(await page.locator(".ui-hint").count(), 0, "hint in intro");
      await call(page, "setPhase", "explore");
      await page.waitForSelector(".ui-hint");
      assert.equal(
        await page.locator(".ui-hint").innerText(),
        await copy(page, "ui.controlsHint.en"),
      );
      await page.evaluate(() => (window.__world.runtime.character.speed = 1.2));
      await page.waitForSelector(".ui-hint", {
        state: "detached",
        timeout: 3000,
      });
      await page.evaluate(() => (window.__world.runtime.character.speed = 0));
      await call(page, "setPhase", "deck");
      await call(page, "setPhase", "explore");
      await page.waitForTimeout(300);
      assert.equal(await page.locator(".ui-hint").count(), 0, "hint came back");
      await close();

      const mobile = await open("/?view=world&debug", { viewport: "mobile" });
      await mobile.page.evaluate(() =>
        window.__world.store.getState().setPhase("explore"),
      );
      await mobile.page.waitForSelector(".ui-hint");
      assert.equal(
        await mobile.page.locator(".ui-hint").innerText(),
        await copy(mobile.page, "ui.controlsHintTouch.en"),
      );
      await mobile.close();
    },
  );

  await check("controls hint: hides after 10 s without movement", async () => {
    const { page, close } = await open("/?view=world&debug");
    await call(page, "setPhase", "explore");
    await page.waitForSelector(".ui-hint");
    await page.waitForTimeout(9000);
    assert.equal(await page.locator(".ui-hint").count(), 1, "gone before 10 s");
    await page.waitForSelector(".ui-hint", {
      state: "detached",
      timeout: 2500,
    });
    await close();
  });

  await check(
    "deck: Say hi shows Ride down, which closes the panel (and uiClick); also via ?shot=deck&panel=sayhi",
    async () => {
      const { page, close } = await open("/?view=world&shot=deck&panel=sayhi");
      await call(page, "setPhase", "deck");
      await page.evaluate(() => (window.__worldReady = true)); // WP-03's job
      await page.waitForSelector('[role="dialog"][data-section="sayhi"]');
      const ride = page.locator('[data-control="ride-down"]');
      assert.equal(await ride.innerText(), await copy(page, "ui.rideDown.en"));
      const n = await clicks(page);
      await ride.click();
      assert.equal(await get(page, "openPanel"), null);
      assert.equal(await clicks(page), n + 1);
      await close();
    },
  );

  await check(
    "layout: desktop top-left bar and 420 px right sheet; mobile 56 px bottom bar and a bottom sheet ≤ 75% that scrolls inside",
    async () => {
      const d = await open("/?view=world&debug");
      await enterWorld(d.page);
      await call(d.page, "openSection", "builds", "world");
      await dialog(d.page).waitFor();
      await d.page.waitForTimeout(300);
      const menu = await d.page.locator(".ui-menu").boundingBox();
      const sheet = await dialog(d.page).boundingBox();
      assert.ok(menu.x === 16 && menu.y === 16, JSON.stringify(menu));
      assert.equal(sheet.width, 420);
      assert.equal(sheet.x + sheet.width, 1440 - 16);
      assert.ok(
        sheet.y >= menu.y + menu.height || menu.x + menu.width <= sheet.x,
        `sheet covers the menu: ${JSON.stringify({ menu, sheet })}`,
      );
      await d.close();

      const m = await open("/?view=world&debug", { viewport: "mobile" });
      await enterWorld(m.page);
      await call(m.page, "openSection", "builds", "world");
      await dialog(m.page).waitFor();
      await m.page.waitForTimeout(300);
      const bar = await m.page.locator(".ui-menu").boundingBox();
      assert.deepEqual(
        [bar.x, bar.width, bar.height, bar.y + bar.height],
        [0, 390, 56, 844],
      );
      const bottom = await dialog(m.page).boundingBox();
      assert.ok(bottom.height <= 0.75 * 844 + 0.5, `height ${bottom.height}`);
      assert.ok(bottom.y + bottom.height <= bar.y, "sheet over the bar");
      const scroll = await m.page
        .locator(".ui-panel__body")
        .evaluate((b) => [
          getComputedStyle(b).overflowY,
          b.scrollHeight > b.clientHeight,
        ]);
      assert.deepEqual(scroll, ["auto", true]);
      // The page itself never scrolls.
      assert.equal(
        await m.page.evaluate(() => document.scrollingElement.scrollTop),
        0,
      );
      await m.close();
    },
  );

  await check(
    "touch: tapping menu items, toggles and the close button works",
    async () => {
      const { page, close } = await open("/?view=world&debug", {
        viewport: "mobile",
      });
      await enterWorld(page);
      await page.tap('[data-control="menu-about"]');
      assert.equal(await get(page, "openPanel"), "about");
      await page.tap('[data-control="menu-sayhi"]');
      assert.equal(await get(page, "openPanel"), "sayhi");
      await page.tap('[data-control="close"]');
      assert.equal(await get(page, "openPanel"), null);
      await page.tap('[data-control="sound"]');
      assert.equal(await get(page, "sound"), true);
      await page.tap('[data-control="lang"]');
      assert.equal(await get(page, "lang"), "ja");
      assert.equal(await clicks(page), 5);
      await Promise.all([
        page.waitForURL(/view=classic/),
        page.tap('[data-control="classic"]'),
      ]);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("ash.view")),
        "classic",
      );
      await close();
    },
  );

  await check(
    "look: M PLUS Rounded 1c, 16 px radius, lamp focus rings, glass surfaces; no motion with reduced motion",
    async () => {
      const { page, close } = await open("/?view=world&debug", {
        contextOptions: { reducedMotion: "reduce" },
      });
      await enterWorld(page);
      await clickWorld(page);
      await tabs(page, 2);
      const look = await page.evaluate(() => {
        const menu = getComputedStyle(document.querySelector(".ui-menu"));
        const btn = getComputedStyle(document.activeElement);
        return {
          font: menu.fontFamily.split(",")[0].replaceAll('"', ""),
          // Google Fonts splits it into unicode-range subsets; one loaded
          // bold face is enough to show it's in use.
          loaded: [...document.fonts].some(
            (f) =>
              f.family.replaceAll('"', "") === "M PLUS Rounded 1c" &&
              f.weight === "700" &&
              f.status === "loaded",
          ),
          radius: menu.borderRadius,
          blur: menu.backdropFilter,
          ring: [btn.outlineStyle, btn.outlineWidth, btn.outlineColor],
          animation: menu.animationName,
        };
      });
      assert.deepEqual(look, {
        font: "M PLUS Rounded 1c",
        loaded: true,
        radius: "16px",
        blur: "blur(12px) brightness(0.4)",
        ring: ["solid", "3px", "rgb(255, 194, 122)"],
        animation: "none",
      });
      // Reduced motion: panels close at once.
      await page.keyboard.press("Enter");
      await dialog(page).waitFor();
      await page.keyboard.press("Escape");
      await page.waitForSelector('[role="dialog"]', {
        state: "detached",
        timeout: 100,
      });
      await close();
    },
  );
}

// ---------------------------------------------------------------------------
// Shots: desktop and mobile, EN and JA (WP-07 acceptance)

async function shoot() {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const saved = [];
  for (const viewport of ["desktop", "mobile"]) {
    for (const lang of ["en", "ja"]) {
      const prefix = lang === "ja" ? "/ja/" : "/";
      const tag = `${lang}-${viewport}`;
      const snap = async (page, name) => {
        await page.waitForTimeout(350); // let 200 ms transitions finish
        const file = join(SHOTS_DIR, `${name}-${tag}.png`);
        await page.screenshot({ path: file });
        saved.push(file.replace(ROOT, ""));
      };

      const { page, close } = await open(`${prefix}?view=world&debug`, {
        viewport,
      });
      await page.waitForSelector(".ui-title");
      await call(page, "setLoadProgress", 0.42);
      await snap(page, "title-loading");
      await call(page, "setPhase", "title");
      await page.waitForSelector('[data-control="enter-sound"]');
      await snap(page, "title");
      await page.click('[data-control="enter-muted"]');
      await call(page, "setPhase", "explore"); // WP-06 does this after the intro
      await waitGone(page, ".ui-title");
      await snap(page, "menu");
      for (const id of ["about", "builds", "sayhi"]) {
        await page.click(`[data-control="menu-${id}"]`);
        await page.waitForSelector(`[role="dialog"][data-section="${id}"]`);
        await snap(page, `panel-${id}`);
      }
      await call(page, "openSection", "builds", "world");
      await page.click(
        '.ui-card[data-build="drone"] [data-control="build-toggle"]',
      );
      await snap(page, "panel-builds-expanded");
      await call(page, "closePanel");
      await call(page, "showToast", {
        kind: "slow",
        text: await copy(page, `ui.slowToast.${lang}`),
      });
      await page.waitForSelector(".ui-toast");
      await snap(page, "toast-slow");
      await close();

      const deck = await open(`${prefix}?view=world&shot=deck&panel=sayhi`, {
        viewport,
      });
      await call(deck.page, "setPhase", "deck");
      await deck.page.evaluate(() => (window.__worldReady = true));
      await deck.page.waitForSelector('[data-control="ride-down"]');
      await snap(deck.page, "deck-sayhi");
      await deck.close();
    }
  }

  // The glass over bright glows. The scene is a stub, so paint lamp, vending
  // and tower colors behind the UI: text stays readable (contrast check).
  for (const viewport of ["desktop", "mobile"]) {
    const { page, close } = await open("/?view=world&debug", { viewport });
    await page.evaluate(() => {
      const glow = document.createElement("div");
      glow.style.cssText = `position:absolute;inset:0;background:
        radial-gradient(circle at 80% 32%, var(--vending) 0 13%, transparent 14%),
        radial-gradient(circle at 90% 72%, var(--tower) 0 12%, transparent 13%),
        radial-gradient(circle at 55% 60%, var(--lamp) 0 10%, transparent 11%),
        radial-gradient(circle at 20% 88%, var(--vending) 0 9%, transparent 10%),
        linear-gradient(90deg, transparent 66%, #fff 66% 72%, transparent 72%)`;
      const root = document.getElementById("world-root");
      root.insertBefore(glow, root.querySelector(".ui-root"));
    });
    await enterWorld(page);
    await call(page, "openSection", "builds", "world");
    await page.waitForSelector('[role="dialog"]');
    await call(page, "showToast", {
      kind: "drink",
      text: (await copy(page, "ui.gotDrink.en")).replace(
        "{drink}",
        (await copy(page, "ui.drinks.en"))[0],
      ),
    });
    await page.waitForTimeout(350);
    const file = join(SHOTS_DIR, `glass-over-glow-en-${viewport}.png`);
    await page.screenshot({ path: file });
    saved.push(file.replace(ROOT, ""));
    await close();
  }
  console.log(`\nSaved ${saved.length} shots to shots/wp-07/`);
}

if (runShots) {
  await check("shots", shoot);
}

if (allErrors.length) {
  failed++;
  console.log(`FAIL  no console errors\n      ${allErrors.join("\n      ")}`);
} else {
  console.log("PASS  no console errors");
}

await browser.close();
await server.stop();
console.log(
  failed ? `\n${failed} check(s) failed` : "\nAll WP-07 checks passed",
);
process.exit(failed ? 1 : 0);
