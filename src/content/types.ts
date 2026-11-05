// Content schema: overview § 6.7. All site text lives in `site.ts` (WP-04),
// which must satisfy `SiteContent`. Change this file only as a contract
// change in the overview.

export type Lang = "en" | "ja";
export type L<T = string> = Record<Lang, T>;

export interface Link {
  label: L;
  href: string;
}

export interface Build {
  id: "drone" | "gpt2" | "website";
  title: L;
  summary: L;
  body: L<string[]>;
  tags: string[];
  links: Link[];
  image?: { src: string; alt: L };
}

export interface SiteContent {
  meta: { title: L; description: L };
  name: L; // JA spelling comes from Ash (§ 13)
  tagline: L;
  about: { title: L; paragraphs: L<string[]>; photo: { src: string; alt: L } };
  builds: { title: L; intro: L; items: Build[] };
  sayhi: {
    title: L;
    intro: L;
    links: (Link & { id: "github" | "linkedin" })[];
  };
  ui: {
    langToggle: L;
    soundOn: L;
    soundOff: L;
    classicView: L;
    worldView: L;
    skipToText: L;
    loading: L;
    enterWithSound: L;
    enterMuted: L;
    controlsHint: L;
    controlsHintTouch: L;
    interactKey: L;
    tapHint: L;
    interactVending: L;
    interactBell: L;
    drinks: L<string[]>;
    gotDrink: L; // gotDrink contains "{drink}"
    close: L;
    rideDown: L;
    slowToast: L;
    switchToClassic: L;
    dismiss: L;
    footerCredit: L;
  };
}
