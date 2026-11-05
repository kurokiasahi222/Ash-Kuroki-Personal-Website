// <Ui/>: every 2D control over the world (WP-07). App.tsx renders it as a DOM
// sibling of the canvas, inside #world-root, which comes first in the DOM, so
// the skip link here leads the focus order (overview § 9).
//
// It reads only the store, runtime, events and content: nothing here imports
// the scene, character or camera packages, so it works over their stubs.

import { runtime } from "../runtime";
import { ControlsHint } from "./ControlsHint";
import { Menu } from "./Menu";
import { Panel } from "./Panel";
import { SkipLink } from "./SkipLink";
import { TitleCard } from "./TitleCard";
import { injectUiStyles } from "./styles";
import { Toast } from "./Toast";

// Before the first render, so the UI never shows unstyled.
injectUiStyles();

export function Ui() {
  return (
    // data-world-ui marks the overlay, so world keyboard handlers can ignore
    // keys pressed while a UI control has focus.
    <div
      className={runtime.debug.freeze ? "ui-root is-still" : "ui-root"}
      data-world-ui=""
    >
      <SkipLink />
      {/* Toasts come right after the skip link in tab order, so their
          buttons are quick to reach in the 4 s they're up. */}
      <div className="ui-bottom">
        <Toast />
        <ControlsHint />
      </div>
      <TitleCard />
      <Menu />
      <Panel />
    </div>
  );
}
