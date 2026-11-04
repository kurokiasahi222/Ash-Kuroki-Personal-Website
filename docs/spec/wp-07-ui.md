# WP-07: UI overlay

**Depends on:** WP-01 · **Branch:** `wp-07-ui` · **Wave:** 2
**Owns:** `src/world/ui/**`

## Goal

Every 2D control over the world: the title card, the always-on menu, the section panels, toasts, the controls hint and the skip link. It looks like frosted night glass, works fully by keyboard, and switches language instantly.

## Look

- **Colors:** from `src/styles/tokens.css`. Surfaces are `dusk` at about 70% opacity with `backdrop-filter: blur(12px)`; without blur support, `dusk` at 92%.
- **Type and shape:** "M PLUS Rounded 1c"; 16 px corner radius; soft shadow.
- **Focus:** rings in `lamp`.
- **Motion:** about 200 ms ease-out, and none with reduced motion.

## Steps

1. **Title card.**
   - Shown in phases `loading` and `title`. It reads `name` and `tagline`, plus a loading bar driven by `loadProgress`.
   - In `title`, it shows two buttons: **Enter with sound** (`setSound(true)`) and **Enter muted** (`setSound(false)`). Either one emits `uiClick` and calls `setPhase('intro')`.
   - Remove `#boot-card` when the card first renders.
   - Done when Enter is impossible before `title`, and focus lands on "Enter with sound".
2. **Menu.**
   - Visible from `intro` onward. Desktop: a top-left bar. Mobile: a bottom bar, 56 px tall, respecting the safe area.
   - **Items:** About · Things I've built · Say hi. Each calls `openSection(id, 'menu')`.
   - **Controls:** a language toggle (`setLang`, labelled `ui.langToggle`); a sound toggle (`setSound`, with a speaker icon and `aria-pressed`); a "Classic view" link that sets `localStorage['ash.view']='classic'` (in try/catch) and goes to `?view=classic`.
   - Done when every control works by mouse, touch and keyboard.
3. **Panels.**
   - One dialog component (`role="dialog"`, `aria-modal`, labelled by its title) rendering the open section from `src/content/site.ts` in `store.lang`.
   - **Layout:** desktop, a 420 px right-hand sheet; mobile, a bottom sheet up to 75% of the viewport height that scrolls inside itself.
   - **About:** the photo, then the paragraphs.
   - **Builds:** three cards, each with image, title, summary, expandable body, tags and links.
   - **Say hi:** large link buttons. In phase `deck`, also show `ui.rideDown`, which calls `closePanel()`.
   - **Behaviour:** Esc and the close button call `closePanel()`. Focus moves into the panel when it opens and returns to whatever opened it when it closes. Every text element carries `lang`.
   - Done when switching language with a panel open swaps the text in place.
4. **Toasts.**
   - Render `store.toast` bottom-center, as a polite live region.
   - The `slow` kind adds **Switch to Classic view** (behaving like the menu link) and **Dismiss** (`clearToast`).
   - Done when toasts auto-clear (the store does it) and stay reachable by keyboard while visible.
5. **Controls hint.**
   - Show it from the start of `explore` until the character first moves (`runtime.character.speed > 0.1`) or 10 s pass.
   - Use `ui.controlsHint`, or `ui.controlsHintTouch` when `(pointer: coarse)`.
6. **Skip link and sounds.**
   - The first focusable element: a "Skip to text version" link pointing at `#classic-content`, which also reveals the visually hidden Classic content while it has focus.
   - Every button emits `uiClick`.

## Acceptance

- [ ] `npm run check` passes.
- [ ] Shots, desktop and mobile in EN and JA:
  - the title card while loading and at `title`
  - the menu
  - each of the three panels
  - Say hi in `deck` phase (force it with `?shot=deck&panel=sayhi`)
  - a `slow` toast (trigger it with `window.__world.store.getState().showToast(...)`)
- [ ] Keyboard walkthrough in Playwright:
  - Tab order is skip link → Enter buttons, then once in, skip link → menu items → toggles.
  - Enter opens a panel; Esc closes it and returns focus.
- [ ] Contrast of every text and background pair is at least 4.5:1 (list the pairs and ratios in the PR).
- [ ] The UI works with stub scene components: nothing here imports `scene`, `character` or `camera`.
