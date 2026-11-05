# Tokyo Night Walk: spec overview

This is the single source of truth for the v2 site. Every work package (`wp-XX-*.md`) points here for decisions and contracts. If a package needs to change something defined here, it edits this file in the same PR and lists the change under **Contract changes** in the PR body.

## 1. What we're building

A rainy night at the foot of Tokyo Tower. The visitor walks a big-headed version of Ash down a quiet street, past glowing vending machines and a convenience store, through Zojoji temple's great gate, and rides Tokyo Tower up to its observation deck. Each landmark holds one section of a light personal site.

**Feel:** cozy, quiet and toy-like. Warm pools of lamplight in cool blue rain. A soft low-poly miniature: rounded, bevelled shapes, simple colors, light pre-computed in Blender. Wet streets reflect the signs and the orange tower. Nothing is realistic, and nothing is cluttered.

**References:** Bruno Simon's folio (https://bruno-simon.com): its soft baked low-poly look and a camera that follows the player. Felix Rieseberg's site (https://felixrieseberg.com): its rainy-night mood and its fallback to a plain page on weak devices.

**Purpose:** for fun. Visitors should still reach every piece of content within one click.

## 2. Decisions

These are settled. Packages implement them and don't reopen them.

| Topic            | Decision                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Purpose          | Fun personal site. No AI/ML showcase.                                                                                                                                                                                    |
| Setting          | The streets at the foot of Tokyo Tower at night: a quiet street → Zojoji's Sangedatsumon gate and temple grounds → the tower. Inspired by the real place, not a map-accurate copy.                                       |
| Weather          | Light rain, with wet streets and puddles.                                                                                                                                                                                |
| Player           | A walking chibi Ash (see § 6.3). Fixed-angle camera that follows the player.                                                                                                                                             |
| Controls         | WASD or arrow keys; click or tap a spot to walk there; E or Enter to interact. No on-screen joystick.                                                                                                                    |
| Menu             | Always visible: About · Things I've built · Say hi, plus the language and sound toggles and a Classic view link. A menu entry opens its panel **instantly** while the character walks to the landmark in the background. |
| Fallback         | Classic view: a fast static page with the same content. Used for weak devices, people who opt out and search engines.                                                                                                    |
| Look             | Soft low-poly miniature, light pre-computed ("baked") in Blender.                                                                                                                                                        |
| Art pipeline     | Everything is built by Python scripts driving Blender (`bpy`, run headless) and exported to glTF. No hand modeling.                                                                                                      |
| Stack            | Astro (static output) · React · React Three Fiber + drei · Rapier physics · zustand · `@react-three/postprocessing`. Pin exact versions.                                                                                 |
| Hosting          | Vercel (current). v2 replaces asahikuroki.com at launch, and the old site is retired.                                                                                                                                    |
| Languages        | English at `/`, Japanese at `/ja/`. The toggle swaps text without reloading the world.                                                                                                                                   |
| Version 1 extras | Ambient and positional sound, the language toggle, small interactions (vending machine, temple bell).                                                                                                                    |
| Loading          | A title card with a loading bar, then **Enter with sound** / **Enter muted**, then the camera drops down to the character.                                                                                               |
| Observation deck | A camera sequence, not walkable: the camera sweeps up the tower, fades, and shows the night view with the Say hi panel.                                                                                                  |
| Analytics        | Keep the existing Google Analytics tag `G-20VY92PLKM`.                                                                                                                                                                   |

**Version 1 contains exactly** the street, the five landmarks in § 4, the deck sequence, the three content sections, the two interactions, the konbini's automatic door, sound, both languages, both views and both quality tiers.
**Later versions may add:** a walkable deck, a guestbook, more districts, gamepad support, and an original AI project on a spare shelf.

## 3. Content sections

| Section id | Menu label (EN)   | Where in the world                                                                               | What's in it                                                                                                                                   |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `builds`   | Things I've built | Konbini "あさひマート" (Asahi Mart): three glowing products on the window shelf, one per project | Drone Simulation · GPT-2 from scratch (a write-up only) · this website                                                                         |
| `about`    | About             | Zojoji's Sangedatsumon gate                                                                      | A short story: born and raised in Japan, moved to the US alone at 15, University of Minnesota (CS + Entrepreneurship), now in Tokyo, bilingual |
| `sayhi`    | Say hi            | Tokyo Tower → observation deck                                                                   | GitHub and LinkedIn                                                                                                                            |

All text lives in `src/content/site.ts` (§ 6.7). Copy is written in English and Japanese, and Ash proofreads the Japanese.

## 4. World map

The walk runs along Blender **+Y**, which is three.js **−Z** (§ 6.1). The camera sits behind the player and looks toward the tower. Distances are starting values; WP-02 finalizes them in `art/layout.json`.

```
 Blender +Y (toward the tower)
   ▲
   │                 ┌───────────────┐
   │  y≈95           │  TOKYO TOWER  │  ← stylized, about 40 m tall
   │                 │   (base: Say  │    SPAWN_tower_exit beside the entrance
   │  y≈78           └──┬ sayhi ──┬──┘
   │                    temple grounds: stone lanterns, rows of Jizo statues
   │  y≈62    [bell tower: bell]  with pinwheels
   │  y≈50   ═══ SANGEDATSUMON GATE (about) ═══   spans the path
   │  y≈30   [konbini あさひマート (builds)]  │   street
   │                                          │   (7 m road and
   │  y≈15              │          [vending ×3 (vending)]   sidewalks)
   │  y≈0               ● SPAWN_start (quiet corner, sign showing controls)
   └──────────────────────────────────────────► Blender +X
        camera starts here, behind and above, looking toward +Y
```

**Walk order:** start → vending machines (interaction) → konbini (`builds`) → gate (`about`) → bell tower (interaction) → tower base (`sayhi`) → deck sequence. A walk from start to tower takes about 30 seconds.

**Wayfinding rule:** the tower's lit upper section is visible in the camera frame from `SPAWN_start`. WP-02 (layout) and WP-06 (camera) tune the tower's distance and size, and the camera's pitch and field of view, until the `start` shot shows it.

## 5. Architecture

```
art/                      Python + bpy. Builds every 3D asset (WP-02 owns the pipeline)
  layout.json             positions of everything; the source of truth for the world layout
  palette.json            colors (§ 6.8)
  lib/  props/  build.py  preview.py  validate.py
public/models/            exported, optimized .glb files (committed; Vercel never runs Blender)
public/audio/             sound files + CREDITS.md
src/content/              types.ts (schema) + site.ts (all text, EN + JA)
src/pages/                index.astro (/), ja/index.astro (/ja/)
src/dev-pages/            dev-only routes (/dev/viewer), absent from production builds
src/components/classic/   Classic view (static Astro, no JS needed to read)
src/world/                the 3D app, loaded only in world mode
  boot/                   view-mode + tier detection, mounting
  App.tsx store.ts runtime.ts events.ts
  scene/  character/  camera/  ui/  fx/  audio/  flow/   ← one folder per package
scripts/                  shots.mjs (screenshots), budget.mjs (size budgets)
```

**Boot and view mode.** Every page is server-rendered Classic content, so search engines and people without JavaScript get everything. An inline `<head>` script decides the mode before first paint (§ 8). In world mode it adds `html.world-mode`, which visually hides the Classic content while keeping it readable by screen readers. A module script then dynamically imports `src/world/boot/mount.tsx`, which renders `<App/>`. The 3D bundle is never downloaded in Classic mode.

**Composition.** `App.tsx` (WP-01) mounts `<Canvas>` → `<Physics>` → each package's root component, plus the DOM `<Ui/>`. Every package replaces only its own stub file, so nobody edits `App.tsx` after WP-01.

| Folder                 | Root component                                      | Package |
| ---------------------- | --------------------------------------------------- | ------- |
| `src/world/scene/`     | `<Scene/>`: loads the models, provides the registry | WP-03   |
| `src/world/character/` | `<Character/>`                                      | WP-05   |
| `src/world/camera/`    | `<CameraRig/>`                                      | WP-06   |
| `src/world/ui/`        | `<Ui/>` (DOM, outside the canvas)                   | WP-07   |
| `src/world/fx/`        | `<Atmosphere/>`                                     | WP-08   |
| `src/world/audio/`     | `<AudioSystem/>`                                    | WP-09   |
| `src/world/flow/`      | `<WorldFlow/>`                                      | WP-10   |

## 6. Contracts

### 6.1 Coordinates and units

- 1 unit = 1 meter. Blender is Z-up; the glTF exporter converts to three.js Y-up: Blender (x, y, z) → three (x, z, −y).
- **Forward** for empties, stands and props is Blender **+Y**, which is three **−Z**. Rotate an empty so its +Y points where the character or camera should face.
- A prop's front faces Blender **−Y**, and `layout.json` gives its rotation in degrees about Z.
- The ground is at z = 0 (three y = 0). The street is flat; the temple grounds may have steps but no slopes steeper than 10°.

### 6.2 Naming contract (glTF node and material names)

Blender object names become glTF node names. Custom properties go into glTF `extras` (export with _Include → Custom Properties_). `art/validate.py` enforces this contract on every exported file.

**Nodes in `street.glb`**

| Name                              | Kind                                                     | Meaning                                                                                                         |
| --------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `SPAWN_start`, `SPAWN_tower_exit` | empty                                                    | The character's start pose, and its pose after returning from the deck                                          |
| `ZONE_<id>`                       | empty + `extras.radius` (m)                              | Proximity zone. ids: `builds`, `about`, `sayhi`, `vending`, `bell`, `door`                                      |
| `STAND_<id>`                      | empty                                                    | Where the character stops and which way it faces on arrival. ids: `builds`, `about`, `sayhi`, `vending`, `bell` |
| `LABEL_<id>`                      | empty                                                    | Anchor for the floating label. Same ids as `STAND_`                                                             |
| `PATH_<nn>`                       | empty                                                    | Street spine waypoints, `PATH_00` at the start through to the tower. Auto-walk follows them                     |
| `COL_<name>`                      | mesh, hidden                                             | Static collider. Boxes or convex shapes only                                                                    |
| `WALK_<name>`                     | mesh, hidden                                             | Surfaces you can click or tap to walk to                                                                        |
| `PUDDLE_<n>`                      | mesh                                                     | Puddle surfaces (reflections on the high tier)                                                                  |
| `LIGHT_<name>`                    | empty + `extras {color: "#rrggbb", intensity, distance}` | Real-time light for the character and moving objects. **At most 8**                                             |
| `REFL_<name>`                     | empty + `extras {color: "#rrggbb", length}`              | Anchor for a reflection streak on wet ground, under a lamp or sign                                              |
| `ANIM_<name>`                     | object                                                   | Animated in code: `ANIM_bell`, `ANIM_bell_striker`, `ANIM_vending_can`, `ANIM_konbini_door`                     |
| `SND_<name>`                      | empty                                                    | Positional sound source: `SND_vending_hum`, `SND_konbini`, `SND_bell`                                           |
| `CAM_shot_<name>`                 | Blender camera                                           | Fixed shot pose (list below)                                                                                    |
| `CAM_sweep_<nn>`                  | empty                                                    | Camera path up the tower for the deck sequence, `CAM_sweep_00` at the tower base                                |

**Nodes in `deck.glb`:** `CAM_shot_deck`, plus optional `LIGHT_*` and `REFL_*`.

**Shots** (`CAM_shot_<name>`): `establish` (the whole scene with the entire tower; the intro starts here), `start`, `vending`, `konbini`, `gate`, `bell`, `tower-base`, and `deck` (in `deck.glb`). Apart from `establish`, the street shots use the gameplay camera's framing (§ 6.4) with the character at a fixed pose:

| Shot         | Character pose  |
| ------------ | --------------- |
| `start`      | `SPAWN_start`   |
| `vending`    | `STAND_vending` |
| `konbini`    | `STAND_builds`  |
| `gate`       | `STAND_about`   |
| `bell`       | `STAND_bell`    |
| `tower-base` | `STAND_sayhi`   |

WP-02 computes these shot poses from the stands and the `camera` block.

**Materials**

| Prefix          | Use                                                         | How the web renders it                                                              |
| --------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `BAKED_<atlas>` | All static scenery after baking                             | Unlit (`MeshBasicMaterial`) using the baked texture                                 |
| `EMIT_<name>`   | Glowing parts: signs, vending fronts, windows, tower lights | Glows and feeds bloom. Emission strength is set in Blender (≥ 2) and kept on export |
| `DYN_<name>`    | Moving or code-animated objects, and the character          | `MeshStandardMaterial`, lit by `LIGHT_*` and an ambient fill                        |
| `GLASS_<name>`  | Umbrella canopy, shop glass                                 | Transparent                                                                         |
| `MAT_<name>`    | Before baking only                                          | Must not appear in exported files                                                   |

**Color matching:** Blender uses the AgX view transform, and the web renderer uses `THREE.AgXToneMapping`. This keeps `art/preview.py` renders and browser shots consistent.

### 6.3 Character asset contract (`ash.glb`)

- A chibi Ash, **1.15 m** tall including hair, with a head about 40% of that height. Origin at the center between the feet. Faces Blender +Y.
- **Look**, from Ash's headshot (`public/images/asahi-headshot.png`): wavy, medium-length dark hair with a silvery sheen, a small chin beard, no glasses. Navy casual jacket, white tee, dark jeans, white sneakers. In the right hand, a **clear vinyl convenience-store umbrella** (a `GLASS_` canopy with a white handle) held so the camera can see the face through it.
- **Armature bones:** `hips, spine, chest, neck, head, upper_arm.L/R, forearm.L/R, hand.L/R, thigh.L/R, shin.L/R, foot.L/R`. The umbrella is a mesh named `UMBRELLA`, parented to `hand.R`.
- **Animation clips** (exact names): `idle` (loop), `walk` (loop, walking in place), `interact` (one-shot, about 1 s, left hand reaching forward).
- **`extras` on the root node:** `walkSpeed` (m/s that matches `walk` at 1× playback) and `footstepTimes` (normalized times in `walk` when a foot lands, for example `[0.0, 0.5]`).
- **Materials:** `DYN_*` and `GLASS_*` only.

### 6.4 Store (`src/world/store.ts`, zustand, WP-01)

```ts
type SectionId = "builds" | "about" | "sayhi";
type InteractionId = "vending" | "bell";
type Lang = "en" | "ja";
type Phase = "loading" | "title" | "intro" | "explore" | "deck";
type Tier = "high" | "low";
type WalkTarget = SectionId | InteractionId | { x: number; z: number }; // three.js ground coordinates
type Toast = { kind: "drink" | "slow"; text: string };

interface WorldState {
  phase: Phase;
  loadProgress: number; // 0..1
  lang: Lang;
  sound: boolean;
  tier: Tier;
  reducedMotion: boolean; // from prefers-reduced-motion, live-updated
  openPanel: SectionId | null;
  nearby: SectionId | InteractionId | null; // set by flow (WP-10)
  autoWalk: WalkTarget | null; // consumed by character (WP-05)
  toast: Toast | null;

  setPhase(p: Phase): void;
  setLoadProgress(n: number): void;
  setLang(l: Lang): void; // also updates <html lang> and history.replaceState('/' | '/ja/')
  setSound(on: boolean): void;
  setTier(t: Tier): void;
  openSection(id: SectionId, via: "menu" | "world"): void; // 'menu' also sets autoWalk = id
  closePanel(): void; // also clears autoWalk
  setNearby(id: SectionId | InteractionId | null): void;
  walkTo(t: WalkTarget): void;
  cancelAutoWalk(): void;
  showToast(t: Toast): void; // auto-clears after 4 s
  clearToast(): void;
}
```

**Rules:**

- Floating labels and menu entries behave the same: the panel opens now, and the character walks there.
- Any movement input cancels auto-walk.
- When the character arrives at `sayhi` with the panel still open, the deck sequence starts (WP-10).
- In phase `deck`, closing the panel returns the character to the street at `SPAWN_tower_exit`.
- **Who moves the phase:**
  - `loading` → `title`: WP-03, once `street` and `ash` have loaded.
  - `title` → `intro`: WP-07, when the visitor clicks Enter.
  - `intro` → `explore`: WP-06, when the intro camera move ends.
  - `explore` ↔ `deck`: WP-10.
- Movement input is accepted only in `explore`.

**Gameplay camera:** its parameters live in `art/layout.json` → `camera`, so Blender shots and the web camera share one source. Initial values: yaw locked toward the tower (looking along three −Z), `pitchDeg` 8 (looking down; WP-02 lowered it from 12 so the `start` shot shows the tower's top deck above the gate), `fovDeg` 50 (vertical), `behind` 11 m, `height` 4.5 m. WP-06 tunes them by editing that file.

### 6.5 Runtime and events (WP-01)

Data that changes every frame lives in a mutable singleton rather than the store, so it never triggers React re-renders.

```ts
// src/world/runtime.ts
export const runtime = {
  character: {
    position: new Vector3(), // three.js world space, written by WP-05 every frame
    yaw: 0,
    speed: 0, // m/s
    teleport: (_p: Vector3, _yaw: number) => {}, // replaced by WP-05
  },
  debug: { shot: null as string | null, freeze: false, stats: false }, // from the URL, set by WP-01
};
```

```ts
// src/world/events.ts: a small typed emitter (on/off/emit)
type WorldEvents = {
  interact: { id: InteractionId }; // flow → audio, flow's own animations
  arrive: { target: WalkTarget }; // character → flow
  footstep: Record<string, never>; // character → audio
  door: { open: boolean }; // flow → audio
  deck: { state: "enter" | "arrived" | "exit" }; // flow ↔ camera ↔ audio
  uiClick: Record<string, never>; // ui → audio
};
```

### 6.6 Scene registry (`src/world/scene/`, WP-03)

`useWorld()` returns the parsed contents of each model. Other packages read it and never search the scene graph themselves.

```ts
interface Registry {
  root: Group;
  spawn: { start: Pose; towerExit: Pose };            // Pose = { position: Vector3; yaw: number }
  zones: Record<'builds'|'about'|'sayhi'|'vending'|'bell'|'door', { position: Vector3; radius: number }>;
  stands: Record<SectionId | InteractionId, Pose>;
  labels: Record<SectionId | InteractionId, Vector3>;
  path: Vector3[];                                    // PATH_00..nn in order
  colliders: Mesh[];  walk: Mesh[];  puddles: Mesh[];
  lights: { position: Vector3; color: Color; intensity: number; distance: number }[];
  refl: { position: Vector3; color: Color; length: number }[];
  anim: Record<'bell'|'bell_striker'|'vending_can'|'konbini_door', Object3D>;
  sounds: Record<'vending_hum'|'konbini'|'bell', Vector3>;
  shots: Record<string, PerspectiveCamera>;
  sweep: Vector3[];
}
useWorld(): { street: Registry; deck: Pick<Registry, 'root'|'shots'|'lights'|'refl'> | null; character: { scene: Group; animations: AnimationClip[]; extras: { walkSpeed: number; footstepTimes: number[] } } }
```

### 6.7 Content schema (`src/content/types.ts`, WP-01; values in `site.ts`, WP-04)

```ts
type Lang = "en" | "ja";
type L<T = string> = Record<Lang, T>;
interface Link {
  label: L;
  href: string;
}
interface Build {
  id: "drone" | "gpt2" | "website";
  title: L;
  summary: L;
  body: L<string[]>;
  tags: string[];
  links: Link[];
  image?: { src: string; alt: L };
}
interface SiteContent {
  meta: { title: L; description: L };
  name: L; // JA spelling comes from Ash (§ 13)
  tagline: L;
  about: { title: L; paragraphs: L<string[]>; photo: { src: string; alt: L } };
  builds: { title: L; intro: L; items: Build[] };
  sayhi: {
    title: L;
    intro: L;
    links: (Link & { id: "github" | "linkedin" })[];
  };
  ui: {
    langToggle: L;
    soundOn: L;
    soundOff: L;
    classicView: L;
    worldView: L;
    skipToText: L;
    loading: L;
    enterWithSound: L;
    enterMuted: L;
    controlsHint: L;
    controlsHintTouch: L;
    interactKey: L;
    tapHint: L;
    interactVending: L;
    interactBell: L;
    drinks: L<string[]>;
    gotDrink: L; // gotDrink contains "{drink}"
    close: L;
    rideDown: L;
    slowToast: L;
    switchToClassic: L;
    dismiss: L;
    footerCredit: L;
  };
}
```

### 6.8 Palette and type

`art/palette.json` and `src/styles/tokens.css` both implement this table.

| Token        | Hex       | Use                                               |
| ------------ | --------- | ------------------------------------------------- |
| `night`      | `#0D1322` | Sky, fog, UI background                           |
| `dusk`       | `#1B2540` | Distant buildings, UI surfaces                    |
| `asphalt`    | `#2B303B` | Road                                              |
| `concrete`   | `#8C9099` | Sidewalks, walls                                  |
| `plaster`    | `#C9C3B6` | House walls                                       |
| `wood`       | `#6B4630` | Temple wood                                       |
| `vermilion`  | `#C23B22` | Gate and temple accents                           |
| `roof`       | `#3A3F4A` | Roof tiles                                        |
| `foliage`    | `#2E4A3B` | Trees, hedges                                     |
| `tower`      | `#FF4F00` | Tokyo Tower (international orange)                |
| `towerWhite` | `#F4F1EA` | Tower's white bands                               |
| `lamp`       | `#FFC27A` | Warm light; UI highlight and focus ring           |
| `vending`    | `#D6EEFF` | Cool white glow                                   |
| `mart`       | `#0A929B` | Konbini brand teal (the old site's primary color) |
| `ink`        | `#ECEFF5` | UI text                                           |
| `inkDim`     | `#9BA4B8` | Secondary UI text                                 |

- **UI type:** "M PLUS Rounded 1c" (Google Fonts, OFL), weights 400 and 700, for both Latin and Japanese.
- **Signage in the 3D world:** Noto Sans JP (OFL), baked into textures.
- **Brands:** all shop and product brands are fictional ("あさひマート", made-up drinks). Real places (Tokyo Tower, Zojoji) appear as places, never as logos.

### 6.9 Art modules (`art/`, framework by WP-02)

**Build targets.** `python art/build.py <target>` builds the target, bakes it where needed, exports it, optimizes it into `public/models/`, and validates the result.

| Target        | Built from                           | Before its art package merges            | Output                                                           |
| ------------- | ------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------- |
| `street`      | `art/scenes/street.py` (WP-15)       | Greybox built from `layout.json` (WP-02) | `street.glb`, `street-low.glb`                                   |
| `deck`        | `art/scenes/deck.py` (WP-14)         | Greybox (WP-02)                          | `deck.glb`, `deck-low.glb`                                       |
| `ash`         | `art/characters/ash.py` (WP-13)      | Placeholder rig (WP-02)                  | `ash.glb`                                                        |
| `prop:<name>` | `art/props/<name>.py` (WP-11, WP-12) | n/a                                      | Preview and validation only; WP-15 assembles props into `street` |

**Prop module.** One file per prop: `art/props/<name>.py` exposing `build(ctx) -> bpy.types.Collection`.

- **Origin and facing:** origin at the base center, front facing Blender −Y.
- **Mesh names:** `<name>_<part>`.
- **Materials:** only through `ctx` (palette materials `MAT_*`, `EMIT_*`, `DYN_*`, `GLASS_*`).
- **Colliders:** the prop includes its own `COL_<name>_*` boxes.
- **Named objects:** the prop builds the named `ANIM_*` objects it carries, and optional `REFL_*` anchors.
- **Randomness:** only `ctx.rng` (seeded), so builds are repeatable.

**`layout.json` is the only source of positions.**

- **Landmarks:** each entry names its prop, position, rotation and footprint. Under `empties` it gives the prop-relative offsets of its `ZONE_`, `STAND_`, `LABEL_` and `SND_` nodes (with radius and facing).
- **Street-level nodes:** it also holds `SPAWN_*`, `PATH_*`, `LIGHT_*`, the `CAM_shot_*` poses, the `CAM_sweep_*` path, and the `camera` block (§ 6.4).
- **Placement:** the assembler places all of these, so props never hard-code them.

**Which prop carries which named objects:**

| Prop          | Carries                          |
| ------------- | -------------------------------- |
| `vending_row` | `ANIM_vending_can`               |
| `konbini`     | `ANIM_konbini_door`              |
| `bell_tower`  | `ANIM_bell`, `ANIM_bell_striker` |

**Ownership hand-offs:** `art/layout.json` belongs to WP-02 until WP-02 merges, then to WP-15. Each `public/models/*.glb` belongs to WP-02 (greybox) until its art package (WP-13, WP-14 or WP-15) replaces it.

## 7. Budgets

| What                                                           | High tier                     | Low tier                                                             | How it's measured                         |
| -------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| Downloaded before **Enter** is enabled (JS + `street` + `ash`) | ≤ 10 MB                       | ≤ 6 MB                                                               | `npm run budget`                          |
| JS for world mode (compressed)                                 | ≤ 1.8 MB                      | same                                                                 | `npm run budget`                          |
| `street.glb` / `street-low.glb`                                | ≤ 5 MB                        | ≤ 2.5 MB                                                             | file size                                 |
| `ash.glb`                                                      | ≤ 0.8 MB                      | same                                                                 | file size                                 |
| `deck.glb` / `deck-low.glb` (prefetched after the gate)        | ≤ 2 MB                        | ≤ 1 MB                                                               | file size                                 |
| Audio (loaded after Enter)                                     | ≤ 1.5 MB total                | same                                                                 | file size                                 |
| Draw calls / triangles per frame                               | ≤ 150 / 400k                  | ≤ 90 / 200k                                                          | `window.__worldStats` with `?debug=stats` |
| Classic view page weight                                       | ≤ 400 KB, readable without JS | same                                                                 | `npm run budget`                          |
| Frame rate                                                     | 60 fps on a recent laptop     | ≥ 30 fps on a phone a few years old (around an iPhone 12 or Pixel 6) | Ash, on real devices, at review time      |

Containers render WebGL in software, so agents check draw calls, triangles and file sizes, never frame rate.

## 8. View mode and quality tiers

**View mode**, resolved in order:

1. A URL parameter `?view=classic|world`.
2. A saved choice: `localStorage['ash.view']`, written only when the visitor clicks "Classic view" or "Enter the 3D world". Wrap every storage access in try/catch.
3. Automatic detection. It picks **classic** when any of these is true:

   - WebGL2 is unavailable.
   - The renderer string reports a software renderer (SwiftShader, llvmpipe, "Software").
   - `navigator.connection.saveData` is true.
   - `hardwareConcurrency < 4` and `deviceMemory < 4` (when reported).

   Otherwise it picks **world**.

**Tier:**

- Automatic detection picks **low** when the primary pointer is coarse (`(pointer: coarse)`), `deviceMemory < 8`, or the screen's shorter side is under 700 CSS px. Otherwise it picks **high**.
- While running, `PerformanceMonitor` (WP-08) drops high → low when frame rate stays low, and low → a "slow" toast offering Classic view.
- A runtime drop only changes effects. Models aren't reloaded.

| Feature                        | High                                        | Low                                                 |
| ------------------------------ | ------------------------------------------- | --------------------------------------------------- |
| Device pixel ratio cap         | 2                                           | 1.5                                                 |
| Model files                    | `street.glb`, `deck.glb` (2048 px textures) | `street-low.glb`, `deck-low.glb` (1024 px textures) |
| Rain drops                     | about 8,000                                 | about 2,000                                         |
| Puddle reflections             | Real reflections on `PUDDLE_*`              | Baked gloss only                                    |
| Reflection streaks, bloom, fog | On                                          | On (bloom at lower resolution)                      |

## 9. Accessibility rules

- In world mode, the Classic content stays in the DOM, visually hidden and readable by screen readers. A "Skip to text version" link (`ui.skipToText`) is the first thing keyboard focus reaches.
- The canvas is `aria-hidden`. The menu, panels, buttons and toasts are real DOM controls you can reach and operate by keyboard, with visible focus rings in the `lamp` color.
- Panels are dialogs: focus moves in when they open, Esc closes them, and focus returns to where it was.
- With `prefers-reduced-motion`, camera moves become short crossfades, nothing bobs or shakes, and rain falls slower.
- Text contrast is at least 4.5:1 against its background.
- Every element containing text carries the right `lang` attribute.

## 10. Verification

These checks apply to every package. Each package's own file adds its specific acceptance checks.

- **`npm run check`**: type check, Prettier, and production build. It passes on every PR.
- **Shots** (`npm run shots`): a Playwright script that opens the dev or preview server and saves PNGs to `shots/` (gitignored).
  - `/?view=world&shot=<name>` puts the camera at `CAM_shot_<name>` and places the character at the matching stand.
  - **Freeze:** a shot also sets `runtime.debug.freeze`. While frozen, every package renders a still: animations at time 0, rain and randomness seeded, no camera smoothing. That makes shots repeatable.
  - **URL options:** `&panel=<id>` opens a panel, `&tier=high|low` forces a tier, `&debug=stats` writes `window.__worldStats` (`{calls, triangles}`).
  - **Script options:** `--viewport mobile` for 390×844 (the default is 1440×900).
  - **Debug handles:** any `debug` or `shot` parameter exposes `window.__world = { runtime, store }`, so scripts can drive the world. WP-03 sets `window.__worldReady = true` once the models are loaded and the shot is placed; the script waits for it.
  - Agents open the PNGs and compare them against their package's acceptance checks.
  - Headless Chromium renders WebGL in software. It is slow, and it may need `--enable-unsafe-swiftshader`. Automatic detection sends software renderers to Classic view, so always pass `view=world`.
- **`npm run budget`**: checks § 7 against the production build.
- **Art** (Python, `art/`):
  - `python art/build.py <target>` builds an asset deterministically.
  - `python art/validate.py <glb>` checks it against § 6.2 and § 7.
  - `python art/preview.py <target> --shot <name>` renders a Cycles preview PNG into `shots/art/`.
- **Review:** every PR gets a preview deployment, which Ash opens on a laptop and a phone. Netlify's deploy preview builds every commit. Vercel's preview may be blocked for commits not authored by Ash.

## 11. Workflow

- **Branches.** The integration branch is **`v2`**, created from `main` after this spec merges. Each package works on `wp-XX-<slug>`, branched from `v2`, and opens a PR into `v2` titled `WP-XX: <title>`. Ash reviews and merges. At launch, WP-16 merges `v2` into `main`.
- **Ownership.** A package edits only the paths its file lists under **Owns**, plus its own test scripts at `scripts/tests/wp-XX-*.mjs`. Reading anything is fine. Anything else it needs goes in the PR under **Requests for other packages**. The one exception: a package that needs a new npm dependency adds it in its own commit and says so in the PR. WP-01 installs the full stack up front so this stays rare.
- **PR body:**
  - what was built
  - which checks ran and their results
  - which shots were taken and what they show
  - any deviations from the spec
  - **Contract changes**, with the edits made to this file
- **Python environment for art packages:** Python 3.13 and `pip install -r art/requirements.txt` (which pins `bpy==5.2.3`, Blender as a Python module). There's no GPU, so Cycles renders and bakes on the CPU: use `--fast` while iterating and full quality for the final commit. Exported `.glb` files are committed, because Vercel never runs Blender.
- **Starting a package:** give the agent this prompt:

  > You're implementing WP-XX of the Tokyo Night Walk site in `kurokiasahi222/Ash-Kuroki-Personal-Website`. Read `CLAUDE.md`, `docs/spec/00-overview.md` and `docs/spec/wp-XX-*.md`. Branch from `v2` as `wp-XX-<slug>`, do the package, run its acceptance checks, and open a PR into `v2`.

## 12. Work packages

| WP  | Package                                                     | Depends on | Wave |
| --- | ----------------------------------------------------------- | ---------- | ---- |
| 01  | [Foundation](wp-01-foundation.md)                           | none       | 1    |
| 02  | [Art pipeline and greybox](wp-02-art-pipeline.md)           | none       | 1    |
| 03  | [Scene loader and dev viewer](wp-03-scene-loader.md)        | 01, 02     | 2    |
| 04  | [Content, EN + JA](wp-04-content.md)                        | 01         | 2    |
| 07  | [UI overlay](wp-07-ui.md)                                   | 01         | 2    |
| 11  | [Street props art](wp-11-street-props.md)                   | 02         | 2    |
| 12  | [Landmarks art: Tokyo Tower, Zojoji](wp-12-landmarks.md)    | 02         | 2    |
| 13  | [Character art](wp-13-character-art.md)                     | 02         | 2    |
| 14  | [Deck view art](wp-14-deck-art.md)                          | 02         | 2    |
| 05  | [Character controller](wp-05-character-controller.md)       | 03         | 3    |
| 06  | [Camera rig](wp-06-camera.md)                               | 03         | 3    |
| 08  | [Atmosphere: rain, reflections, bloom](wp-08-atmosphere.md) | 03         | 3    |
| 09  | [Audio](wp-09-audio.md)                                     | 03         | 3    |
| 15  | [Street assembly and bake](wp-15-street-assembly.md)        | 03, 11, 12 | 3    |
| 10  | [World flow and interactions](wp-10-world-flow.md)          | 05, 06, 07 | 4    |
| 16  | [Polish, audits and launch](wp-16-launch.md)                | all        | 5    |

Packages in the same wave can run in parallel. Within a wave, start any package whose dependencies are merged.

## 13. Inputs needed from Ash

- **Japanese name spelling** (kanji or kana) for `name.ja`. Agents must not guess it.
- **Proofreading** the Japanese copy in the WP-04 PR.
- **Drone Simulation:** confirm that featuring this UMN CSCI 3081 team project is fine under that course's sharing rules.
- **Footer credit:** keep or drop the default credit line "Previous version designed by Kayla Purney".
- **Real-device checks** of frame rate (§ 7) on each preview deployment that changes rendering.
