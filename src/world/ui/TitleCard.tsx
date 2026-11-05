// Title card (WP-07 step 1): shown in phases `loading` and `title`. A loading
// bar while the models load (WP-03 moves the phase to `title`), then
// "Enter with sound" / "Enter muted", which start the intro.

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { site } from "../../content/site";
import { store, useStore } from "../store";
import { ClassicLink } from "./ClassicLink";
import { uiClick, useLang, useMotionMs, usePresence } from "./common";
import { SpeakerIcon, TowerMark } from "./icons";

export function TitleCard() {
  const phase = useStore((s) => s.phase);
  const ms = useMotionMs();
  const show = phase === "loading" || phase === "title";
  const { mounted, leaving } = usePresence(show, ms);
  if (!mounted) return null;
  // Once past `loading`, keep the buttons while the card fades out.
  return <TitleCardView ready={phase !== "loading"} leaving={leaving} />;
}

/** The only way into the world: Enter works in phase `title` and nowhere else. */
function enter(withSound: boolean): void {
  const s = store.getState();
  if (s.phase !== "title") return;
  s.setSound(withSound);
  uiClick();
  s.setPhase("intro");
}

function TitleCardView({
  ready,
  leaving,
}: {
  ready: boolean;
  leaving: boolean;
}) {
  const lang = useLang();
  const progress = useStore((s) => s.loadProgress);
  const cardRef = useRef<HTMLElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const loadingId = useId();

  // The static boot card (WP-01) hands over to this card, in the same frame.
  useLayoutEffect(() => {
    document.getElementById("boot-card")?.remove();
  }, []);

  // At `title`, focus "Enter with sound", unless the visitor has already put
  // focus somewhere else (the skip link, or the Classic content).
  useEffect(() => {
    if (!ready || leaving) return;
    const active = document.activeElement;
    const idle =
      !active ||
      active === document.body ||
      cardRef.current?.contains(active) === true;
    if (idle) enterRef.current?.focus();
  }, [ready, leaving]);

  const percent = Math.round(progress * 100);

  return (
    <div
      className={leaving ? "ui-title is-leaving" : "ui-title"}
      lang={lang}
      inert={leaving}
    >
      <section
        ref={cardRef}
        className="ui-title__card ui-glass"
        aria-labelledby={titleId}
      >
        <TowerMark />
        <h1 id={titleId} className="ui-title__name">
          {site.name[lang]}
        </h1>
        <p className="ui-title__tagline">{site.tagline[lang]}</p>

        <div className="ui-title__actions">
          {ready ? (
            <>
              <button
                ref={enterRef}
                type="button"
                className="ui-button ui-button--primary ui-button--large"
                data-control="enter-sound"
                onClick={() => enter(true)}
              >
                <SpeakerIcon on />
                <span>{site.ui.enterWithSound[lang]}</span>
              </button>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--large"
                data-control="enter-muted"
                onClick={() => enter(false)}
              >
                <SpeakerIcon on={false} />
                <span>{site.ui.enterMuted[lang]}</span>
              </button>
            </>
          ) : (
            <div className="ui-loading">
              <div className="ui-loading__row">
                <span id={loadingId}>{site.ui.loading[lang]}</span>
                <span className="ui-loading__percent" aria-hidden="true">
                  {percent}%
                </span>
              </div>
              <div
                className="ui-loading__track"
                role="progressbar"
                aria-labelledby={loadingId}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <span
                  className="ui-loading__fill"
                  style={{ transform: `scaleX(${progress})` }}
                />
              </div>
            </div>
          )}
        </div>

        <ClassicLink className="ui-title__classic" control="title-classic">
          {site.ui.classicView[lang]}
        </ClassicLink>
      </section>
    </div>
  );
}
