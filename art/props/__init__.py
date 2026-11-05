"""Prop modules (overview § 6.9): one file per prop, `art/props/<name>.py`.

    def build(ctx, **params) -> bpy.types.Collection

Rules:
  * Origin at the base center, front facing Blender -Y.
  * Mesh names `<name>_<part>`; materials only through ctx (MAT_, EMIT_, DYN_, GLASS_).
  * Own colliders as `COL_<name>_*` boxes; build the ANIM_* objects the prop carries
    (vending_row → ANIM_vending_can, konbini → ANIM_konbini_door,
    bell_tower → ANIM_bell + ANIM_bell_striker with extras.swingAxis) and optional REFL_*.
  * No SPAWN_/ZONE_/STAND_/LABEL_/PATH_/LIGHT_/SND_/CAM_ nodes: the assembler places those
    from layout.json.
  * Randomness only through ctx.rng.
  * Optional `MAX_TRIS = <cap>` is used by `build.py prop:<name>` when --max-tris isn't given.

Build and check one with `python art/build.py prop:<name>` and `python art/preview.py prop:<name>`.
"""
