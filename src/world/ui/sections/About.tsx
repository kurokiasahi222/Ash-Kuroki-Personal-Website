// About panel: the photo, then the paragraphs (WP-07 step 3).

import { site } from "../../../content/site";
import type { Lang } from "../../../content/types";

export function AboutSection({ lang }: { lang: Lang }) {
  const { photo, paragraphs } = site.about;
  return (
    <div className="ui-about">
      <img
        className="ui-about__photo"
        src={photo.src}
        alt={photo.alt[lang]}
        width={128}
        height={128}
        decoding="async"
      />
      <div className="ui-prose">
        {paragraphs[lang].map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
    </div>
  );
}
