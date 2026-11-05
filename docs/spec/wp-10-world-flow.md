# WP-10: World flow and interactions

**Depends on:** WP-05, WP-06, WP-07 · **Branch:** `wp-10-world-flow` · **Wave:** 4
**Owns:** `src/world/flow/**`

## Goal

The glue that turns the parts into a walk:

- Proximity zones and floating labels.
- Opening sections.
- The vending machine, the temple bell and the konbini's automatic door.
- The deck sequence from start to finish.

When this merges, version 1 can be played end to end.

## Steps

1. **Proximity.**
   - Every frame, measure the distance from `runtime.character.position` to each `registry.zones` entry. Call `setNearby` with the nearest zone the character is inside, with 0.3 m of hysteresis so it doesn't flicker.
   - The `door` zone opens the door (step 4) and isn't a `nearby` target.
   - Done when `nearby` changes exactly once on entering and once on leaving each zone.
2. **Labels.**
   - Draw drei `<Html>` labels at `registry.labels`: the section title (`site.ts`) or the interaction name (`ui.interactVending` / `ui.interactBell`).
   - Fully visible within 12 m, dimmed out to 25 m, hidden beyond that. Hidden outside `explore`.
   - When `nearby`, the label adds the key hint (`ui.interactKey`, or `ui.tapHint` on touch).
   - **Click or tap:** a section label calls `openSection(id, 'menu')`; an interaction label calls `walkTo(id)`.
   - Labels are real buttons, but the canvas is `aria-hidden`, so they aren't in the tab order. The menu covers keyboard users.
3. **Interact key.**
   - E or Enter while `nearby`: a section calls `openSection(id, 'world')`; an interaction runs it (step 4).
   - On `arrive` at an interaction's stand, run it. On `arrive` at `sayhi` with `openPanel === 'sayhi'`, start the deck (step 5).
4. **Interactions** (animate the `registry.anim` objects in code):
   - **Vending:** emit `interact`. After 0.8 s, `ANIM_vending_can` drops 0.35 s into the tray. Show the toast `ui.gotDrink` with a random `ui.drinks` entry (seeded while frozen). Reset after 3 s. 2 s cooldown.
   - **Bell:** emit `interact`. `ANIM_bell_striker` swings back and strikes over 1.2 s, and `ANIM_bell` sways with damping for 4 s. 6 s cooldown.
   - **Konbini door:** in the `door` zone, `ANIM_konbini_door` slides open over 0.5 s and emits `door {open:true}`; leaving the zone slides it closed.
   - Done when each runs again after its cooldown, and the character plays `interact` (WP-05 does that on the event).
5. **Deck sequence.**
   - **Enter:** `setPhase('deck')` and emit `deck` `enter`. The camera (WP-06) sweeps, cuts and emits `arrived`. The panel stays open.
   - **Exit:** when `openPanel` becomes `null` while in `deck`, emit `deck` `exit`, `runtime.character.teleport(towerExit)`, then `setPhase('explore')`.
   - **Prefetch:** call `prefetchDeck()` when the character enters `ZONE_about`, or when `sayhi` is opened from the menu.
   - Done when the deck works from the menu and from walking up.
6. **Freeze.** While `runtime.debug.freeze`, labels render, nothing animates, and the toast is suppressed unless a test calls it.

## Acceptance

- [ ] `npm run check` passes.
- [ ] A Playwright walkthrough (`scripts/tests/wp-10-walkthrough.mjs`), with shots at each step and no console errors:
  1. Enter muted.
  2. Walk with W to the vending machines; E gives a can and a toast.
  3. Walk to the konbini; the door opens; E opens Builds.
  4. Through the gate; E opens About.
  5. The bell label: the character walks over and rings it.
  6. The menu's Say hi: the character walks to the tower, then the deck plays.
  7. Ride down: back at `towerExit`.
- [ ] The same walkthrough in `/ja/` shows Japanese labels and toasts.
- [ ] Any movement input during auto-walk cancels it. Closing a panel mid-walk stops the walk.
