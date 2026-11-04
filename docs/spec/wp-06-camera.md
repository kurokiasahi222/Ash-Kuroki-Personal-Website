# WP-06: Camera rig

**Depends on:** WP-03 · **Branch:** `wp-06-camera` · **Wave:** 3
**Owns:** `src/world/camera/**`, plus the `camera` block of `art/layout.json` (a contract change; note it in the PR)

## Goal

A fixed-angle follow camera that makes the street feel like a lit miniature and keeps the tower in view, plus the two set pieces: the intro drop and the sweep up the tower to the deck.

## Steps

1. **Follow camera.**
   - Read `pitchDeg`, `fovDeg`, `behind` and `height` from `art/layout.json` (import the JSON).
   - The yaw is locked, looking along three −Z. Follow `runtime.character.position` with critical-damped smoothing (about 0.25 s), without rotating.
   - Clamp the camera inside the street bounds so it never sees past the world's edges.
   - Done when the `start` frame from the live camera matches the `start` shot.
2. **Panel framing.**
   - When `store.openPanel` is set on a wide screen (≥ 900 px), shift the view with `camera.setViewOffset`, so the character sits in the center of the area the panel leaves uncovered (the panel is 420 px on the right).
   - On narrow screens the panel is a bottom sheet, so raise the framing instead.
   - Ease the shift over 0.4 s.
   - Done when the character stays visible with any panel open, at both viewports.
3. **Intro.**
   - On phase `intro`, move from `CAM_shot_establish` to the follow pose over 2.5 s, easing in and out (a gentle arc, no roll). Then `setPhase('explore')`.
   - With reduced motion, use a 0.6 s crossfade instead.
4. **Deck sequence.**
   - On `deck` `enter`:
     1. Rise along `registry.sweep` looking at the tower's upper section, over about 3.5 s.
     2. Fade to black over 0.4 s with a full-screen quad inside the canvas.
     3. Cut to `deck.shots['deck']`, offset by `DECK_OFFSET`, and emit `deck` `arrived`.
     4. Fade in.
   - On `deck` `exit`: fade out, snap to the follow pose (WP-10 has already teleported the character to `towerExit`), fade in.
   - With reduced motion, use fades only.
   - Done when both directions play without a pop or a frame of the wrong scene.
5. **Debug.** While `runtime.debug.shot` is set, do nothing; WP-03 owns the camera then.
6. **Wayfinding tuning.**
   - Confirm the rule in overview § 4: the tower's lit upper section is visible from `SPAWN_start` during play, not only in the shot.
   - If it isn't, adjust the `camera` block, rebuild the greybox shots (`python art/build.py street --greybox`) so the art shots follow, and report the change as a contract change.

## Acceptance

- [ ] `npm run check` passes.
- [ ] Shots in the PR:
  - The live `start` frame, showing the tower.
  - The intro at 0 s, 1.2 s and its end.
  - The deck sweep midway, and the deck view.
  - A panel open on desktop and on mobile, with the character visible both times.
- [ ] With reduced motion emulated in Playwright (`reducedMotion: 'reduce'`), the intro and deck are crossfades.
- [ ] No jitter: while walking, camera position deltas are smooth from frame to frame (log a 3-second sample and show it is monotonic along −Z).
