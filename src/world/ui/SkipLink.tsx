// "Skip to text version": the first focusable element on the page (overview
// § 9). #classic-content has tabindex="-1" and shows itself as an overlay
// while focus is inside it (src/styles/world.css).

import { site } from "../../content/site";
import { useLang } from "./common";

export function SkipLink() {
  const lang = useLang();
  return (
    <a
      className="ui-skip"
      href="#classic-content"
      data-control="skip"
      lang={lang}
      onClick={() => {
        // The hash navigation focuses it too; this covers browsers that don't.
        document.getElementById("classic-content")?.focus();
      }}
    >
      {site.ui.skipToText[lang]}
    </a>
  );
}
