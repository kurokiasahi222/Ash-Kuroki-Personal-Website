import type { Lang } from "../../content/types";

export const LANGS: readonly Lang[] = ["en", "ja"];

/** The page path for each language: English at /, Japanese at /ja/. */
export function pagePath(lang: Lang): "/" | "/ja/" {
  return lang === "ja" ? "/ja/" : "/";
}

export function otherLang(lang: Lang): Lang {
  return lang === "ja" ? "en" : "ja";
}
