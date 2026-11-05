# WP-02: Art pipeline and greybox

**Depends on:** nothing · **Branch:** `wp-02-art-pipeline` · **Wave:** 1

**Owns:**

- `art/requirements.txt`, `art/build.py`, `art/preview.py`, `art/validate.py`, `art/lib/**`
- `art/palette.json`, `art/layout.json` (handed to WP-15 after merge)
- `art/props/__init__.py`, `art/scenes/__init__.py`, `art/characters/__init__.py`
- `public/models/*.glb` (greybox and placeholder versions)

## Goal

Build the Python + Blender machinery every art package uses:

- Build, bake, export, optimize, validate and preview, all headless and repeatable.
- The world layout (`layout.json`).
- **Greybox** `street`/`deck` and a **placeholder** `ash` that already satisfy the full naming contract.

Code packages can then integrate against real files while the final art is still being made.

## Steps

1. **Environment.**
   - `art/requirements.txt` pins `bpy==5.2.3` (it needs Python 3.13) and `pygltflib`.
   - `build.py --help` documents the setup: `python3.13 -m venv .venv-art && .venv-art/bin/pip install -r art/requirements.txt`.
   - Done when `python -c "import bpy; print(bpy.app.version_string)"` works in that venv.
2. **`art/lib/`: the `BuildContext` passed to every module** (overview § 6.9).
   - **Materials:** `ctx.mat(token)`, `ctx.emit(token, strength)`, `ctx.dyn(token)`, `ctx.glass(tint, alpha)`. Every color comes from `palette.json` (overview § 6.8, written by this package). Names follow § 6.2.
   - **Geometry helpers:** `ctx.geo.rounded_box(size, bevel)`, `cylinder`, `lathe(profile)`, `extrude(polyline, depth)`, `sweep(curve, profile)`, `instance(collection, transforms)`. Boxy shapes get a bevel of at least 2 cm by default, which is the soft-miniature look.
   - **Text:** `ctx.text_jp(string, size)` makes text meshes with Noto Sans JP. Download the OFL font once into `art/.cache/` from a pinned URL, check its sha256, and copy its license into `art/fonts/OFL.txt`. Never commit the font itself.
   - **Randomness:** `ctx.rng`, a `random.Random` seeded per module name.
   - **Custom properties:** `ctx.empty(name, location, rotation_deg, **extras)` creates empties whose custom properties export as glTF `extras`.
   - Done when a tiny test prop that uses every helper builds.
3. **`lib/bake.py`.**
   - `bake(objects, atlas, size)` creates a second UV map (lightmap pack), bakes Cycles on the CPU (diffuse direct + indirect + color) into `art/out/bake/<atlas>.png`, and swaps the materials to `BAKED_<atlas>`.
   - Static meshes that share an atlas are merged into one mesh, to keep draw calls low. Contract-named objects (§ 6.2) are never merged.
   - `--fast` uses few samples and a quarter resolution.
   - The view transform is AgX.
   - Done when the greybox street bakes with `--fast` in under 10 minutes.
4. **Export, optimize and validate**, all inside `build.py`.
   - **Export:** glTF binary, Y-up, custom properties included, cameras included, punctual lights excluded.
   - **Optimize:** `npx --yes @gltf-transform/cli@<pinned exact version> optimize`, with meshopt compression and WebP textures. Street and deck get two variants: 2048 px maximum textures (`<target>.glb`) and 1024 px (`<target>-low.glb`). **Turn off joining, flattening, instancing and simplification**, so contract node names survive.
   - **Validate:** run `validate.py` on the **optimized** files.
   - Done when one command takes a target from scripts to validated `public/models/` files.
5. **`validate.py <glb> [--target street|deck|ash|prop]`.** It enforces:
   - Every required node and material rule in § 6.2, including `extras` types, at most 8 `LIGHT_` nodes, no `MAT_*` materials, and every shot listed.
   - The character contract in § 6.3: bones, clips and root `extras`.
   - The size and triangle budgets in § 7, plus per-prop triangle caps passed with `--max-tris`.
   - Done when it prints a pass/fail list and exits non-zero on failure, and a deliberately broken file fails.
6. **`preview.py <target> --shot <name> [--fast]`.**
   - Renders the saved `art/out/<target>.blend` from `CAM_shot_<name>` with Cycles on the CPU, AgX, at 960×540, into `shots/art/<target>-<shot>.png`.
   - For `prop:<name>`: a front view and a three-quarter view under a neutral night lighting setup (a dim blue sky plus one warm lamp).
   - Done when previews render for every target.
7. **`layout.json`.** Turn the map in overview § 4 into numbers:
   - The street, sidewalk and temple-ground outlines.
   - Every landmark: prop, position, rotation, footprint and `empties` offsets.
   - Side-building slots.
   - `SPAWN_*`, `PATH_*` (a waypoint every 6–8 m), up to 8 `LIGHT_*`.
   - The `camera` block (§ 6.4).
   - The `establish` shot pose and the `CAM_sweep_*` path up the tower.
   - **Computed:** the gameplay shots, derived from the stands and the `camera` block.
   - Done when a greybox `start` preview shows the tower's lit upper section (the wayfinding rule, overview § 4). Tune the tower's distance and size until it does.
8. **Greybox and placeholder assets.**
   - **`street`:** palette-colored rounded boxes for every footprint and side building; stepped tapering boxes for the tower; every contract node, including `ANIM_*` stand-in boxes at the offsets given in `layout.json`; `COL_` boxes per footprint plus the perimeter; `WALK_` surfaces; about 6 `PUDDLE_` meshes; and a few `EMIT_` parts (lamps, vending fronts, tower) so bloom can be tested. Bake it with `--fast`, so the `BAKED_` path works end to end.
   - **`deck`:** a slice of the room, a window band, skyline boxes with emissive windows, and `CAM_shot_deck`.
   - **`ash` placeholder:** a capsule body, a sphere head and an umbrella stick. It has the exact § 6.3 bone names, crude keyframed `idle`, `walk` and `interact` clips, and the root `extras`.
   - **Dispatch:** `build.py` uses the real module (`art/scenes/street.py` and so on) when it exists, unless `--greybox` is passed.
   - Done when all three validate and are committed to `public/models/`.

## Acceptance

- [ ] `python art/build.py street && python art/build.py deck && python art/build.py ash` succeed from a clean checkout. Running them twice produces the same node set and the same triangle counts.
- [ ] `validate.py` passes on all five output files (`street`, `street-low`, `deck`, `deck-low`, `ash`).
- [ ] Previews exist for `street` `establish` and `start`, and `deck` `deck`. The `start` preview shows the tower's lit upper section.
- [ ] A test prop under `art/props/` builds and previews through `build.py prop:<name>`. Remove it before merging.
- [ ] Greybox file sizes are well inside § 7.

## Gotchas

- `bpy` as a module has no GPU and no window. Use Cycles with `device='CPU'` everywhere; EEVEE needs a GPU context.
- The glTF exporter writes custom properties only with `export_extras=True`, and cameras only with `export_cameras=True`.
- gltf-transform's `optimize` merges and renames meshes by default. Always validate the file it produced, not the raw export.
