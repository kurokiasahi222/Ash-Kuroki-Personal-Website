# WP-01: Foundation

**Depends on:** nothing · **Branch:** `wp-01-foundation` · **Wave:** 1

**Owns:**

- `package.json`, `package-lock.json`
- `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `.prettierrc.mjs`, `.nvmrc`
- `src/pages/index.astro`, `src/pages/ja/index.astro`
- `src/layouts/**`, `src/styles/**`, `src/components/**`
- `src/content/types.ts`, plus `src/content/site.ts` until WP-04 takes it over
- `src/world/{App.tsx,store.ts,runtime.ts,events.ts}`, `src/world/boot/**`
- The stub `index.tsx` in every `src/world/<package>/` folder
- `scripts/**` (except other packages' `scripts/tests/wp-XX-*`), `public/favicon/**`
- Deleting the old site's files

## Goal

Replace the old one-page site with the v2 skeleton:

- A Classic view rendered from the content schema, at `/` and `/ja/`.
- Boot detection that decides between world and classic mode before first paint.
- An empty 3D world that mounts with the full store, runtime, events and stub components.
- The `check`, `shots` and `budget` tooling every other package relies on.

When this merges, every other code package can work in parallel inside its own folder.

## Steps

1. **Dependencies.**
   - Install the latest stable majors and pin exact versions: `astro`, `@astrojs/react`, `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `@react-three/postprocessing`, `postprocessing`, `zustand`. Dev dependencies: `@types/react`, `@types/react-dom`, `@types/three`, `prettier`, `prettier-plugin-astro`, `@astrojs/check`, `typescript`.
   - Remove `tailwindcss`, `@astrojs/tailwind`, `sass`, `postcss-scss`, `stylelint*`, `typed.js`, `fullpage.js`, `velocity-animate`, `animate.css`, `dotenv`.
   - Add `.nvmrc` with `22`.
   - Done when `npm ci` is clean and `npm ls` shows none of the removed packages.
2. **Retire the old site.**
   - Delete `src/components/*`, `src/styles/*`, `src/layouts/script.js` and `tailwind.config.cjs`.
   - Delete the images under `public/images/` except `asahi-headshot.{png,webp,avif}` and `drone.jpg`.
   - Move `favicon/` to `public/favicon/`. It currently sits outside `public/`, so production never serves it.
   - Done when `git grep` finds no import of a deleted file, and `/favicon/favicon-32x32.png` is in the build output.
3. **Config.**
   - `astro.config.mjs`: static output; the React integration; i18n with `en` as the default (no prefix) and `ja` at `/ja/`.
   - A small inline integration that injects every route under `src/dev-pages/` **only** when the command is `dev`. WP-03 puts the model viewer there.
   - `.gitignore`: add `shots/`, `art/out/`, `art/.cache/`, `.venv-art/`.
   - Done when `astro build` emits only `/` and `/ja/` and `astro dev` also serves `/dev/*`.
4. **Content schema.**
   - Write `src/content/types.ts` exactly as in overview § 6.7.
   - Write a `site.ts` with clearly fake placeholder text in both languages that satisfies every field.
   - Done when type-checking passes and every `L` field has both `en` and `ja`.
5. **Layout and Classic view.**
   - **Base layout:** `<head>` with title and description from content, `hreflang` alternates, theme-color `#0D1322`, favicons, the M PLUS Rounded 1c stylesheet (`display=swap`), and the existing GA tag `G-20VY92PLKM`.
   - **Fixes** for the old bugs: a single `<title>`, and a valid `theme-color`.
   - **`src/styles/tokens.css`** from overview § 6.8.
   - **Classic components** (`src/components/classic/`):
     - Header: name, tagline, a link to the other language, and an "Enter the 3D world" link (`?view=world`, which also saves `ash.view`).
     - About, Things I've built and Say hi sections, then the footer credit.
     - All inside `<main id="classic-content">`.
   - **Style:** dark, plain and tidy. WP-16 polishes it later.
   - Done when `/` and `/ja/` read fully with JavaScript disabled, and the `lang` attributes are correct.
6. **Boot.**
   - **Inline `<head>` script:**
     - Implements view-mode and tier resolution exactly as in overview § 8. A `?tier=high|low` parameter overrides the detected tier.
     - Sets `html.world-mode` and `window.__ashBoot = { mode, tier, reason, lang }`.
     - Must be synchronous and under 3 KB.
   - **CSS:** in world mode, Classic content is visually hidden but stays readable by screen readers, and the skip link (§ 9) comes first in focus order.
   - **Boot card:** a static, CSS-only card ("Ash Kuroki · Tokyo" plus a spinner), visible only in world mode, with `id="boot-card"`. WP-07's title card removes it.
   - **Module script:** in world mode, `import('../world/boot/mount')` renders `<App/>` into `#world-root`.
   - **Error handling:** an error boundary, or a lost WebGL context, removes `world-mode`, logs the reason and leaves the visitor on Classic view.
   - Done when the checks below pass and the production build contains no 3D code in the Classic-mode request waterfall.
7. **World skeleton.**
   - **Store, runtime and events:** `store.ts`, `runtime.ts` and `events.ts` exactly as in overview § 6.4 and § 6.5, with every action implemented: `setLang` side effects, auto-clearing toasts, and a live `prefers-reduced-motion` listener.
   - **Debug parameters** parsed from the URL into `runtime.debug`, with `shot` implying `freeze`. With any `debug` or `shot` parameter, expose `window.__world = { runtime, store }`.
   - **`?panel=<id>`:** once `window.__worldReady` is true, call `openSection(id, 'world')`, so shots can show panels.
   - **`App.tsx`:** `<Canvas>` with a DPR cap per tier (§ 8), `THREE.AgXToneMapping` and sRGB output, then `<Physics>`, then `<Scene/> <Character/> <CameraRig/> <Atmosphere/> <AudioSystem/> <WorldFlow/>`, with `<Ui/>` as a DOM sibling of the canvas.
   - **Stubs:** each of those components is a stub that returns `null`, exported from its folder's `index.tsx`.
   - **`?debug=stats`:** write `renderer.info.render` `{calls, triangles}` to `window.__worldStats` every 30 frames.
   - Done when `/?view=world` mounts a canvas with no console errors.
8. **Tooling.**
   - **`scripts/shots.mjs`:**
     - Uses the preinstalled `playwright` package. Do **not** add Playwright to `package.json` or run `playwright install`: the cloud image ships a matching browser.
     - Launches Chromium with WebGL working. Check for non-black canvas pixels and add `--enable-unsafe-swiftshader` if they're missing.
     - Options: `--url`, `--name`, `--viewport desktop|mobile|WxH`, `--no-js`.
     - Waits for `window.__worldReady` on world URLs (60 s timeout), and for `load` on Classic pages.
     - Writes `shots/<name>.png`.
     - With no arguments, runs the standard set: Classic EN and JA at both viewports, plus the world shots from overview § 6.2. A shot that can't render yet is reported as "pending", not a failure.
   - **`scripts/budget.mjs`:** after `astro build`, computes the § 7 rows that file sizes can answer: Classic page weight, compressed world JS, each `.glb` and `public/audio/` total. It prints a table and exits non-zero on any violation.
   - **`package.json` scripts:** `dev`, `build`, `preview`, `check` (= `astro check && prettier --check . && astro build`), `shots`, `budget`.
   - Done when all of them run.

## Acceptance

- [ ] `npm run check` passes.
- [ ] `npm run shots -- --url "/" --name classic-nojs --no-js` and the `/ja/` equivalent show complete placeholder content.
- [ ] Headless `/` (software WebGL) resolves to **classic** with reason "software renderer". `/?view=world` resolves to world, shows the boot card and mounts a canvas. `?view=classic` stays classic, and the saved preference survives a reload.
- [ ] `window.__world.store.getState()` exposes every field and action in § 6.4. Calling `openSection('about','menu')` sets `openPanel` and `autoWalk`. `setLang('ja')` updates `<html lang>` and the URL.
- [ ] With `?view=world&debug=stats`, `window.__worldStats` updates.
- [ ] `npm run budget` runs and prints the table (the model rows may say "missing" until WP-02 merges).
- [ ] No file outside this package's **Owns** list was edited.

## Gotchas

- Astro's React integration must match the installed React major. R3F's current major requires React 19.
- `@react-three/rapier`'s `<Physics>` suspends while its WASM loads. Keep a `<Suspense>` boundary around the scene so `loadProgress` still reports.
- Don't add Tailwind or SCSS back. New styles are plain CSS using the tokens.
