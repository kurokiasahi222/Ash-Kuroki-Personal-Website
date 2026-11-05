// The always-on menu (WP-07 step 2), visible from `intro` onward. Desktop: a
// top-left bar. Mobile: a 56 px bottom bar above the safe area (ui.css).
// A section entry opens its panel now; the character walks there meanwhile.

import { useLayoutEffect, useRef, type RefObject } from "react";
import { site } from "../../content/site";
import { useStore, type SectionId } from "../store";
import { ClassicLink } from "./ClassicLink";
import { otherLang, uiClick, useLang } from "./common";
import { GlobeIcon, PageIcon, SpeakerIcon } from "./icons";

/** Width of the desktop panel and the gap around it, from ui.css. */
const PANEL_WIDTH = 420;
const GAP = 16;

/** Menu order (overview § 2): About · Things I've built · Say hi. */
export const MENU_SECTIONS: readonly SectionId[] = ["about", "builds", "sayhi"];

/** Phases in which the menu and the panels are on screen. */
export function isInWorld(phase: string): boolean {
  return phase === "intro" || phase === "explore" || phase === "deck";
}

export function Menu() {
  const phase = useStore((s) => s.phase);
  return isInWorld(phase) ? <MenuBar /> : null;
}

/**
 * Tells ui.css where the desktop menu ends: `--ui-menu-bottom` on .ui-root,
 * and `data-menu-wide` when the bar reaches under the right-hand panel, so
 * the panel moves below it instead of covering it.
 */
function useMenuMetrics(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const nav = ref.current;
    const root = nav?.closest<HTMLElement>(".ui-root");
    if (!nav || !root) return;
    const measure = () => {
      const rect = nav.getBoundingClientRect();
      const panelLeft = window.innerWidth - GAP - PANEL_WIDTH;
      root.style.setProperty(
        "--ui-menu-bottom",
        `${Math.round(rect.bottom)}px`,
      );
      root.toggleAttribute("data-menu-wide", rect.right + GAP / 2 > panelLeft);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--ui-menu-bottom");
      root.removeAttribute("data-menu-wide");
    };
  }, [ref]);
}

function MenuBar() {
  const lang = useLang();
  const other = otherLang(lang);
  const openPanel = useStore((s) => s.openPanel);
  const sound = useStore((s) => s.sound);
  const { openSection, setLang, setSound } = useStore.getState();
  const navRef = useRef<HTMLElement>(null);
  useMenuMetrics(navRef);

  return (
    <nav ref={navRef} className="ui-menu ui-glass" lang={lang}>
      <ul className="ui-menu__sections">
        {MENU_SECTIONS.map((id) => (
          <li key={id}>
            <button
              type="button"
              className="ui-button ui-menu__item"
              aria-haspopup="dialog"
              aria-expanded={openPanel === id}
              data-control={`menu-${id}`}
              onClick={() => {
                uiClick();
                openSection(id, "menu");
              }}
            >
              <span className="ui-menu__label">{site[id].title[lang]}</span>
            </button>
          </li>
        ))}
      </ul>
      <span className="ui-menu__divider" aria-hidden="true" />
      <ul className="ui-menu__controls">
        <li>
          {/* The label names the other language, in that language. */}
          <button
            type="button"
            className="ui-button ui-menu__control"
            lang={other}
            data-control="lang"
            onClick={() => {
              uiClick();
              setLang(other);
            }}
          >
            <GlobeIcon />
            <span className="ui-menu__lang-label">
              {site.ui.langToggle[lang]}
            </span>
          </button>
        </li>
        <li>
          {/* A toggle keeps one name; aria-pressed says whether sound is on. */}
          <button
            type="button"
            className="ui-button ui-button--icon ui-menu__control"
            aria-pressed={sound}
            aria-label={site.ui.soundOn[lang]}
            title={sound ? site.ui.soundOn[lang] : site.ui.soundOff[lang]}
            data-control="sound"
            onClick={() => {
              // Sound first, so the tick plays when sound comes on.
              setSound(!sound);
              uiClick();
            }}
          >
            <SpeakerIcon on={sound} />
          </button>
        </li>
        <li>
          <ClassicLink
            className="ui-button ui-menu__control ui-menu__classic"
            control="classic"
          >
            <PageIcon />
            <span className="ui-menu__classic-label">
              {site.ui.classicView[lang]}
            </span>
          </ClassicLink>
        </li>
      </ul>
    </nav>
  );
}
