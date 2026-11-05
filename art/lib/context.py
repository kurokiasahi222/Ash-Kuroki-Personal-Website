"""`BuildContext`: the one object every art module receives (overview § 6.9).

    def build(ctx) -> bpy.types.Collection:
        body = ctx.geo.rounded_box((1.0, 0.8, 1.85), mat=ctx.mat("plaster"), name="vending_row_body")
        ctx.geo.rounded_box((0.9, 0.05, 1.2), mat=ctx.emit("vending", 3), location=(0, -0.42, 0.5))
        ctx.text_jp("つめた〜い", 0.06, mat=ctx.emit("vending", 3, name="label"), location=(0, -0.45, 0.4))
        ctx.empty("REFL_vending_row", (0, -0.5, 0), color="#D6EEFF", length=3.0)
        x = ctx.rng.uniform(-0.1, 0.1)          # the only randomness allowed
        return ctx.collection

What it offers:
    ctx.mat / emit / dyn / glass    palette materials (lib/materials.py)
    ctx.geo                         geometry helpers (lib/geo.py)
    ctx.text_jp                     Noto Sans JP text meshes (lib/text.py)
    ctx.empty(name, loc, rot, **extras)   empties whose custom properties export as glTF extras
    ctx.rng                         random.Random seeded per module name
    ctx.collection                  where new objects go; return it from build()
    ctx.layout                      the parsed art/layout.json (lib/layout.Layout)
    ctx.build_prop(name, ...)       build art/props/<name>.py into this scene (for assemblers)
    ctx.atlas(name, objects)        register static meshes for baking into BAKED_<name>
    ctx.fast                        True with --fast: keep things cheap
"""

import importlib
import math
import random

import bpy
from mathutils import Matrix, Vector

from . import contract, geo, scene
from . import palette as pal
from .materials import MaterialLibrary
from .text import text_jp as _text_jp

SEED_BASE = "tokyo-night-walk"


class BuildContext:
    def __init__(self, name, *, fast=False, palette=None, materials=None, collection=None, seed=None,
                 layout=None, atlases=None, parent=None):
        self.name = name
        self.fast = fast
        self.palette = palette or pal.load()
        self.materials = materials or MaterialLibrary(self.palette)
        self.rng = random.Random(f"{SEED_BASE}:{seed or name}")
        self.collection = collection or scene.new_collection(name)
        self.geo = geo.Geo(self)
        self.atlases = atlases if atlases is not None else {}
        self._layout = layout
        self._parent = parent
        self._counters = {}

    # ---- naming --------------------------------------------------------------

    def auto_name(self, kind):
        n = self._counters.get(kind, 0)
        self._counters[kind] = n + 1
        return f"{self.name}_{kind}{n:02d}"

    # ---- materials -----------------------------------------------------------

    def mat(self, token, **kw):
        return self.materials.mat(token, **kw)

    def emit(self, token, strength=3.0, **kw):
        return self.materials.emit(token, strength, **kw)

    def dyn(self, token, **kw):
        return self.materials.dyn(token, **kw)

    def glass(self, tint, alpha=0.3, **kw):
        return self.materials.glass(tint, alpha, **kw)

    def color(self, token_or_hex):
        return pal.resolve(self.palette, token_or_hex)

    # ---- text and empties ----------------------------------------------------

    def text_jp(self, string, size, **kw):
        return _text_jp(self, string, size, **kw)

    def empty(self, name, location=(0, 0, 0), rotation_deg=0, *, collection=None, parent=None, display_size=0.3,
              unique=False, **extras):
        """An empty whose custom properties export as glTF `extras`.

        Contract names (§ 6.2) are checked here, so a bad `extras` fails at build time:
            ctx.empty("ZONE_bell", (0, -4, 0), radius=2.6)
            ctx.empty("LIGHT_gate", (0, 45, 3.4), color="#FFC27A", intensity=10, distance=12)

        A prop placed twice gets 'REFL_x' and 'REFL_x.001' (made 'REFL_x_001' on export).
        `unique=True` makes a clash an error instead (layout-owned nodes use it).
        """
        errors = contract.extras_errors(name, extras)
        if errors:
            raise ValueError("; ".join(errors))
        obj = bpy.data.objects.new(name, None)
        obj.empty_display_type = "SINGLE_ARROW" if name.startswith(("STAND_", "SPAWN_")) else "PLAIN_AXES"
        obj.empty_display_size = display_size
        obj.location = Vector(location)
        obj.rotation_euler = [math.radians(v) for v in geo.euler_deg(rotation_deg)]
        for key, value in extras.items():
            obj[key] = value
        (collection or self.collection).objects.link(obj)
        if parent is not None:
            obj.parent = parent
        if unique and obj.name != name:
            raise ValueError(f"an object named {name} already exists (got {obj.name})")
        return obj

    # ---- layout ----------------------------------------------------------------

    @property
    def layout(self):
        if self._layout is None:
            from .layout import Layout

            self._layout = Layout.load()
        return self._layout

    # ---- composition -----------------------------------------------------------

    def child(self, name, *, seed=None, collection=None):
        """A context for a sub-module, sharing materials, atlases and settings."""
        coll = collection or scene.new_collection(name, self.collection)
        return BuildContext(name, fast=self.fast, palette=self.palette, materials=self.materials, collection=coll,
                            seed=seed, layout=self._layout, atlases=self.atlases, parent=self)

    def build_prop(self, name, *, location=(0, 0, 0), rotation_deg=0, seed=None, instance=None, **params):
        """Build `art/props/<name>.py` and place it. Returns the prop's collection.

        `seed` varies seeded props between placements (default: the prop name,
        plus `instance` when given). Extra keyword arguments go to `build()`.
        """
        module = importlib.import_module(f"props.{name}")
        coll_name = name if instance is None else f"{name}_{instance}"
        sub = self.child(coll_name, seed=seed or coll_name)
        result = module.build(sub, **params)
        if not isinstance(result, bpy.types.Collection):
            raise TypeError(f"props/{name}.py build() must return a bpy.types.Collection, got {type(result)}")
        m = geo.matrix_from(location, rotation_deg)
        bpy.context.view_layer.update()  # matrix_world is stale until the depsgraph updates
        members = set(result.all_objects)
        for obj in result.all_objects:
            if obj.parent is None or obj.parent not in members:
                obj.matrix_world = m @ obj.matrix_world
        return result

    def atlas(self, name, objects, size=None):
        """Bake these static meshes into `BAKED_<name>` (lib/bake.py runs after build).

        `size` is the atlas resolution in px (default 2048; `--fast` bakes a quarter of it).
        """
        entry = self.atlases.setdefault(name, {"objects": [], "size": 2048})
        if size is not None:
            entry["size"] = size
        for obj in objects:
            if obj not in entry["objects"]:
                entry["objects"].append(obj)

    def transform(self, location=(0, 0, 0), rotation_deg=0, scale=(1, 1, 1)) -> Matrix:
        return geo.matrix_from(location, rotation_deg, scale)
