// All site text, English and Japanese (overview § 6.7).
//
// PLACEHOLDER CONTENT from WP-01. Every string is fake and is marked:
// English strings contain "Placeholder", Japanese strings contain 「仮」.
// WP-04 replaces all of it and takes this file over.
//
// Conventions the UI relies on:
// - `ui.langToggle[lang]` is the label shown while the page is in `lang`, and
//   names the language you switch *to*, so it is written in that other
//   language (en: "日本語", ja: "English"). Renderers mark it with the other
//   language's `lang` attribute.
// - `ui.gotDrink` contains the token "{drink}".

import type { SiteContent } from "./types";

export const site: SiteContent = {
  meta: {
    title: {
      en: "Ash Kuroki · Placeholder title",
      ja: "Ash Kuroki・仮のタイトル",
    },
    description: {
      en: "Placeholder description of the site.",
      ja: "サイトの説明（仮）。",
    },
  },
  // TODO(Ash): Japanese name spelling (overview § 13). Never guess it.
  name: { en: "Ash Kuroki", ja: "Ash Kuroki" },
  tagline: {
    en: "Placeholder tagline · Tokyo",
    ja: "仮のキャッチコピー・東京",
  },
  about: {
    title: { en: "About (placeholder)", ja: "自己紹介（仮）" },
    paragraphs: {
      en: [
        "Placeholder paragraph one. The real story arrives with WP-04.",
        "Placeholder paragraph two. Nothing here is true yet.",
      ],
      ja: [
        "仮の段落その一。本文は WP-04 で入ります。",
        "仮の段落その二。まだ何も本当ではありません。",
      ],
    },
    photo: {
      src: "/images/asahi-headshot.webp",
      alt: { en: "Placeholder photo description", ja: "写真の説明（仮）" },
    },
  },
  builds: {
    title: { en: "Things I've built (placeholder)", ja: "作ったもの（仮）" },
    intro: {
      en: "Placeholder introduction to the projects.",
      ja: "プロジェクトの紹介文（仮）。",
    },
    items: [
      {
        id: "drone",
        title: { en: "Placeholder project one", ja: "仮のプロジェクトその一" },
        summary: {
          en: "Placeholder one-line summary.",
          ja: "仮の一行サマリー。",
        },
        body: {
          en: [
            "Placeholder body paragraph one.",
            "Placeholder body paragraph two.",
          ],
          ja: ["仮の本文その一。", "仮の本文その二。"],
        },
        tags: ["placeholder", "tag"],
        links: [
          {
            label: { en: "Placeholder link", ja: "仮のリンク" },
            href: "https://example.com/",
          },
        ],
        image: {
          src: "/images/drone.jpg",
          alt: {
            en: "Placeholder image description",
            ja: "画像の説明（仮）",
          },
        },
      },
      {
        id: "gpt2",
        title: { en: "Placeholder project two", ja: "仮のプロジェクトその二" },
        summary: {
          en: "Placeholder one-line summary.",
          ja: "仮の一行サマリー。",
        },
        body: {
          en: [
            "Placeholder body paragraph one.",
            "Placeholder body paragraph two.",
          ],
          ja: ["仮の本文その一。", "仮の本文その二。"],
        },
        tags: ["placeholder"],
        links: [],
      },
      {
        id: "website",
        title: {
          en: "Placeholder project three",
          ja: "仮のプロジェクトその三",
        },
        summary: {
          en: "Placeholder one-line summary.",
          ja: "仮の一行サマリー。",
        },
        body: {
          en: ["Placeholder body paragraph one."],
          ja: ["仮の本文その一。"],
        },
        tags: ["placeholder"],
        links: [],
      },
    ],
  },
  sayhi: {
    title: { en: "Say hi (placeholder)", ja: "ごあいさつ（仮）" },
    intro: {
      en: "Placeholder invitation to get in touch.",
      ja: "連絡のお誘い（仮）。",
    },
    links: [
      {
        id: "github",
        label: { en: "Placeholder GitHub", ja: "仮の GitHub" },
        href: "https://github.com/kurokiasahi222",
      },
      {
        id: "linkedin",
        label: { en: "Placeholder LinkedIn", ja: "仮の LinkedIn" },
        href: "https://www.linkedin.com/in/asahi-kuroki/",
      },
    ],
  },
  ui: {
    langToggle: { en: "日本語（仮）", ja: "English (placeholder)" },
    soundOn: { en: "Placeholder: sound on", ja: "仮：サウンドオン" },
    soundOff: { en: "Placeholder: sound off", ja: "仮：サウンドオフ" },
    classicView: { en: "Placeholder: Classic view", ja: "仮：クラシック表示" },
    worldView: {
      en: "Placeholder: Enter the 3D world",
      ja: "仮：3D の世界へ",
    },
    skipToText: {
      en: "Placeholder: Skip to text version",
      ja: "仮：テキスト版へ移動",
    },
    loading: { en: "Placeholder: Loading", ja: "仮：読み込み中" },
    enterWithSound: {
      en: "Placeholder: Enter with sound",
      ja: "仮：サウンドありで入る",
    },
    enterMuted: { en: "Placeholder: Enter muted", ja: "仮：ミュートで入る" },
    controlsHint: {
      en: "Placeholder: keyboard and mouse controls",
      ja: "仮：キーボードとマウスの操作",
    },
    controlsHintTouch: {
      en: "Placeholder: touch controls",
      ja: "仮：タッチ操作",
    },
    interactKey: { en: "Placeholder: E", ja: "仮：E" },
    tapHint: { en: "Placeholder: tap", ja: "仮：タップ" },
    interactVending: {
      en: "Placeholder: vending machine",
      ja: "仮：自動販売機",
    },
    interactBell: { en: "Placeholder: temple bell", ja: "仮：鐘" },
    drinks: {
      en: [
        "placeholder drink 1",
        "placeholder drink 2",
        "placeholder drink 3",
        "placeholder drink 4",
        "placeholder drink 5",
      ],
      ja: [
        "仮の飲み物1",
        "仮の飲み物2",
        "仮の飲み物3",
        "仮の飲み物4",
        "仮の飲み物5",
      ],
    },
    gotDrink: {
      en: "Placeholder: you got a {drink}.",
      ja: "仮：{drink}を買いました",
    },
    close: { en: "Placeholder: Close", ja: "仮：閉じる" },
    rideDown: { en: "Placeholder: Ride down", ja: "仮：下りる" },
    slowToast: {
      en: "Placeholder: this looks slow on your device.",
      ja: "仮：この端末では動作が重いようです。",
    },
    switchToClassic: {
      en: "Placeholder: Switch to Classic view",
      ja: "仮：クラシック表示に切り替え",
    },
    dismiss: { en: "Placeholder: Dismiss", ja: "仮：閉じる" },
    footerCredit: {
      en: "Placeholder footer credit",
      ja: "仮のフッタークレジット",
    },
  },
};

export default site;
