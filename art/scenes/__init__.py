"""Scene modules: `street.py` (WP-15) and `deck.py` (WP-14).

    def build(ctx) -> bpy.types.Collection

Assemble props with `ctx.build_prop(...)`, place every layout-owned contract node with
`lib.nodes.place_layout_nodes(ctx)`, add Blender lights for the bake, and register
static meshes with `ctx.atlas(name, objects, size)`. `build.py` then bakes, exports,
optimizes and validates. While a module is missing, `build.py` builds the greybox
from `art/lib/greybox/`. A street module may also define `wayfinding_tower()`
returning the tower's objects for the wayfinding check (default: the `tokyo_tower`
collection).
"""
