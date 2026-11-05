// Toasts (WP-07 step 4): store.toast, bottom-center, in a polite live region.
// The store clears a toast after 4 s; while the pointer or keyboard focus is
// on it, the UI keeps showing it, so its buttons stay reachable.

import { useRef, useState, type FocusEvent } from "react";
import { site } from "../../content/site";
import { useStore, type Toast as ToastData } from "../store";
import { ClassicLink } from "./ClassicLink";
import { uiClick, useLang, useMotionMs, usePresence } from "./common";
import { CanIcon, GaugeIcon } from "./icons";

export function Toast() {
  const toast = useStore((s) => s.toast);
  const lang = useLang();
  const ms = useMotionMs();
  const [focusHeld, setFocusHeld] = useState(false);
  const [hoverHeld, setHoverHeld] = useState(false);

  const lastRef = useRef<ToastData | null>(toast);
  if (toast) lastRef.current = toast;
  const current = toast ?? (focusHeld || hoverHeld ? lastRef.current : null);
  const { mounted, leaving } = usePresence(current !== null, ms);
  const shown = current ?? lastRef.current;

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node && event.currentTarget.contains(next)))
      setFocusHeld(false);
  };

  const dismiss = () => {
    uiClick();
    lastRef.current = null;
    setFocusHeld(false);
    setHoverHeld(false);
    useStore.getState().clearToast();
  };

  return (
    // The live region is always in the DOM, so screen readers announce what
    // appears in it.
    <div className="ui-toast-region" role="status" aria-live="polite">
      {mounted && shown && (
        <div
          className={
            leaving ? "ui-toast ui-glass is-leaving" : "ui-toast ui-glass"
          }
          lang={lang}
          inert={leaving}
          data-kind={shown.kind}
          onFocus={() => setFocusHeld(true)}
          onBlur={onBlur}
          onPointerEnter={() => setHoverHeld(true)}
          onPointerLeave={() => setHoverHeld(false)}
        >
          <p className="ui-toast__message">
            <span className="ui-toast__icon" aria-hidden="true">
              {shown.kind === "slow" ? <GaugeIcon /> : <CanIcon />}
            </span>
            <span className="ui-toast__text">{shown.text}</span>
          </p>
          {shown.kind === "slow" && (
            <div className="ui-toast__actions">
              <ClassicLink
                className="ui-button ui-button--primary ui-button--small"
                control="switch-classic"
              >
                {site.ui.switchToClassic[lang]}
              </ClassicLink>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--small"
                data-control="dismiss"
                onClick={dismiss}
              >
                {site.ui.dismiss[lang]}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
