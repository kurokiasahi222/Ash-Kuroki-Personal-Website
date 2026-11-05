// Section panels (WP-07 step 3): one dialog that renders the open section from
// site.ts in the store's language. Desktop: a 420 px right-hand sheet. Mobile:
// a bottom sheet up to 75% of the viewport height (ui.css).
//
// Focus moves into the panel when it opens, Tab cycles inside it, Esc and the
// close button call closePanel(), and focus returns to whatever opened it.
// Pointer input outside isn't blocked: the world keeps going behind the panel.

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type Ref,
} from "react";
import { site } from "../../content/site";
import { useStore, type SectionId } from "../store";
import {
  focusablesIn,
  uiClick,
  useLang,
  useMotionMs,
  usePresence,
} from "./common";
import { CloseIcon } from "./icons";
import { isInWorld } from "./Menu";
import { AboutSection } from "./sections/About";
import { BuildsSection } from "./sections/Builds";
import { SayHiSection } from "./sections/SayHi";

export function Panel() {
  const openPanel = useStore((s) => s.openPanel);
  const phase = useStore((s) => s.phase);
  const ms = useMotionMs();
  // Panels belong to the world; the title card covers everything before it.
  const section = isInWorld(phase) ? openPanel : null;

  // The last section shown, so the panel keeps its content while it leaves.
  const lastRef = useRef<SectionId | null>(section);
  if (section) lastRef.current = section;

  const { mounted, leaving } = usePresence(section !== null, ms);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const shown = section ?? lastRef.current;

  // Focus in on open (and on a switch to another section), back out on close.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const active =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const inside = !!(dialog && active && dialog.contains(active));
    const idle = !active || active === document.body;

    if (section) {
      if (active && !idle && !inside) openerRef.current = active;
      if (dialog) {
        dialog.querySelector(".ui-panel__body")?.scrollTo({ top: 0 });
        dialog.focus({ preventScroll: true });
      }
      return;
    }

    // Closed: give focus back, unless the visitor has moved it elsewhere.
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected && (inside || idle)) {
      opener.focus({ preventScroll: true });
    } else if (inside) {
      active?.blur();
    }
  }, [section]);

  // Esc closes the panel wherever focus is (but not inside the Classic overlay).
  useEffect(() => {
    if (!section) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (
        event.target instanceof Element &&
        event.target.closest("#classic-content")
      )
        return;
      event.preventDefault();
      useStore.getState().closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [section]);

  if (!mounted || !shown) return null;

  return (
    <PanelView
      ref={dialogRef}
      section={shown}
      leaving={leaving}
      inDeck={phase === "deck"}
    />
  );
}

function PanelView({
  ref,
  section,
  leaving,
  inDeck,
}: {
  ref: Ref<HTMLDivElement>;
  section: SectionId;
  leaving: boolean;
  inDeck: boolean;
}) {
  const lang = useLang();
  const titleId = useId();

  const close = () => {
    uiClick();
    useStore.getState().closePanel();
  };

  // Keep Tab inside the dialog.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget;
    const items = focusablesIn(dialog);
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={ref}
      className={leaving ? "ui-panel ui-glass is-leaving" : "ui-panel ui-glass"}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      lang={lang}
      inert={leaving}
      data-section={section}
      onKeyDown={onKeyDown}
    >
      <header className="ui-panel__header">
        <h2 id={titleId} className="ui-panel__title">
          {site[section].title[lang]}
        </h2>
        <button
          type="button"
          className="ui-button ui-button--icon ui-panel__close"
          data-control="close"
          onClick={close}
        >
          <CloseIcon />
          <span className="ui-sr-only">{site.ui.close[lang]}</span>
        </button>
      </header>
      <div className="ui-panel__body">
        {section === "about" && <AboutSection lang={lang} />}
        {section === "builds" && <BuildsSection lang={lang} />}
        {section === "sayhi" && <SayHiSection lang={lang} inDeck={inDeck} />}
      </div>
    </div>
  );
}
