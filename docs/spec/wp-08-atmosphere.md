# WP-08: Atmosphere (rain, reflections, bloom)

**Depends on:** WP-03 · **Branch:** `wp-08-atmosphere` · **Wave:** 3
**Owns:** `src/world/fx/**`

## Goal

Make the night wet and glowing: falling rain, ripples, light streaks on the asphalt, real puddle reflections on the high tier, fog and bloom. Watch frame rate and step quality down when needed. This package does half the work of "cozy", so tune it with shots until it feels like a Felix Rieseberg night.

## Steps

1. **Rain.**
   - Instanced thin streaks (stretched quads, additive, color `vending` at about 35% opacity) inside a box about 30 × 20 × 30 m that follows the camera.
   - A slight wind slant, with a fall speed of about 9 m/s (5 m/s with reduced motion).
   - Count per tier from overview § 8. Seeded, and static while frozen.
   - Done when rain reads clearly in front of lit surfaces and disappears against the sky.
2. **Ripples.** About 120 instanced expanding rings on `WALK_` ground near the camera, each lasting 0.6–1.0 s at random positions (seeded). Half the count on low.
3. **Reflection streaks.**
   - At each `registry.refl` anchor and below each `registry.lights` entry, draw an additive glow quad lying on the ground, stretched toward the camera (its `length`), tinted with the anchor's color, with a subtle shimmer.
   - This is the main wet-street effect, on every tier.
   - Done when the `konbini` and `vending` shots show colored streaks under the signs.
4. **Puddles.** High tier only: give `registry.puddles` meshes drei's `MeshReflectorMaterial` (resolution 512, blur, mixed with the baked look). The low tier keeps the baked surface.
5. **Fog and bloom.**
   - Exponential fog in `night`, tuned so the far end of the street fades but the tower stays crisp.
   - An `EffectComposer` with mipmap-blur bloom, its threshold set so only `EMIT_` materials bloom, at half resolution on low.
   - **Put AgX tone mapping last in the effect chain** (`<ToneMapping>`), so colors still match `art/preview.py`.
6. **Deck phase.** Inside the deck there are no rain particles or ripples. Keep the fog (lighter) and the bloom.
7. **Quality.** drei `PerformanceMonitor`:
   - On sustained low frame rate, high → `setTier('low')`, which applies § 8's low column live (no model reload) and lowers the DPR.
   - On low, sustained under 24 fps for 5 s → `showToast({kind:'slow', text: content.ui.slowToast[lang]})`, once per visit.

## Acceptance

- [ ] `npm run check` passes.
- [ ] Shots `start`, `vending`, `konbini`, `tower-base` and `deck`, each with `&tier=high` and `&tier=low`, frozen and repeatable (two runs give identical PNGs).
- [ ] With `?debug=stats`, effects add at most 20 draw calls on high and at most 10 on low. The totals stay within § 7.
- [ ] Forcing low frame rate in a test (stub the monitor callback) drops the tier, then shows the toast.
- [ ] With reduced motion, rain is slower and nothing else animates the camera.
