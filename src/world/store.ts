// World store: overview § 6.4. State that changes at most a few times a second
// lives here; per-frame data lives in runtime.ts. Change the shape only as a
// contract change in the overview.

import { create } from "zustand";
import { site } from "../content/site";
import type { Lang } from "../content/types";
import type {} from "./boot/types";

export type { Lang };
export type SectionId = "builds" | "about" | "sayhi";
export type InteractionId = "vending" | "bell";
export type Phase = "loading" | "title" | "intro" | "explore" | "deck";
export type Tier = "high" | "low";
export type WalkTarget = SectionId | InteractionId | { x: number; z: number }; // three.js ground coordinates
export type Toast = { kind: "drink" | "slow"; text: string };

export interface WorldState {
  phase: Phase;
  loadProgress: number; // 0..1
  lang: Lang;
  sound: boolean;
  tier: Tier;
  reducedMotion: boolean; // from prefers-reduced-motion, live-updated
  openPanel: SectionId | null;
  nearby: SectionId | InteractionId | null; // set by flow (WP-10)
  autoWalk: WalkTarget | null; // consumed by character (WP-05)
  toast: Toast | null;

  setPhase(p: Phase): void;
  setLoadProgress(n: number): void;
  setLang(l: Lang): void; // also updates <html lang> and history.replaceState('/' | '/ja/')
  setSound(on: boolean): void;
  setTier(t: Tier): void;
  openSection(id: SectionId, via: "menu" | "world"): void; // 'menu' also sets autoWalk = id
  closePanel(): void; // also clears autoWalk
  setNearby(id: SectionId | InteractionId | null): void;
  walkTo(t: WalkTarget): void;
  cancelAutoWalk(): void;
  showToast(t: Toast): void; // auto-clears after 4 s
  clearToast(): void;
}

export const SECTION_IDS: readonly SectionId[] = ["builds", "about", "sayhi"];
export const INTERACTION_IDS: readonly InteractionId[] = ["vending", "bell"];
/** How long a toast stays up. */
export const TOAST_MS = 4000;

export function isSectionId(value: unknown): value is SectionId {
  return SECTION_IDS.includes(value as SectionId);
}

export function isInteractionId(value: unknown): value is InteractionId {
  return INTERACTION_IDS.includes(value as InteractionId);
}

/** The URL path for each language (overview § 2: English at /, Japanese at /ja/). */
export function langPath(lang: Lang): "/" | "/ja/" {
  return lang === "ja" ? "/ja/" : "/";
}

const browser =
  typeof window !== "undefined" && typeof document !== "undefined";

const reducedMotionQuery =
  browser && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

function initialLang(): Lang {
  const lang = browser
    ? (window.__ashBoot?.lang ?? document.documentElement.lang)
    : "en";
  return lang === "ja" ? "ja" : "en";
}

function initialTier(): Tier {
  return browser && window.__ashBoot?.tier === "low" ? "low" : "high";
}

/** setLang's side effects: <html lang>, the page title and the URL path. */
function applyLangToDocument(lang: Lang): void {
  if (!browser) return;
  document.documentElement.lang = lang;
  document.title = site.meta.title[lang];
  const path = langPath(lang);
  if (location.pathname !== path) {
    // Keep the query (?view=world, debug flags) and hash; only the path changes.
    history.replaceState(
      history.state,
      "",
      path + location.search + location.hash,
    );
  }
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<WorldState>()((set, get) => ({
  phase: "loading",
  loadProgress: 0,
  lang: initialLang(),
  sound: false,
  tier: initialTier(),
  reducedMotion: reducedMotionQuery?.matches ?? false,
  openPanel: null,
  nearby: null,
  autoWalk: null,
  toast: null,

  setPhase: (phase) => set({ phase }),
  setLoadProgress: (n) =>
    set({ loadProgress: Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0 }),
  setLang: (lang) => {
    set({ lang });
    applyLangToDocument(lang);
  },
  setSound: (sound) => set({ sound }),
  setTier: (tier) => set({ tier }),
  openSection: (id, via) =>
    set(via === "menu" ? { openPanel: id, autoWalk: id } : { openPanel: id }),
  closePanel: () => set({ openPanel: null, autoWalk: null }),
  setNearby: (nearby) => set({ nearby }),
  walkTo: (autoWalk) => set({ autoWalk }),
  cancelAutoWalk: () => set({ autoWalk: null }),
  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, TOAST_MS);
  },
  clearToast: () => {
    clearTimeout(toastTimer);
    set({ toast: null });
  },
}));

/**
 * The same zustand store as `useStore`. Use `useStore(selector)` inside React
 * components, and `store.getState()` / `store.subscribe()` everywhere else.
 */
export const store = useStore;
export type WorldStore = typeof useStore;

// Live prefers-reduced-motion.
reducedMotionQuery?.addEventListener("change", (event) => {
  useStore.setState({ reducedMotion: event.matches });
});
