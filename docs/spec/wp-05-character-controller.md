# WP-05: Character controller

**Depends on:** WP-03 · **Branch:** `wp-05-character` · **Wave:** 3
**Owns:** `src/world/character/**`

## Goal

Chibi Ash walks the street: keyboard, click or tap to walk, and auto-walk to landmarks. Rapier handles collisions, animations blend between idle, walk and interact, and the controller publishes the character's position every frame.

## Steps

1. **Model and animation.**
   - Mount `useWorld().character.scene` and an `AnimationMixer` with the `idle`, `walk` and `interact` clips, crossfading over 0.2 s.
   - The `walk` playback rate is the current speed divided by `extras.walkSpeed`.
   - Done when idle and walk blend cleanly with no foot sliding at either speed.
2. **Physics.**
   - Turn every `registry.colliders` mesh into a fixed Rapier collider: a cuboid when it's box-like, otherwise a convex hull.
   - The character is a kinematic capsule (radius 0.25 m, total height 1.1 m) moved with Rapier's `KinematicCharacterController`: sliding on, autostep 0.15 m, snap to ground.
   - Done when the character slides along walls and can't leave the street or walk through props.
3. **Keyboard movement.**
   - WASD and arrow keys, in fixed world directions: W or ↑ walks toward the tower (three −Z).
   - Walk at 2.6 m/s, and at 4.2 m/s while Shift is held. Accelerate and decelerate over about 0.15 s, and turn smoothly toward the direction of travel.
   - Movement is accepted only in phase `explore` and while `interact` isn't playing. Any movement input calls `store.cancelAutoWalk()`.
   - Done when diagonal speed equals straight-line speed and stops feel crisp.
4. **Click or tap to walk.**
   - A pointer tap on the canvas (not a drag: less than 8 px of movement and under 300 ms) raycasts against `registry.walk`. A hit calls `store.walkTo({x, z})`.
   - Done when taps walk and drags do nothing.
5. **Auto-walk.** Consume `store.autoWalk`:
   - **A section or interaction id:** project the character onto the `registry.path` polyline, follow it toward the path point nearest the target, then walk to `registry.stands[id]`.
   - **A point:** walk straight to it.
   - **On arrival** (within 0.3 m): turn to the stand's yaw, emit `arrive`, clear `autoWalk`.
   - **When stuck** (under 0.2 m of progress in 1 s): cancel.
   - Auto-walk uses the fast speed.
   - Done when the menu's "About" walks from the start to `STAND_about` without getting stuck.
6. **Outputs.**
   - Every frame, write `runtime.character.position`, `yaw` and `speed`.
   - Implement `runtime.character.teleport`.
   - Emit `footstep` at `extras.footstepTimes` while walking.
   - On the `interact` event, face that interaction's stand, play `interact` once and hold movement until it ends.
   - Done when the events can be seen with an `events.on` logger.
7. **Blob shadow.** A soft, dark disc under the character (a transparent texture, 0.7 m across), fading as the character rises. There are no real-time shadows.
8. **Debug and freeze.** When `runtime.debug.shot` is set, teleport to `shotStands[shot]` and pose `idle` at time 0. While frozen, don't advance the mixer.

## Acceptance

- [ ] `npm run check` passes.
- [ ] A Playwright script, `scripts/tests/wp-05-movement.mjs`, drives `window.__world`:
  - Holding W for 2 s moves the character about 5 m toward −Z.
  - Walking into the vending machines stops at the collider.
  - `walkTo('about')` arrives at `STAND_about` within 0.3 m.
  - A tap on open street walks there.
- [ ] The `vending`, `konbini` and `gate` shots show the character at the right stand, facing the right way.
- [ ] The character adds at most 6 draw calls.
