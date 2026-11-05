// Small helpers shared by the UI overlay (WP-07).

import { useEffect, useState } from "react";
import type { Lang } from "../../content/types";
import { events } from "../events";
import { runtime } from "../runtime";
import { useStore } from "../store";

/** UI transitions: about 200 ms ease-out (WP-07 "Look"), none with reduced motion. */
export const MOTION_MS = 200;

export function useLang(): Lang {
  return useStore((s) => s.lang);
}

export function otherLang(lang: Lang): Lang {
  return lang === "ja" ? "en" : "ja";
}

/** Every UI button calls this: the audio package plays its tick (WP-09). */
export function uiClick(): void {
  events.emit("uiClick");
}

/**
 * How long enter and leave transitions last: 0 with reduced motion, and 0
 * while frozen for shots (overview § 10), so every shot is a still.
 */
export function useMotionMs(): number {
  const reduced = useStore((s) => s.reducedMotion);
  return reduced || runtime.debug.freeze ? 0 : MOTION_MS;
}

/**
 * Keeps an element mounted for `ms` after `show` turns false, so it can play
 * its leave transition. `leaving` is true during that time.
 */
export function usePresence(
  show: boolean,
  ms: number,
): { mounted: boolean; leaving: boolean } {
  const [kept, setKept] = useState(show);

  useEffect(() => {
    if (show) {
      setKept(true);
      return;
    }
    if (ms <= 0) {
      setKept(false);
      return;
    }
    const timer = setTimeout(() => setKept(false), ms);
    return () => clearTimeout(timer);
  }, [show, ms]);

  const mounted = show || (kept && ms > 0);
  return { mounted, leaving: mounted && !show };
}

/** A live `matchMedia` result. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The keyboard-focusable elements inside `root`, in tab order, visible ones only. */
export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.closest("[hidden], [inert]") && el.getClientRects().length > 0,
  );
}
