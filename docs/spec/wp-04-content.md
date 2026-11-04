# WP-04: Content, English and Japanese

**Depends on:** WP-01 · **Branch:** `wp-04-content` · **Wave:** 2
**Owns:** `src/content/site.ts`, `public/images/builds/**`

## Goal

Write every piece of text on the site in English and Japanese, filling the schema in overview § 6.7. Classic view, the panels, the prompts and the toasts all read from this file and nowhere else.

## Facts to work from

Everything here comes from Ash's GitHub profile and the old site. Don't add claims beyond it.

- **Name:** Ash (Asahi) Kuroki. Lives in Tokyo. Bilingual in Japanese and English.
- **Story:** born and raised in Japan; moved to the US alone at 15; graduated from the University of Minnesota, Twin Cities, with a double major in Computer Science and Entrepreneurship. Interested in software engineering, startups and AI.
- **Builds:**
  - **`drone`: Drone Simulation.** A UMN CSCI 3081 team project: a C++ drone delivery simulation with A\*, Dijkstra and DFS route planning, design patterns, a JS/HTML front end and Docker. Take the live demo, video and screenshot links from the public repo `kurokiasahi222/Drone-Simulation-Project`'s README. Credit the team ("built with three teammates").
  - **`gpt2`: GPT-2 from scratch.** Stanford CS224N's default final project, implemented in PyTorch: multi-head attention, GPT-2 layers and model, AdamW, then fine-tuning for sentiment classification, paraphrase detection and sonnet generation, including LoRA. **Write-up only.** No code link, no link to the private repo, no code excerpts.
  - **`website`: this website.** A rainy Tokyo night built with Astro, React Three Fiber and Blender driven by Python scripts. Link `https://github.com/kurokiasahi222/Ash-Kuroki-Personal-Website`.
- **Links:** GitHub `https://github.com/kurokiasahi222`; LinkedIn `https://www.linkedin.com/in/asahi-kuroki/`. No email address.
- **Photo:** `/images/asahi-headshot.webp`.

## Voice

Warm, light and first person, like a friendly note rather than a résumé.

- **About:** at most 120 words in English, three short paragraphs at most.
- **Each build:** a summary of at most 90 characters, and a body of 2–3 short paragraphs.
- **Japanese:** write natural Japanese in a friendly です/ます style, not a word-for-word translation. Keep it about as long as the English.

## Steps

1. **Sections.** Write `meta`, `tagline`, `about`, `builds` (three items in the order `drone`, `gpt2`, `website`, with tags) and `sayhi`, in both languages.
   - Section titles: EN "About" / "Things I've built" / "Say hi". JA: your best natural equivalents, for example 「自己紹介」「作ったもの」「ごあいさつ」.
   - Done when every field is filled, the length limits hold, and no claim goes beyond the facts above.
2. **Name and credit.**
   - `name.ja`: Ash hasn't provided the Japanese spelling yet. Set it to `"Ash Kuroki"`, mark it with `// TODO(Ash): Japanese name spelling`, and list it in the PR. Never guess kanji.
   - `ui.footerCredit`: "Previous version designed by Kayla Purney" with a JA equivalent. Ash may drop it.
   - Done when both are set and listed in the PR.
3. **`ui` strings.** Fill every key in § 6.7.
   - `controlsHint`: "WASD / arrow keys to walk · click to walk there · E to interact".
   - `controlsHintTouch`: "Tap to walk · tap a label to visit".
   - `drinks`: five made-up, unbranded drinks, for example "hot corn soup" / 「あったかいコーンスープ」, "royal milk tea" / 「ロイヤルミルクティー」, "melon soda" / 「メロンソーダ」, "canned coffee" / 「缶コーヒー」, "hot green tea" / 「あったかい緑茶」.
   - `gotDrink`: a template containing `{drink}`, for example "You got a {drink}." / 「{drink}を買いました」.
   - Done when type-checking passes and no key is left as WP-01's placeholder.
4. **Build images.**
   - Use one image per build, at most 1200 px wide, WebP, at most 120 KB each, in `public/images/builds/`.
   - **Drone:** a screenshot from the repo.
   - **GPT-2:** a simple diagram you draw as SVG (for example blocks labelled attention → GPT-2 layer → task heads).
   - **Website:** add a placeholder image now. WP-16 swaps in a real shot.
   - Write alt text in both languages.
   - Done when every image loads on Classic view.

## Acceptance

- [ ] `npm run check` passes.
- [ ] A script check, pasted into the PR: every `L` value has non-empty `en` and `ja`; the English About has at most 120 words; every summary has at most 90 characters.
- [ ] Every external link returns HTTP 200 (LinkedIn may refuse automated checks; note it).
- [ ] Shots of Classic view in EN and JA at both viewports read naturally.
- [ ] The PR lists these for Ash: the Japanese name spelling, proofreading every Japanese string, confirming the Drone Simulation sharing is fine, and keeping or dropping the Kayla credit.
