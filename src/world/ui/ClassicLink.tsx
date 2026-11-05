// "Classic view" links: the menu's, and the slow toast's "Switch to Classic
// view". Both save the choice and go to ?view=classic on the current path, so
// the language is kept (overview § 8).

import type { ReactNode } from "react";
import { uiClick } from "./common";

const VIEW_KEY = "ash.view";

/** Saves the visitor's choice of Classic view. Storage may be blocked. */
export function saveClassicChoice(): void {
  try {
    localStorage.setItem(VIEW_KEY, "classic");
  } catch {
    // storage blocked: the URL parameter still applies to this visit
  }
}

export function ClassicLink({
  className,
  control,
  children,
}: {
  className?: string;
  /** data-control, which tests use to find the link. */
  control?: string;
  children: ReactNode;
}) {
  // data-view-choice: boot/client.ts saves the same choice for every such link.
  return (
    <a
      className={className}
      href="?view=classic"
      data-view-choice="classic"
      data-control={control}
      onClick={() => {
        saveClassicChoice();
        uiClick();
      }}
    >
      {children}
    </a>
  );
}
