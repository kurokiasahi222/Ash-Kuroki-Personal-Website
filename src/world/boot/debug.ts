// URL debug options (overview § 10, WP-01 step 7):
//   ?shot=<name>    camera at CAM_shot_<name> (WP-03); implies freeze
//   ?debug=stats    window.__worldStats = { calls, triangles } every 30 frames
//   ?panel=<id>     opens that section once window.__worldReady is true
// Any `debug` or `shot` parameter exposes window.__world = { runtime, store }.
// `debug` takes a comma-separated list; only "stats" means something today.

import { runtime } from "../runtime";
import { isSectionId, store, type SectionId } from "../store";
import type {} from "./types";

export interface DebugParams {
  shot: string | null;
  stats: boolean;
  panel: SectionId | null;
  /** Expose `window.__world`. */
  expose: boolean;
}

export function parseDebugParams(search: string): DebugParams {
  const q = new URLSearchParams(search);
  const flags = (q.get("debug") ?? "").split(",").map((f) => f.trim());
  const panel = q.get("panel");
  return {
    shot: q.get("shot") || null,
    stats: flags.includes("stats"),
    panel: isSectionId(panel) ? panel : null,
    expose: q.has("debug") || q.has("shot"),
  };
}

/** Copies the URL options into `runtime.debug` and sets up the debug hooks. */
export function applyDebugParams(params: DebugParams): void {
  runtime.debug.shot = params.shot;
  runtime.debug.freeze = params.shot !== null;
  runtime.debug.stats = params.stats;

  if (params.expose) window.__world = { runtime, store };

  if (params.panel) {
    const id = params.panel;
    whenWorldReady(() => store.getState().openSection(id, "world"));
  }
}

/** Calls `fn` once `window.__worldReady` is true (WP-03 sets it). */
export function whenWorldReady(fn: () => void): void {
  if (window.__worldReady) {
    fn();
    return;
  }
  const timer = window.setInterval(() => {
    if (!window.__worldReady) return;
    window.clearInterval(timer);
    fn();
  }, 50);
}
