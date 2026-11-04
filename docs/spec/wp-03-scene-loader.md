# WP-03: Scene loader and dev viewer

**Depends on:** WP-01, WP-02 · **Branch:** `wp-03-scene-loader` · **Wave:** 2
**Owns:** `src/world/scene/**`, `src/dev-pages/**`

## Goal

Load the models, convert their materials and parse every named node into the registry (overview § 6.6). Other packages then never search the scene graph. Also own debug shot mode and the `/dev/viewer` page that art and code packages use to inspect models.

## Steps

1. **Loading.**
   - Load `street` (or `street-low` on the low tier) and `ash` with drei's `useGLTF` and meshopt.
   - Report drei `useProgress` to `store.setLoadProgress`, and call `setPhase('title')` once both have loaded.
   - Export `prefetchDeck()`, which loads `deck` or `deck-low` in the background. WP-10 calls it.
   - Done when the phase reaches `title` against the greybox files.
2. **Materials** (§ 6.2 table).
   - `BAKED_*` → `MeshBasicMaterial` with the baked map (sRGB).
   - `EMIT_*` → keep the glow and the emission strength, so values over 1 feed bloom.
   - `DYN_*` → `MeshStandardMaterial`.
   - `GLASS_*` → transparent, with depth writes off.
   - `COL_*` and `WALK_*` meshes stay in the scene for raycasting and physics but are never drawn.
   - Done when the dev viewer shows baked colors matching the `preview.py` render.
3. **Registry.**
   - Parse `street`, `deck` and `ash` into the `useWorld()` shape in § 6.6, converting Blender-facing empties into three.js poses: `yaw` from the empty's forward direction (§ 6.1).
   - Export `shotStands`, the shot → pose mapping in § 6.2.
   - Log a `console.error` naming every missing contract node.
   - Done when the greybox produces a complete registry with no errors.
4. **`<Scene/>`.**
   - Render the street.
   - Mount the deck at an exported `DECK_OFFSET = (0, 0, -2000)`, visible only in phase `deck`.
   - Done when both render in their phases.
5. **Debug shot mode.**
   - When `runtime.debug.shot` is set: copy `CAM_shot_<shot>`'s pose and field of view onto the default camera, and set `phase` to `explore` (or `deck` for `deck`).
   - Once two frames have rendered, set `window.__worldReady = true`. In normal mode, set it at `title`.
   - WP-05 places the character from `shotStands`, and WP-06 leaves the camera alone while `shot` is set.
   - Done when `/?view=world&shot=start` matches the composition of `preview.py street --shot start`.
6. **`src/dev-pages/viewer.astro` (route `/dev/viewer`).**
   - Parameters: `?model=street|street-low|deck|deck-low|ash`.
   - Orbit controls, with toggles to overlay: `COL_` wireframes, `WALK_` surfaces, `ZONE_` radius rings, `STAND_` facing arrows, the `PATH_` polyline, `LIGHT_` spheres, `REFL_` markers and `CAM_` frustums.
   - A side list of contract nodes, each marked found or missing.
   - For `ash`: a clip player.
   - A draw-call and triangle readout.
   - `?shot=<name>` jumps to a camera.
   - Done when all of the above works on every model.

## Acceptance

- [ ] `npm run check` passes.
- [ ] `/?view=world&shot=<name>` renders each § 6.2 shot against the greybox. Compare `shots/start.png` with `shots/art/street-start.png`: same framing, and the tower visible.
- [ ] `/dev/viewer?model=street` shows every overlay and lists no missing nodes. It is absent from `astro build` output.
- [ ] `useWorld()` values match `layout.json` positions within 1 cm, after the axis conversion in § 6.1.
- [ ] Phase `loading` → `title` happens. `loadProgress` climbs from 0 to 1.
