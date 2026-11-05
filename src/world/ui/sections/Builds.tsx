// Things I've built: one card per build, each with image, title, summary, an
// expandable body, tags and links (WP-07 step 3). The title is the disclosure
// button, so expanding needs no extra copy. Expanded state survives a
// language switch: only the text changes.

import { useId, useState } from "react";
import { site } from "../../../content/site";
import type { Build, Lang } from "../../../content/types";
import { uiClick } from "../common";
import { ChevronIcon, ExternalIcon } from "../icons";

export function BuildsSection({ lang }: { lang: Lang }) {
  const { intro, items } = site.builds;
  return (
    <div className="ui-builds">
      <p className="ui-lead">{intro[lang]}</p>
      <ul className="ui-builds__list">
        {items.map((build) => (
          <li key={build.id}>
            <BuildCard build={build} lang={lang} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuildCard({ build, lang }: { build: Build; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const titleId = useId();

  return (
    <article
      className={open ? "ui-card is-open" : "ui-card"}
      aria-labelledby={titleId}
      data-build={build.id}
    >
      <BuildImage build={build} lang={lang} />
      <h3 className="ui-card__title" id={titleId}>
        <button
          type="button"
          className="ui-card__toggle"
          data-control="build-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            uiClick();
            setOpen((o) => !o);
          }}
        >
          <span>{build.title[lang]}</span>
          <ChevronIcon className="ui-card__chevron" />
        </button>
      </h3>
      <p className="ui-card__summary">{build.summary[lang]}</p>
      <div className="ui-card__body ui-prose" id={bodyId} hidden={!open}>
        {build.body[lang].map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
      {/* Tags aren't translated (string[]), so they're marked English. */}
      {build.tags.length > 0 && (
        <ul className="ui-tags" lang="en">
          {build.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      {build.links.length > 0 && (
        <ul className="ui-card__links">
          {build.links.map((link) => (
            <li key={link.href}>
              <a
                className="ui-card__link"
                data-control="build-link"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={uiClick}
              >
                <span>{link.label[lang]}</span>
                <ExternalIcon />
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** The build's image, or a soft decorative tile when it has none (or fails). */
function BuildImage({ build, lang }: { build: Build; lang: Lang }) {
  const [failed, setFailed] = useState(false);
  if (!build.image || failed) {
    return (
      <div
        className="ui-card__image ui-card__image--empty"
        data-build={build.id}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      className="ui-card__image"
      src={build.image.src}
      alt={build.image.alt[lang]}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
