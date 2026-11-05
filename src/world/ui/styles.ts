// The UI's stylesheet, injected when the world chunk loads. Imported as a
// string (?inline) on purpose: a plain CSS import would be hoisted into every
// page's <head> by Astro, so Classic mode would download it too (overview § 5:
// world code stays out of Classic mode).

import css from "./ui.css?inline";

const ID = "world-ui-styles";

export function injectUiStyles(): void {
  let style = document.getElementById(ID);
  if (!style) {
    style = document.createElement("style");
    style.id = ID;
    document.head.append(style);
  }
  // Replacing the text (rather than appending again) keeps dev hot reloads tidy.
  if (style.textContent !== css) style.textContent = css;
}
