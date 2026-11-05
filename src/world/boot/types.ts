import type { Lang } from "../../content/types";
import type { Runtime } from "../runtime";
import type { Tier, WorldStore } from "../store";

export type ViewMode = "world" | "classic";

/** Why the boot script picked its view mode (see head.js). */
export type BootReason =
  | "url"
  | "saved"
  | "no webgl2"
  | "software renderer"
  | "save data"
  | "low-end device"
  | "auto"
  | "error"
  | "world error";

/** `window.__ashBoot`, written by the inline head script before first paint. */
export interface AshBoot {
  mode: ViewMode;
  tier: Tier;
  reason: BootReason;
  lang: Lang;
}

/** `window.__worldStats`, written every 30 frames with `?debug=stats`. */
export interface WorldStats {
  calls: number;
  triangles: number;
}

declare global {
  interface Window {
    __ashBoot?: AshBoot;
    /** Debug handles, exposed with any `debug` or `shot` URL parameter. */
    __world?: { runtime: Runtime; store: WorldStore };
    /** Set by WP-03 once the models are loaded and the shot is placed. */
    __worldReady?: boolean;
    __worldStats?: WorldStats;
  }
}
