# WP-15: Street assembly and bake

**Depends on:** WP-03, WP-11, WP-12 · **Branch:** `wp-15-street-assembly` · **Wave:** 3
**Owns:** `art/scenes/street.py`, `art/layout.json` (from WP-02), `public/models/street.glb`, `public/models/street-low.glb`

## Goal

Assemble the final street from `layout.json`, the WP-11 and WP-12 props, ground detail, and baked night lighting, while keeping every contract node in place. This package decides how the world finally looks.

## Steps

1. **Ground.**
   - An asphalt road with darker wet patches; sidewalks with curbs.
   - Painted markings: a center line, a crosswalk and 「止まれ」 before the corner. Decorated manhole covers.
   - Temple grounds of gravel with a stone path, and low steps up to the gate. Hedges and pines (`pine_tree`) along the temple edge.
   - 6–10 `PUDDLE_` meshes spread along the walk.
   - Done when the ground alone, under the bake, already looks wet and cozy.
2. **Placement.**
   - Instantiate every landmark and prop at its `layout.json` entry.
   - Fill the side-building slots with `house_a`, `house_b`, `apartment` and `shop_shutter` (seeded variety) so the street feels enclosed.
   - Run utility poles every 15–20 m with `utility_pole.wires`. Place streetlights, traffic mirrors, signs, bikes and clutter in natural spots, keeping the character's path and every `STAND_` clear.
   - Stone lanterns and `jizo_row` sit in the temple grounds.
   - Place every contract empty from `layout.json`.
   - Done when the viewer lists no missing nodes and auto-walk paths stay clear.
3. **Lighting for the bake.**
   - A dim blue sky dome (`dusk`).
   - Warm point lights at the streetlights and lanterns, and the konbini interior spilling teal-white light onto the sidewalk.
   - The `EMIT_` vending machines, signs and tower glow also light the bake.
   - The `LIGHT_` empties (at most 8) mark the lamps nearest each stand, so the character is lit where it matters.
4. **Bake and merge.**
   - Group the static meshes into at most 4 atlases at 2048 px (for example: near street, buildings, temple, tower) and bake them with `lib/bake.py`.
   - Static meshes merge per atlas, and `EMIT_` meshes merge per material. Contract nodes stay separate.
   - Done when draw calls stay within § 7, with the effects' share (WP-08) left over.
5. **Export and check.**
   - `python art/build.py street` (full quality for the final commit), then `validate.py` on both tiers.
   - `preview.py street` for every shot.
   - Browser shots `/?view=world&shot=<each>` at both tiers.
6. **Wayfinding.** The `start` shot shows the tower's glowing upper section above the street. If it doesn't, adjust the tower's distance or size in `layout.json` (a contract change, coordinated with WP-06's camera block).

## Acceptance

- [ ] `validate.py` passes on both street files, within § 7: at most 5 MB and at most 2.5 MB, plus the triangle limits.
- [ ] In the PR: browser shots of every § 6.2 street shot at both tiers, and the `establish` preview.
- [ ] `?debug=stats` on `start`, `konbini` and `tower-base` stays within § 7 draw calls and triangles, with room for the WP-08 effects.
- [ ] Every contract node is present. The WP-10 walkthrough (if it has merged) still passes on the new file.
