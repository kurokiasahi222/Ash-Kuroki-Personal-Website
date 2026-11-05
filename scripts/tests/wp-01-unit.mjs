#!/usr/bin/env node
// WP-01 unit checks that run in Node without a browser: the event emitter
// (overview § 6.5) and the placeholder content (§ 6.7). Node 22 strips the
// TypeScript types itself.
//
//   node scripts/tests/wp-01-unit.mjs

import assert from "node:assert/strict";
import { site } from "../../src/content/site.ts";
import { createEmitter, events } from "../../src/world/events.ts";

let failed = 0;
function check(name, fn) {
  try {
    fn();
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

// --- events -----------------------------------------------------------------

check("events: on/emit delivers the payload, in subscription order", () => {
  const e = createEmitter();
  const seen = [];
  e.on("interact", (p) => seen.push(["a", p.id]));
  e.on("interact", (p) => seen.push(["b", p.id]));
  e.emit("interact", { id: "bell" });
  assert.deepEqual(seen, [
    ["a", "bell"],
    ["b", "bell"],
  ]);
});

check(
  "events: off() and the returned unsubscribe both remove a handler",
  () => {
    const e = createEmitter();
    let n = 0;
    const h = () => n++;
    const unsubscribe = e.on("door", h);
    e.emit("door", { open: true });
    unsubscribe();
    e.emit("door", { open: false });
    e.on("door", h);
    e.off("door", h);
    e.emit("door", { open: true });
    assert.equal(n, 1);
  },
);

check("events: payload-less events emit {} without an argument", () => {
  const e = createEmitter();
  const seen = [];
  e.on("footstep", (p) => seen.push(p));
  e.emit("footstep");
  e.emit("uiClick"); // no listener: no-op
  assert.deepEqual(seen, [{}]);
});

check(
  "events: a handler may unsubscribe while emitting; others still run",
  () => {
    const e = createEmitter();
    const seen = [];
    const first = e.on("deck", () => {
      seen.push(1);
      first();
    });
    e.on("deck", () => seen.push(2));
    e.emit("deck", { state: "enter" });
    e.emit("deck", { state: "exit" });
    assert.deepEqual(seen, [1, 2, 2]);
  },
);

check("events: a throwing handler doesn't stop the others", () => {
  const e = createEmitter();
  const seen = [];
  const original = console.error;
  console.error = () => {};
  try {
    e.on("arrive", () => {
      throw new Error("boom");
    });
    e.on("arrive", (p) => seen.push(p.target));
    e.emit("arrive", { target: "about" });
  } finally {
    console.error = original;
  }
  assert.deepEqual(seen, ["about"]);
});

check("events: the shared `events` instance has on/off/emit", () => {
  for (const k of ["on", "off", "emit"])
    assert.equal(typeof events[k], "function");
  const { on, emit } = events; // destructuring must keep working
  let got = null;
  const off = on("interact", (p) => (got = p.id));
  emit("interact", { id: "vending" });
  off();
  assert.equal(got, "vending");
});

// --- content ----------------------------------------------------------------

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

const nonEmpty = (v) =>
  typeof v === "string"
    ? v.trim().length > 0
    : Array.isArray(v) && v.length > 0 && v.every(nonEmpty);

check("content: every L field has non-empty en and ja", () => {
  const found = [...lValues(site)];
  assert.ok(found.length > 40, `only ${found.length} L values found`);
  const bad = found
    .filter(([, l]) => !nonEmpty(l.en) || !nonEmpty(l.ja))
    .map(([p]) => p);
  assert.deepEqual(bad, []);
});

check(
  "content: ui.drinks has the same number of drinks in both languages",
  () => {
    // Flow picks one index for both languages, so the lists must line up.
    assert.equal(site.ui.drinks.en.length, site.ui.drinks.ja.length);
  },
);

check('content: ui.gotDrink contains "{drink}" in both languages', () => {
  assert.ok(site.ui.gotDrink.en.includes("{drink}"));
  assert.ok(site.ui.gotDrink.ja.includes("{drink}"));
});

check(
  "content: builds are drone, gpt2, website; sayhi links are github, linkedin",
  () => {
    assert.deepEqual(
      site.builds.items.map((b) => b.id),
      ["drone", "gpt2", "website"],
    );
    assert.deepEqual(
      site.sayhi.links.map((l) => l.id),
      ["github", "linkedin"],
    );
  },
);

check("content: every ui key from overview § 6.7 is present", () => {
  const keys = [
    "langToggle",
    "soundOn",
    "soundOff",
    "classicView",
    "worldView",
    "skipToText",
    "loading",
    "enterWithSound",
    "enterMuted",
    "controlsHint",
    "controlsHintTouch",
    "interactKey",
    "tapHint",
    "interactVending",
    "interactBell",
    "drinks",
    "gotDrink",
    "close",
    "rideDown",
    "slowToast",
    "switchToClassic",
    "dismiss",
    "footerCredit",
  ];
  assert.deepEqual(Object.keys(site.ui).sort(), [...keys].sort());
});

console.log(
  failed ? `\n${failed} check(s) failed` : "\nAll unit checks passed",
);
process.exit(failed ? 1 : 0);
