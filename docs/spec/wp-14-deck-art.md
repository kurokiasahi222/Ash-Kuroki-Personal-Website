# WP-14: Deck view art

**Depends on:** WP-02 · **Branch:** `wp-14-deck-art` · **Wave:** 2
**Owns:** `art/scenes/deck.py`, `public/models/deck.glb`, `public/models/deck-low.glb`

## Goal

The finale: from inside Tokyo Tower's main deck, rainy windows looking out over Tokyo at night. It is seen only through `CAM_shot_deck`, with the Say hi panel over the right-hand side, so build what that camera sees and nothing else.

## Steps

1. **Interior slice.**
   - A short stretch of the deck: outward-leaning window panes in white or grey frames, a floor, a railing, and a bench silhouette in the foreground.
   - Raindrops and streaks on the glass: a `GLASS_` layer whose alpha comes from a texture generated in code, seeded.
   - Baked with `lib/bake.py`, with a warm, dim interior and the city as the main light source.
2. **City.**
   - Low-poly instanced blocks stretching to the horizon, denser near Shiba and Minato in the foreground.
   - `EMIT_` window textures: one generated atlas of lit and unlit window patterns.
   - Red aviation lights on the taller blocks, and the glow of streets between them.
   - In the distance, a slender, glowing Tokyo Skytree, so visitors can tell it's Tokyo.
   - Done when the deck shot reads as "Tokyo at night from above".
3. **Camera.** Place `CAM_shot_deck` looking out through the windows. Keep the left two-thirds visually rich, since the panel covers the right on desktop, and make the center work on mobile.
4. **Build and check** with `python art/build.py deck`, `preview.py deck --shot deck`, and the browser shot `/?view=world&shot=deck` at both tiers and both viewports.

## Acceptance

- [ ] `validate.py` passes on `deck.glb` and `deck-low.glb`: at most 2 MB and at most 1 MB.
- [ ] In the PR: preview and browser shots at both tiers and viewports, plus one with `&panel=sayhi`.
- [ ] Draw calls with `?shot=deck&debug=stats` are within § 7.
