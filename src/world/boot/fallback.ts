import type {} from "./types";

let fellBack = false;

/**
 * Leaves world mode for good and shows the Classic view: removes
 * `html.world-mode` (which hides `#world-root` and the boot card and reveals
 * the Classic content), updates `window.__ashBoot` and logs the reason.
 * Safe to call more than once; only the first call logs.
 */
export function fallbackToClassic(reason: string, error?: unknown): void {
  if (fellBack) return;
  fellBack = true;
  document.documentElement.classList.remove("world-mode");
  const boot = window.__ashBoot;
  if (boot) {
    boot.mode = "classic";
    boot.reason = "world error";
  }
  console.error(
    `[boot] World mode failed (${reason}); showing Classic view.`,
    error ?? "",
  );
}

export function hasFallenBack(): boolean {
  return fellBack;
}
