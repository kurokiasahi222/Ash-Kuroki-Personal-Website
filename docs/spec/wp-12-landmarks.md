# WP-12: Landmarks art (Tokyo Tower, Zojoji)

**Depends on:** WP-02 · **Branch:** `wp-12-landmarks` · **Wave:** 2
**Owns:** `art/props/{tokyo_tower,sangedatsumon_gate,bell_tower,stone_lantern,jizo_row,pine_tree}.py`

## Goal

The hero silhouettes. Tokyo Tower glowing orange above Zojoji's great red gate is the image visitors should remember. Same style rules as WP-11: chunky, bevelled, palette-only, with fictional signage. Iconic, recognizable shapes matter more than accuracy.

## Props

| Module               | What it is                                                             | Must include                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Triangle cap   |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `tokyo_tower`        | A stylized Tokyo Tower at the height in `layout.json` (about 40 m)     | Four splayed legs and a tapering lattice, generated in code (edge struts plus X-bracing); alternating `tower`/`towerWhite` bands on the upper half; the main deck (around 40% of the height) and the top deck (around 70%), both with `EMIT_` window bands; the antenna; the night "Landmark Light" glow as `EMIT_` strips along the legs and lower lattice; at the base, a "FootTown"-style podium building with a lit entrance where `STAND_sayhi` will sit | 40k            |
| `sangedatsumon_gate` | Zojoji's two-story main gate: three bays, deep `vermilion` and `wood`  | Two stacked roofs with upturned eaves (build the roof profile with `ctx.geo.sweep`), dark `roof` tiles suggested by ridged geometry, a plaque, two hanging lanterns (`EMIT_`), and a central passage wide enough to walk through (`COL_` only on the pillars)                                                                                                                                                                                                 | 25k            |
| `bell_tower`         | A small open bell house (shōrō): stone base, four posts, a curved roof | A bronze `DYN_` bell named `ANIM_bell`, made with `ctx.geo.lathe`, with its pivot at the top attachment; a hanging striker log named `ANIM_bell_striker` with its pivot at its ropes; `extras.swingAxis` on both (`"x"` or `"y"`, the local axis the code rotates about)                                                                                                                                                                                      | 8k             |
| `stone_lantern`      | A stone tōrō                                                           | A warm `EMIT_` light box                                                                                                                                                                                                                                                                                                                                                                                                                                      | 600            |
| `jizo_row`           | A row of small stone Jizo statues with red knit caps and pinwheels     | A `count` parameter; caps in `vermilion`                                                                                                                                                                                                                                                                                                                                                                                                                      | 300 per statue |
| `pine_tree`          | A sculpted Japanese garden pine with layered cloud-like foliage pads   | A seeded variant                                                                                                                                                                                                                                                                                                                                                                                                                                              | 1.5k           |

## Steps

1. **Build each module.** The tower's lattice generator is the hardest piece. Make it parametric (height, base width, band count, strut thickness) and keep it within the triangle cap by using flat struts and fewer bracing levels near the top. Done when every module builds and validates with its cap.
2. **Preview:**
   - Each prop with `python art/preview.py prop:<name>`.
   - The tower also from far away: render it at 120 m with a 50° field of view, which is what the `start` shot sees.
   - Check the silhouettes: the tower is recognizable as Tokyo Tower from far away, and the gate as a Japanese temple gate.
   - Done when the far tower preview reads as Tokyo Tower in silhouette alone.
3. **Check scale and pivots** in `/dev/viewer` against the greybox footprints. Rotate `ANIM_bell_striker` and `ANIM_bell` about `swingAxis` in a test script and confirm they swing about their pivots without clipping.

## Acceptance

- [ ] Every module builds, validates and previews. The previews are in the PR, including the far tower.
- [ ] `ANIM_bell` and `ANIM_bell_striker` exist with correct pivots and `extras.swingAxis`.
- [ ] The gate's walkable passage is at least 2.5 m wide, with no collider across it.
- [ ] Palette colors only. No logos or trademarked marks.
