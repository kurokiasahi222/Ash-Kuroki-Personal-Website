// World-mode entry, imported dynamically by client.ts (never in Classic mode).
// Renders <App/> into #world-root. Any render error, or a lost WebGL context,
// unmounts the world and leaves the visitor on Classic view.

import { createRoot, type Root } from "react-dom/client";
import { App } from "../App";
import { applyDebugParams, parseDebugParams } from "./debug";
import { WorldErrorBoundary } from "./ErrorBoundary";
import { fallbackToClassic, hasFallenBack } from "./fallback";

let root: Root | null = null;

export function mount(el: HTMLElement): Root {
  if (root) return root;
  applyDebugParams(parseDebugParams(location.search));

  const fail = (reason: string, error?: unknown) => {
    if (hasFallenBack()) return;
    fallbackToClassic(reason, error);
    // Unmount outside React's current render or commit.
    setTimeout(() => {
      root?.unmount();
      root = null;
    });
  };

  root = createRoot(el, {
    onUncaughtError: (error) => fail("uncaught render error", error),
  });
  root.render(
    <WorldErrorBoundary onError={(error) => fail("render error", error)}>
      <App onFatal={fail} />
    </WorldErrorBoundary>,
  );
  return root;
}
