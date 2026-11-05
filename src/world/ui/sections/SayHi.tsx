// Say hi panel: large link buttons, plus "Ride down" in phase `deck`, which
// closes the panel and so returns the character to the street (WP-10).

import { site } from "../../../content/site";
import type { Lang } from "../../../content/types";
import { useStore } from "../../store";
import { uiClick } from "../common";
import { CodeIcon, ExternalIcon, PersonIcon, RideDownIcon } from "../icons";

const LINK_ICONS = { github: CodeIcon, linkedin: PersonIcon } as const;

export function SayHiSection({
  lang,
  inDeck,
}: {
  lang: Lang;
  inDeck: boolean;
}) {
  const { intro, links } = site.sayhi;
  return (
    <div className="ui-sayhi">
      <p className="ui-lead">{intro[lang]}</p>
      <ul className="ui-sayhi__links">
        {links.map((link) => {
          const LinkIcon = LINK_ICONS[link.id];
          return (
            <li key={link.id}>
              <a
                className="ui-sayhi__link"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                data-control={`sayhi-${link.id}`}
                onClick={uiClick}
              >
                <span className="ui-sayhi__badge">
                  <LinkIcon />
                </span>
                <span className="ui-sayhi__label">{link.label[lang]}</span>
                <ExternalIcon />
              </a>
            </li>
          );
        })}
      </ul>
      {inDeck && (
        <button
          type="button"
          className="ui-button ui-button--primary ui-button--large ui-sayhi__ride"
          data-control="ride-down"
          onClick={() => {
            uiClick();
            useStore.getState().closePanel();
          }}
        >
          <RideDownIcon />
          <span>{site.ui.rideDown[lang]}</span>
        </button>
      )}
    </div>
  );
}
