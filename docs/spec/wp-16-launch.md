# WP-16: Polish, audits and launch

**Depends on:** all other packages · **Branch:** `wp-16-launch` · **Wave:** 5
**Owns:** integration. This package may edit any file to fix integration issues, and lists every edit outside `src/components/classic/**`, `src/layouts/**`, `src/analytics/**`, `public/{og.png,robots.txt}`, `README.md` and `scripts/tests/wp-16-*` in the PR.

## Goal

Take v2 from "works end to end" to "ready to replace asahikuroki.com": a polished Classic view, SEO, analytics, accessibility and budget audits, a final walkthrough in both languages and both tiers, and the cutover.

## Steps

1. **Classic polish.**
   - Restyle Classic view so it feels like the same place: the night palette, M PLUS Rounded, and a hero image from the `establish` shot (WebP, at most 120 KB).
   - Section cards like the world panels, and a clear "Enter the 3D world" call to action.
   - Swap the website build's placeholder image for a real shot.
   - Done when Classic, desktop and mobile, looks intentional in EN and JA, and stays under 400 KB.
2. **SEO.**
   - Per-language title and description; `hreflang` and canonical links.
   - Open Graph and Twitter cards with `public/og.png` (1200×630, from the `establish` shot).
   - `sitemap.xml` (both languages) and `robots.txt`.
3. **Analytics** (`src/analytics/`, subscribing to the store and events and calling `gtag`):
   - `view_mode {mode, reason}`, `enter {sound}`, `panel_open {section, via}`, `interaction {id}`, `deck_reached`, `lang_switch {lang}`.
   - Mount it from the boot script, so the world code stays unchanged.
4. **Audits.**
   - `npm run budget` passes.
   - Accessibility: a keyboard-only pass of both views; screen-reader text order in world mode (the skip link leads to the full Classic content); reduced motion; contrast; `lang` attributes.
   - The full WP-10 walkthrough on both tiers and in both languages.
   - The console is clean.
   - Done when every item has a result written in the PR.
5. **README.** Rewrite it: what the site is, how to run the web app and the art pipeline (pointing to the spec rather than repeating it), and credits, including the audio `CREDITS.md` and the previous design credit if Ash kept it.
6. **Real-device checklist for Ash** (in the PR): frame rate on a laptop and on a phone (§ 7), sound, the rain look, the deck, and reading the Japanese.
7. **Cutover**, only after Ash approves this PR and the checklist:
   - Merge `v2` into `main`, so Vercel deploys to production.
   - Smoke-test production: `/`, `/ja/`, `?view=classic`, an old `/#section1` link landing cleanly, `/images/ps1.pdf` returning 404, and the favicons.
   - Report the results in the PR.

## Acceptance

- [ ] `npm run check` and `npm run budget` pass on the merge commit.
- [ ] Walkthrough shots: EN and JA × high and low × desktop and mobile.
- [ ] Every audit item in step 4 has a written result.
- [ ] Ash has signed off on the device checklist before the cutover. The production smoke test is reported afterwards.
