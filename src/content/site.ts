// All site text, English and Japanese (overview § 6.7). WP-04 owns this file.
//
// Classic view, the panels, the prompts and the toasts all read from here and
// nowhere else. Facts come only from docs/spec/wp-04-content.md; Ash
// proofreads the Japanese.
//
// Conventions the UI relies on:
// - `ui.langToggle[lang]` is the label shown while the page is in `lang`, and
//   names the language you switch *to*, so it is written in that other
//   language (en: "日本語", ja: "English"). Renderers mark it with the other
//   language's `lang` attribute.
// - `ui.gotDrink` contains the token "{drink}", replaced by an entry of
//   `ui.drinks`. Both languages list the same drinks in the same order.
// - `ui.soundOn` / `ui.soundOff` describe the sound state ("Sound on" /
//   "Sound off"), so they read right as a toggle's label for either state.

import type { SiteContent } from "./types";

// TODO(Ash): Japanese name spelling (overview § 13). Never guess it.
// Used for `name.ja`, and in the Japanese title, description and About.
const NAME_JA = "Ash Kuroki";

export const site: SiteContent = {
  meta: {
    title: {
      en: "Ash Kuroki · Tokyo Night Walk",
      ja: `${NAME_JA}・雨の東京さんぽ`,
    },
    description: {
      en: "Hi, I'm Ash. Take a rainy night walk at the foot of Tokyo Tower, read a little about me and see a few things I've built.",
      ja: `${NAME_JA}の個人サイトです。雨の夜の東京タワーのふもとを歩きながら、自己紹介や作ったものをのぞいてみてください。`,
    },
  },
  // TODO(Ash): Japanese name spelling
  name: { en: "Ash Kuroki", ja: NAME_JA },
  tagline: {
    en: "Living in Tokyo. Into software, startups and AI.",
    ja: "東京で暮らしています。ソフトウェアとスタートアップ、AIに興味があります。",
  },
  about: {
    title: { en: "About", ja: "自己紹介" },
    paragraphs: {
      en: [
        "Hi, I'm Ash (Asahi) Kuroki. I was born and raised in Japan, and at 15 I moved to the US on my own.",
        "I went to the University of Minnesota, Twin Cities, and graduated with a double major in Computer Science and Entrepreneurship. I'm curious about software engineering, startups and AI.",
        "Now I'm back in Japan, living in Tokyo and at home in both Japanese and English. Thanks for stopping by!",
      ],
      ja: [
        `はじめまして、${NAME_JA}です。日本で生まれ育ち、15歳のときにひとりでアメリカへ渡りました。`,
        "大学はミネソタ大学ツインシティ校で、コンピューターサイエンスとアントレプレナーシップ（起業学）のダブルメジャーで卒業しました。ソフトウェアエンジニアリングやスタートアップ、AIに興味があります。",
        "いまは日本に戻り、東京で日本語と英語の両方を使いながら暮らしています。遊びに来てくれて、ありがとうございます！",
      ],
    },
    photo: {
      src: "/images/asahi-headshot.webp",
      alt: {
        en: "Ash with a slight smile, wavy dark hair, a navy jacket and a light blue shirt.",
        ja: "穏やかにほほえむAsh。ウェーブのかかった黒髪に、ネイビーのジャケットと水色のシャツ。",
      },
    },
  },
  builds: {
    title: { en: "Things I've built", ja: "作ったもの" },
    intro: {
      en: "A few things I've made, from a drone simulation to the site you're on.",
      ja: "ドローンのシミュレーションから、いま見ているこのサイトまで。これまでに作ったものを紹介します。",
    },
    items: [
      {
        id: "drone",
        title: { en: "Drone Simulation", ja: "ドローンシミュレーション" },
        summary: {
          en: "A C++ drone delivery simulation with route planning, built with three teammates.",
          ja: "C++で作ったドローン配送シミュレーション。チームメイト3人との共同開発です。",
        },
        body: {
          en: [
            "A team project for CSCI 3081 at the University of Minnesota, built with three teammates. It's a drone delivery simulation written in C++, where routes are planned with A*, Dijkstra or DFS.",
            "Along the way we used design patterns, built a JS/HTML front end to watch the deliveries, and packaged everything with Docker.",
            "Try the live demo below. It can take a little while to wake up.",
          ],
          ja: [
            "ミネソタ大学の授業「CSCI 3081」で、チームメイト3人と一緒に作ったプロジェクトです。C++で書いたドローン配送のシミュレーションで、ルートはA*、ダイクストラ法、DFSで計画します。",
            "設計にはデザインパターンを取り入れ、配送の様子を見られるJS/HTMLのフロントエンドを作り、全体をDockerでまとめました。",
            "下のリンクからライブデモを試せます。起動に少し時間がかかることがあります。",
          ],
        },
        tags: [
          "C++",
          "A*",
          "Dijkstra",
          "DFS",
          "Design patterns",
          "JS/HTML",
          "Docker",
        ],
        // From the public repo's README (kurokiasahi222/Drone-Simulation-Project).
        links: [
          {
            label: { en: "Live demo", ja: "ライブデモ" },
            href: "https://drone-38eq.onrender.com",
          },
          {
            label: { en: "Video demo", ja: "デモ動画" },
            href: "https://www.youtube.com/watch?v=SVIainaNuyE",
          },
          {
            label: { en: "Code on GitHub", ja: "GitHubでコードを見る" },
            href: "https://github.com/kurokiasahi222/Drone-Simulation-Project",
          },
        ],
        // Cropped from the screenshot in the repo's presentation.pdf.
        image: {
          src: "/images/builds/drone.webp",
          alt: {
            en: "The Drone Simulation in a browser: a 3D map of the University of Minnesota campus seen from above, with view and speed controls in the corner.",
            ja: "ブラウザで動くドローンシミュレーション。ミネソタ大学のキャンパスを上空から見た3Dマップで、右上に表示と速度の操作パネルがあります。",
          },
        },
      },
      {
        id: "gpt2",
        title: { en: "GPT-2 from scratch", ja: "ゼロから作るGPT-2" },
        summary: {
          en: "GPT-2 built piece by piece in PyTorch, then fine-tuned for three tasks.",
          ja: "PyTorchでGPT-2を一から実装し、3つのタスクでファインチューニングしました。",
        },
        body: {
          en: [
            "This was the default final project for Stanford's CS224N. Working in PyTorch, I implemented multi-head attention, the GPT-2 layers and model, and the AdamW optimizer, one piece at a time.",
            "Then I fine-tuned it for sentiment classification, paraphrase detection and sonnet generation, with LoRA in the mix too.",
            "This one is a write-up only, so there's no code to share.",
          ],
          ja: [
            "スタンフォード大学の講義CS224Nの最終課題（デフォルトプロジェクト）です。PyTorchで、マルチヘッドアテンション、GPT-2のレイヤーとモデル、AdamWオプティマイザーをひとつずつ実装しました。",
            "そのあと、感情分類、言い換え判定、ソネット生成の3つのタスクに向けてファインチューニングしました。LoRAも使っています。",
            "こちらは紹介だけで、コードは公開していません。",
          ],
        },
        tags: [
          "PyTorch",
          "Multi-head attention",
          "AdamW",
          "LoRA",
          "Stanford CS224N",
        ],
        // Write-up only: no code link, no repo link, no code excerpts.
        links: [],
        // Diagram drawn as SVG (gpt2.svg, the source) and rendered to WebP.
        image: {
          src: "/images/builds/gpt2.webp",
          alt: {
            en: "Diagram: multi-head attention leads to a GPT-2 layer, then the GPT-2 model, which branches into three tasks: sentiment, paraphrase and sonnets. Below are two tags, AdamW optimizer and LoRA fine-tuning.",
            ja: "図：マルチヘッドアテンションからGPT-2のレイヤー、GPT-2モデルへと進み、そこから感情分類・言い換え判定・ソネット生成の3つのタスクに分かれます。下には「AdamWオプティマイザー」と「LoRAファインチューニング」のタグがあります。",
          },
        },
      },
      {
        id: "website",
        title: { en: "This website", ja: "このサイト" },
        summary: {
          en: "A rainy Tokyo night you can walk around, made with Astro, React Three Fiber and Blender.",
          ja: "歩いて回れる、雨の東京の夜。Astro、React Three Fiber、Blenderで作りました。",
        },
        body: {
          en: [
            "You're looking at it! A rainy night at the foot of Tokyo Tower, built with Astro and React Three Fiber.",
            "Every 3D model comes from Python scripts that drive Blender, so the whole street can be rebuilt from code.",
            "The repository is private, so there's no code link, but you're welcome to wander around.",
          ],
          ja: [
            "いま見ているこのサイトです！東京タワーのふもとの雨の夜を、AstroとReact Three Fiberで作りました。",
            "3DモデルはすべてPythonスクリプトでBlenderを動かして作っているので、通りまるごとコードから組み立て直せます。",
            "リポジトリは非公開なのでコードへのリンクはありませんが、よかったらのんびり歩いてみてください。",
          ],
        },
        tags: ["Astro", "React Three Fiber", "Blender", "Python"],
        // The repository is private: no repo link.
        links: [],
        // Placeholder illustration; WP-16 swaps in a real shot of the site.
        image: {
          src: "/images/builds/website.webp",
          alt: {
            en: "An illustration of Tokyo Tower glowing orange on a rainy night, above a wet street with lamps and a vending machine.",
            ja: "雨の夜にオレンジ色に光る東京タワーと、街灯や自販機が並ぶ濡れた通りのイラスト。",
          },
        },
      },
    ],
  },
  sayhi: {
    title: { en: "Say hi", ja: "声をかけてね" },
    intro: {
      en: "I'd love to hear from you! You can find me on GitHub and LinkedIn.",
      ja: "メッセージ、お待ちしています。GitHubやLinkedInから気軽にどうぞ。",
    },
    links: [
      {
        id: "github",
        label: { en: "GitHub", ja: "GitHub" },
        href: "https://github.com/kurokiasahi222",
      },
      {
        id: "linkedin",
        label: { en: "LinkedIn", ja: "LinkedIn" },
        href: "https://www.linkedin.com/in/asahi-kuroki/",
      },
    ],
  },
  ui: {
    langToggle: { en: "日本語", ja: "English" },
    soundOn: { en: "Sound on", ja: "サウンドオン" },
    soundOff: { en: "Sound off", ja: "サウンドオフ" },
    classicView: { en: "Classic view", ja: "シンプル表示" },
    worldView: { en: "Enter the 3D world", ja: "3Dの世界へ" },
    skipToText: { en: "Skip to text version", ja: "テキスト版へスキップ" },
    loading: { en: "Getting the street ready…", ja: "街を準備しています…" },
    enterWithSound: { en: "Enter with sound", ja: "音ありで入る" },
    enterMuted: { en: "Enter muted", ja: "音なしで入る" },
    controlsHint: {
      en: "WASD / arrow keys to walk · click to walk there · E to interact",
      ja: "WASD／矢印キーで歩く・クリックでその場所へ・Eで調べる",
    },
    controlsHintTouch: {
      en: "Tap to walk · tap a label to visit",
      ja: "タップで歩く・ラベルをタップでその場所へ",
    },
    interactKey: { en: "Press E", ja: "Eで調べる" },
    tapHint: { en: "Tap here", ja: "ここをタップ" },
    interactVending: { en: "Vending machines", ja: "自販機" },
    interactBell: { en: "Temple bell", ja: "お寺の鐘" },
    // Made-up, unbranded drinks. Same order in both languages.
    drinks: {
      en: [
        "hot corn soup",
        "royal milk tea",
        "melon soda",
        "canned coffee",
        "hot green tea",
      ],
      ja: [
        "あったかいコーンスープ",
        "ロイヤルミルクティー",
        "メロンソーダ",
        "缶コーヒー",
        "あったかい緑茶",
      ],
    },
    gotDrink: {
      en: "Clunk! You got a {drink}.",
      ja: "ガコン！{drink}が出てきました。",
    },
    close: { en: "Close", ja: "閉じる" },
    rideDown: { en: "Ride back down", ja: "地上に戻る" },
    slowToast: {
      en: "This looks a little slow on your device. The Classic view might feel smoother.",
      ja: "この端末では少し重いようです。シンプル表示のほうが快適かもしれません。",
    },
    switchToClassic: {
      en: "Switch to Classic view",
      ja: "シンプル表示に切り替える",
    },
    dismiss: { en: "Keep walking", ja: "このまま歩く" },
    // TODO(Ash): keep or drop this credit (overview § 13).
    footerCredit: {
      en: "Previous version designed by Kayla Purney",
      ja: "旧バージョンのデザイン：Kayla Purney",
    },
  },
};

export default site;
