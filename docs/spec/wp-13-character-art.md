# WP-13: Character art (chibi Ash)

**Depends on:** WP-02 · **Branch:** `wp-13-character-art` · **Wave:** 2
**Owns:** `art/characters/ash.py`, `public/models/ash.glb`

## Goal

Replace the placeholder with a lovable chibi Ash that matches the contract in overview § 6.3 exactly. The code (WP-05) already works with the placeholder's bones, clips and `extras`, so the replacement must drop in unchanged.

## Likeness

Compare against `public/images/asahi-headshot.png`. What makes the character read as Ash:

- Wavy, medium-length dark hair with a silvery sheen, built as chunky wavy clumps. Its outline is the main identifier.
- A small chin beard.
- No glasses.
- A calm, friendly expression: simple dot or almond eyes and a small smile, painted as small dark meshes or geometry, not textures.

The outfit and the clear umbrella are as described in § 6.3.

## Steps

1. **Model.**
   - Build from rounded primitives joined into a few meshes: a big head (about 40% of the height), a small body, stubby limbs and mitten hands.
   - About 1.15 m tall with the hair. Smooth shading and soft bevels.
   - Materials: `DYN_skin`, `DYN_hair`, `DYN_jacket`, `DYN_tee`, `DYN_jeans`, `DYN_shoes`, `GLASS_umbrella` and `DYN_umbrella_handle`, colored to match the headshot and the palette.
   - Done when the front, side and three-quarter previews read as Ash at 256 px.
2. **Umbrella.** `UMBRELLA` is parented to `hand.R`. Its canopy is 1.0 m across, a slightly white-tinted `GLASS_` with visible ribs, tilted so the face shows through it from the gameplay camera's angle. Done when the gameplay-angle preview shows the face through the canopy.
3. **Rig.**
   - The armature has exactly the bone names in § 6.3.
   - Use automatic weights, then fix any obvious bleeding: hair must not follow the arms.
   - Done when moving each limb in a test pose deforms cleanly.
4. **Animation**, keyframed in code:
   - `idle`: a 2 s loop with gentle breathing and a slight umbrella sway.
   - `walk`: about a 0.8 s loop, a bouncy chibi walk, in place. Measure its stride and set `extras.walkSpeed` and `extras.footstepTimes` to match.
   - `interact`: about 1 s, the left arm reaching forward to press a button or pull a rope, then returning.
   - Done when a contact sheet (walk at 0, 0.25, 0.5 and 0.75) shows proper foot contacts.
5. **Export and check** with `python art/build.py ash`, `validate.py` and `/dev/viewer?model=ash` (use the clip player).

## Acceptance

- [ ] `validate.py public/models/ash.glb --target ash` passes: bones, clips, `extras`, only `DYN_` and `GLASS_` materials, at most 8k triangles, at most 0.8 MB.
- [ ] In the PR: previews (front, three-quarter, gameplay angle), the walk contact sheet and the `idle`/`interact` key poses.
- [ ] On the branch with WP-05 merged, the `start` shot shows the new character with no code changes.
