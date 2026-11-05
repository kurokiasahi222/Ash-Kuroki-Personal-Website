"""Greybox `street`, built from `art/layout.json` (WP-02 step 8).

Palette-colored rounded boxes for every footprint and side building, stepped
tapering boxes for the tower, every contract node (§ 6.2) including ANIM_
stand-ins, COL_ boxes per footprint plus the perimeter, WALK_ surfaces, puddles,
and EMIT_ lamps, vending fronts, signage and tower lights so bloom can be tested.
WP-15's `art/scenes/street.py` replaces it, keeping the node set.
"""

import math

import bpy
from mathutils import Matrix, Vector

from .. import nodes, scene
from ..geo import matrix_from
from ..layout import rotate_z


def _apply(objs, m):
    bpy.context.view_layer.update()  # matrix_world is stale until the depsgraph updates
    group = set(objs)
    for o in objs:
        if o.parent is None or o.parent not in group:
            o.matrix_world = m @ o.matrix_world


def _hide(obj):
    obj.hide_render = True
    obj.hide_viewport = True
    obj.display_type = "WIRE"
    return obj


class Kit:
    """Builds parts in a local frame (front facing -Y), then places them."""

    def __init__(self, ctx, name, location=(0, 0, 0), rotation=0.0):
        self.ctx = ctx.child(name)
        self.g = self.ctx.geo
        self.parts = []
        self.colliders = []
        self.m = matrix_from(location, rotation)

    def add(self, obj):
        self.parts.append(obj)
        return obj

    def box(self, size, at, mat, bevel=0.02, **kw):
        return self.add(self.g.rounded_box(size, bevel, mat=mat, location=at, **kw))

    def col(self, name, size, at=(0, 0, 0), rotation=0):
        obj = self.g.box(size, name=f"COL_{name}", location=at, rotation_deg=rotation)
        self.colliders.append(_hide(obj))
        return obj

    def empty(self, name, at, rotation=0, **extras):
        return self.add(self.ctx.empty(name, at, rotation, **extras))

    def done(self):
        _apply(self.parts + self.colliders, self.m)
        return [p for p in self.parts if p.type == "MESH" and not p.name.startswith(("ANIM_", "PUDDLE_"))]


# ---- landmarks ------------------------------------------------------------------


def vending_row(ctx, lm):
    k = Kit(ctx, "vending_row", lm["position"], lm["rotation"])
    c = k.ctx
    w, d = lm["footprint"]
    h = lm["height"]
    for i, x in enumerate((-1.07, 0.0, 1.07)):
        k.box((1.0, d, h), (x, 0, 0), c.mat("towerWhite"), 0.03, name=f"vending_row_body{i}")
        k.box((0.82, 0.04, 0.95), (x, -d / 2 - 0.01, 0.72), c.emit("vending", 3.0), 0.01,
              name=f"vending_row_front{i}")
        k.box((0.36, 0.03, 0.05), (x - 0.2, -d / 2 - 0.015, 0.6), c.mat("vermilion"), 0.0,
              name=f"vending_row_hot{i}")
        k.box((0.36, 0.03, 0.05), (x + 0.2, -d / 2 - 0.015, 0.6), c.mat("mart"), 0.0, name=f"vending_row_cold{i}")
        k.box((0.5, 0.06, 0.16), (x, -d / 2 - 0.02, 0.18), c.mat("roof"), 0.01, name=f"vending_row_tray{i}")
    for name, spec in lm["greybox"]["anim"].items():
        sx, sy, sz = spec["size"]
        k.add(k.g.cylinder(sx / 2, sz, verts=12, mat=c.dyn("vermilion"), name=name, location=spec["offset"]))
    for name, spec in lm["greybox"]["refl"].items():
        k.empty(name, spec["offset"], color=spec["color"], length=spec["length"])
    k.col("vending", (w, d, 2.0))
    return k.done()


def konbini(ctx, lm):
    k = Kit(ctx, "konbini", lm["position"], lm["rotation"])
    c = k.ctx
    w, d = lm["footprint"]
    h = lm["height"]
    gb = lm["greybox"]
    white = c.mat("towerWhite")
    front = -d / 2
    recess = 0.8
    k.box((w, d - recess, h), (0, recess / 2, 0), white, 0.05, name="konbini_body")
    k.box((w + 0.3, d + 0.3, 0.25), (0, 0, h), c.mat("concrete"), name="konbini_roof")
    for sx in (-1, 1):
        k.box((0.3, recess, h - 1.1), (sx * (w / 2 - 0.15), front + recess / 2, 0), white, name=f"konbini_pillar{sx:+d}")
    k.box((w, recess, 1.1), (0, front + recess / 2, h - 1.1), white, name="konbini_header")
    k.box((w - 0.6, 0.05, h - 1.1), (0, front + recess - 0.03, 0), c.emit("vending", 2.5, name="konbini_interior"),
          0.0, name="konbini_interior")
    k.box((4.2, 0.4, 0.08), (-1.5, front + 0.45, 0.95), c.mat("wood"), 0.0, name="konbini_shelf")
    for i, p in enumerate(gb["products"]):
        k.box((0.3, 0.22, 0.42), p["offset"], c.emit(p["color"], 4.0, name=f"product_{p['color']}"), 0.02,
              name=f"konbini_product{i}")
    k.box((6.6, 0.03, 2.8), (-1.5, front, 0.05), c.glass("vending", 0.22, name="shop"), 0.0, name="konbini_window")
    k.box((w - 0.4, 0.12, 0.7), (0, front - 0.06, h - 0.9), c.emit("mart", 3.0), 0.02, name="konbini_sign")
    k.box((0.12, d - 1.2, 0.7), (-w / 2 - 0.06, recess / 2, h - 0.9), c.emit("mart", 3.0), 0.02,
          name="konbini_side_sign")  # the corner facade, seen down the street
    k.add(c.text_jp(gb["sign"], 0.46, mat=c.emit("towerWhite", 3.0, name="sign_text"), name="konbini_sign_text",
                    location=(0, front - 0.125, h - 0.78)))
    for name, spec in gb["anim"].items():  # ANIM_konbini_door: pivot at the closed position, slides +X
        dw, dd, dh = spec["size"]
        frame = c.dyn("towerWhite")
        parts = [k.g.box((dw - 0.1, dd / 2, dh - 0.1), mat=c.glass("vending", 0.3, name="door"), location=(0, 0, 0.05),
                         name=name)]
        parts += [k.g.box((dw, dd, 0.06), mat=frame, location=(0, 0, z)) for z in (0.0, dh - 0.06)]
        parts += [k.g.box((0.06, dd, dh), mat=frame, location=(x, 0, 0)) for x in (-dw / 2 + 0.03, dw / 2 - 0.03)]
        door = k.g.join(parts, name, origin=(0, 0, 0))
        door.location = spec["offset"]
        k.add(door)
    for name, spec in gb["refl"].items():
        k.empty(name, spec["offset"], color=spec["color"], length=spec["length"])
    k.col("konbini", (w, d, 3.0))
    return k.done()


def gate(ctx, lm):
    k = Kit(ctx, "sangedatsumon_gate", lm["position"], lm["rotation"])
    c = k.ctx
    w, d = lm["footprint"]
    gb = lm["greybox"]
    p = gb["passage"]
    verm, roof, plaster, wood = c.mat("vermilion"), c.mat("roof"), c.mat("plaster"), c.mat("wood")
    k.box((w + 0.6, d + 0.6, 0.12), (0, 0, 0), c.mat("concrete"), name="gate_base")
    bay = (w / 2 - p / 2)
    for sx in (-1, 1):
        k.box((bay - 0.4, 0.5, 4.4), (sx * (p / 2 + bay / 2), 0, 0.12), plaster, name=f"gate_infill{sx:+d}")
        for x in (p / 2 + 0.35, p / 2 + bay / 2, w / 2 - 0.35):
            for y in (-d / 2 + 0.6, d / 2 - 0.6):
                k.box((0.7, 0.7, 4.7), (sx * x, y, 0.12), verm, 0.04)
    for y in (-d / 2 + 0.6, d / 2 - 0.6):
        k.box((p + 1.4, 0.6, 0.55), (0, y, 4.3), verm, name="gate_lintel")
    k.box((w + 2.0, d + 2.0, 0.7), (0, 0, 4.85), roof, 0.1, name="gate_roof_low")
    k.box((w - 5.0, d - 2.4, 3.0), (0, 0, 5.55), verm, 0.04, name="gate_upper")
    for y in (-(d - 2.4) / 2 - 0.02, (d - 2.4) / 2 + 0.02):
        k.box((w - 6.0, 0.05, 1.4), (0, y, 6.3), plaster, 0.0, name="gate_upper_panel")
    k.box((w + 1.0, d + 1.0, 0.75), (0, 0, 8.55), roof, 0.1, name="gate_roof_high")
    hip = k.add(k.g.lathe([(math.sqrt(2), 0.0), (0.35 * math.sqrt(2), 1.6), (0.0, 1.65)], segments=4,
                          start_deg=45, smooth=False, mat=roof, name="gate_roof_hip", location=(0, 0, 9.3)))
    hip.scale = (w / 2, d / 2 + 0.2, 1.0)
    k.box((6.5, 0.6, 0.5), (0, 0, 10.75), roof, name="gate_ridge")
    for sign in (-1, 1):  # upturned eave trims along the front and back: ctx.geo.sweep
        y = sign * (d / 2 + 1.0)
        curve = [(x, y, 5.55 + 0.6 * (abs(x) / (w / 2 + 1.0)) ** 3) for x in
                 [-(w / 2 + 1.0) + i * (w + 2.0) / 12 for i in range(13)]]
        k.add(k.g.sweep(curve, [(-0.18, -0.12), (0.18, -0.12), (0.18, 0.12), (-0.18, 0.12)], mat=roof,
                        name=f"gate_eave{sign:+d}"))
    k.box((1.6, 0.14, 0.9), (0, -(d - 2.4) / 2 - 0.08, 6.35), wood, name="gate_plaque")
    for i, at in enumerate(gb["lanterns"]):
        k.add(k.g.cylinder(0.32, 0.8, verts=10, mat=c.emit("lamp", 3.0, name="lantern"), name=f"gate_lantern{i}",
                           location=at))
    for name, spec in gb["refl"].items():
        k.empty(name, spec["offset"], color=spec["color"], length=spec["length"])
    for sx, side in ((-1, "l"), (1, "r")):
        k.col(f"gate_{side}", (bay, d, 4.5), (sx * (p / 2 + bay / 2), 0, 0))
    return k.done()


def bell_tower(ctx, lm):
    k = Kit(ctx, "bell_tower", lm["position"], lm["rotation"])
    c = k.ctx
    w, d = lm["footprint"]
    wood = c.mat("wood")
    k.box((w, d, 0.7), (0, 0, 0), c.mat("concrete"), 0.05, name="bell_tower_base")
    for sx in (-1, 1):
        for sy in (-1, 1):
            k.box((0.3, 0.3, 3.6), (sx * (w / 2 - 0.6), sy * (d / 2 - 0.6), 0.7), wood, name="bell_tower_post")
    for sy in (-1, 1):
        k.box((w - 0.8, 0.3, 0.3), (0, sy * (d / 2 - 0.6), 4.3), wood, name="bell_tower_beam")
    k.box((0.3, d - 0.8, 0.3), (0, 0, 4.3), wood, name="bell_tower_crossbeam")
    k.add(k.g.lathe([(4.2, 0.0), (0.7, 1.5), (0.0, 1.6)], segments=4, start_deg=45, smooth=False,
                    mat=c.mat("roof"), name="bell_tower_roof", location=(0, 0, 4.6)))
    anim = lm["greybox"]["anim"]
    spec = anim["ANIM_bell"]
    bell = k.g.lathe([(0.0, 0.0), (0.1, 0.0), (0.1, -0.1), (0.32, -0.18), (0.38, -0.55), (0.46, -0.95),
                      (0.46, -1.0), (0.0, -1.0)], segments=16, mat=c.dyn("roof", name="bronze", metallic=0.6),
                     name="ANIM_bell", location=spec["offset"])
    bell["swingAxis"] = spec["swingAxis"]
    k.add(bell)
    spec = anim["ANIM_bell_striker"]
    sx, sy, sz = spec["size"]
    parts = [k.g.rounded_box((sx, sy, sz), 0.03, origin="center", mat=c.dyn("wood"), name="ANIM_bell_striker",
                             location=(0, 0, -0.6))]
    parts += [k.g.box((0.03, 0.03, 0.48), mat=c.dyn("plaster", name="rope"), location=(0, y, -0.48))
              for y in (-0.45, 0.45)]
    striker = k.g.join(parts, "ANIM_bell_striker", origin=(0, 0, 0))  # pivot: the ropes' top
    striker.location = spec["offset"]
    striker["swingAxis"] = spec["swingAxis"]
    k.add(striker)
    k.col("bell_tower", (w, d, 3.0))
    return k.done()


def tokyo_tower(ctx, lm):
    k = Kit(ctx, "tokyo_tower", lm["position"], lm["rotation"])
    c = k.ctx
    H = lm["height"]
    pw, pd, ph = lm["greybox"]["podium"]
    orange, white = c.mat("tower"), c.mat("towerWhite")
    glow, glow_white = c.emit("tower", 2.5), c.emit("towerWhite", 2.0)
    window = c.emit("lamp", 3.0, name="deck_window")
    k.box((pw, pd, ph), (0, 0, 0), c.mat("concrete"), 0.08, name="tower_podium")
    k.box((pw + 0.4, pd + 0.4, 0.3), (0, 0, ph), c.mat("roof"), name="tower_podium_roof")
    k.box((3.4, 0.06, 2.6), (0, -pd / 2 - 0.03, 0.1), c.emit("lamp", 3.0, name="entrance"), 0.0,
          name="tower_entrance")
    k.box((pw - 2.0, 0.05, 0.6), (0, -pd / 2 - 0.03, 3.4), c.emit("lamp", 2.5, name="window"), 0.0,
          name="tower_podium_windows")

    def half(z):  # half-width of the stylized tower at height z
        return 3.4 - 2.1 * (z - 0.31 * H) / (0.70 * H - 0.31 * H)

    def frustum(z0, z1, mat, name, w0=None, w1=None):
        r0 = (w0 if w0 is not None else half(z0)) * math.sqrt(2)
        r1 = (w1 if w1 is not None else half(z1)) * math.sqrt(2)
        return k.add(k.g.lathe([(0.0, 0.0), (r0, 0.0), (r1, z1 - z0), (0.0, z1 - z0)], segments=4, start_deg=45,
                               smooth=False, mat=mat, name=name, location=(0, 0, z0)))

    b, t, s, top = 0.15 * H, 0.058 * H, 0.035 * H, 0.31 * H
    square = [(-s / 2, -s / 2), (s / 2, -s / 2), (s / 2, s / 2), (-s / 2, s / 2)]
    strip = [(-0.15, -0.15), (0.15, -0.15), (0.15, 0.15), (-0.15, 0.15)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            k.add(k.g.sweep([(sx * b, sy * b, ph - 0.3), (sx * t, sy * t, top)], square, mat=orange,
                            name="tower_leg"))
            k.add(k.g.sweep([(sx * (b + s * 0.55), sy * (b + s * 0.55), ph),
                             (sx * (t + s * 0.55), sy * (t + s * 0.55), top)], strip,
                            mat=c.emit("tower", 3.0, name="tower_glow"), name="tower_leg_light"))
    frustum(top, 0.40 * H, orange, "tower_body")
    k.box((8.4, 8.4, 0.05 * H), (0, 0, 0.40 * H), white, 0.05, name="tower_main_deck")
    k.box((8.5, 8.5, 0.022 * H), (0, 0, 0.41 * H), window, 0.0, name="tower_main_deck_windows")
    bands = 5
    z0 = 0.45 * H
    step = (0.70 * H - z0) / bands
    for i in range(bands):
        frustum(z0 + i * step, z0 + (i + 1) * step, glow if i % 2 == 0 else glow_white, f"tower_band{i}",
                w0=half(z0 + i * step), w1=half(z0 + (i + 1) * step))
    k.box((3.4, 3.4, 0.035 * H), (0, 0, 0.70 * H), white, 0.04, name="tower_top_deck")
    k.box((3.5, 3.5, 0.015 * H), (0, 0, 0.71 * H), window, 0.0, name="tower_top_deck_windows")
    z0, z1 = 0.735 * H, 0.84 * H
    mid = (z0 + z1) / 2
    frustum(z0, mid, glow, "tower_spire0", w0=1.2, w1=0.95)
    frustum(mid, z1, glow_white, "tower_spire1", w0=0.95, w1=0.7)
    k.add(k.g.cylinder(0.25, H - z1, radius_top=0.08, verts=8, mat=glow_white, name="tower_antenna",
                       location=(0, 0, z1)))
    k.add(k.g.sphere(0.3, segments=8, rings=4, mat=c.emit("vermilion", 5.0, name="beacon"), name="tower_beacon",
                     location=(0, 0, H)))
    for name, spec in lm["greybox"]["refl"].items():
        k.empty(name, spec["offset"], color=spec["color"], length=spec["length"])
    k.col("tower_podium", (pw, pd, ph))
    return k.done()


LANDMARK_KITS = {
    "vending_row": vending_row,
    "konbini": konbini,
    "sangedatsumon_gate": gate,
    "bell_tower": bell_tower,
    "tokyo_tower": tokyo_tower,
}


# ---- small props ------------------------------------------------------------------


def streetlight(ctx, i, spec):
    k = Kit(ctx, f"streetlight_{i}", spec["position"], spec["rotation"])
    c = k.ctx
    k.add(k.g.cylinder(0.07, 5.3, verts=8, mat=c.mat("roof"), name=f"streetlight_{i}_pole"))
    k.box((0.08, 0.95, 0.08), (0, -0.45, 5.15), c.mat("roof"), 0.0, name=f"streetlight_{i}_arm")
    k.box((0.3, 0.45, 0.12), (0, -0.85, 5.0), c.emit("lamp", 4.0), 0.02, name=f"streetlight_{i}_head")
    k.empty(f"REFL_streetlight_{i}", (0, -0.85, 0), color=ctx.color("lamp"), length=5)
    k.col(f"streetlight_{i}", (0.3, 0.3, 3.0))
    return k.done()


def stone_lantern(ctx, i, spec):
    k = Kit(ctx, f"stone_lantern_{i}", spec["position"], spec["rotation"])
    c = k.ctx
    stone = c.mat("concrete")
    k.box((0.7, 0.7, 0.25), (0, 0, 0), stone, name=f"stone_lantern_{i}_base")
    k.box((0.3, 0.3, 0.55), (0, 0, 0.25), stone, name=f"stone_lantern_{i}_post")
    k.box((0.5, 0.5, 0.4), (0, 0, 0.8), c.emit("lamp", 3.0, name="lantern"), 0.03, name=f"stone_lantern_{i}_light")
    k.add(k.g.lathe([(0.6, 0.0), (0.1, 0.3), (0.0, 0.32)], segments=4, start_deg=45, smooth=False, mat=stone,
                    name=f"stone_lantern_{i}_cap", location=(0, 0, 1.2)))
    k.col(f"stone_lantern_{i}", (0.7, 0.7, 1.6))
    return k.done()


def controls_sign(ctx, i, spec):
    k = Kit(ctx, "controls_sign", spec["position"], spec["rotation"])
    c = k.ctx
    k.box((0.08, 0.08, 0.78), (0, 0, 0), c.mat("roof"), 0.0, name="controls_sign_post")
    k.box((0.95, 0.08, 0.62), (0, 0, 0.75), c.mat("dusk"), 0.02, name="controls_sign_board")
    k.box((0.85, 0.02, 0.52), (0, -0.05, 0.8), c.emit("vending", 2.0, name="sign_face"), 0.0,
          name="controls_sign_face")
    ink = c.mat("night")
    k.add(c.text_jp("W A S D", 0.13, mat=ink, name="controls_sign_keys", location=(0, -0.065, 1.12)))
    k.add(c.text_jp("← ↑ ↓ →", 0.13, mat=ink, name="controls_sign_arrows", location=(0, -0.065, 0.92)))
    k.col("controls_sign", (0.95, 0.2, 1.4))
    return k.done()


# ---- buildings, ground, backdrop -------------------------------------------------------


def building(ctx, spec):
    k = Kit(ctx, f"building_{spec['id']}", spec["position"], spec["rotation"])
    c = k.ctx
    w, d = spec["footprint"]
    h = spec["height"]
    kind = spec["kind"]
    body = {"house": "plaster", "shop": "concrete", "apartment": "concrete" if c.rng.random() < 0.5 else "plaster"}
    k.box((w, d, h), (0, 0, 0), c.mat(body[kind]), 0.04, name=f"building_{spec['id']}_body")
    if kind == "house":
        roof = k.add(k.g.lathe([(math.sqrt(2), 0.0), (0.3 * math.sqrt(2), 1.6), (0.0, 1.65)], segments=4,
                               start_deg=45, smooth=False, mat=c.mat("roof"), name=f"building_{spec['id']}_roof",
                               location=(0, 0, h)))
        roof.scale = (w / 2 + 0.4, d / 2 + 0.4, 1.0)
    else:
        k.box((w + 0.3, d + 0.3, 0.3), (0, 0, h), c.mat("roof"), name=f"building_{spec['id']}_roof")
    lit, dark = c.emit("lamp", 2.5, name="window"), c.mat("dusk")
    floors = max(1, int(h // 3))
    cols = max(1, int(w // 2.4))
    first = 1 if kind == "shop" else 0
    for f in range(first, floors):
        for col in range(cols):
            x = -w / 2 + (col + 0.5) * w / cols
            on = c.rng.random() < 0.35
            k.box((0.9, 0.05, 1.1), (x, -d / 2 - 0.02, 1.0 + f * 3.0), lit if on else dark, 0.0)
    if kind == "shop":
        k.box((w - 1.2, 0.06, 2.4), (0, -d / 2 - 0.03, 0), c.mat("roof"), 0.0, name=f"building_{spec['id']}_shutter")
        k.box((w - 1.4, 0.08, 0.45), (0, -d / 2 - 0.04, 2.6), c.emit("lamp", 2.0, name="shop_sign"), 0.0,
              name=f"building_{spec['id']}_sign")
    k.col(f"building_{spec['id']}", (w, d, 3.0))
    return k.done()


def walls(ctx, specs):
    k = Kit(ctx, "temple_walls")
    c = k.ctx
    for i, s in enumerate(specs):
        (x0, y0), (x1, y1) = s["from"], s["to"]
        length = math.hypot(x1 - x0, y1 - y0)
        mid = ((x0 + x1) / 2, (y0 + y1) / 2, 0)
        rot = math.degrees(math.atan2(y1 - y0, x1 - x0))
        t, h = s["thickness"], s["height"]
        if s["kind"] == "temple":
            k.box((length, t, h), mid, c.mat("plaster"), 0.03, rotation_deg=rot, name=f"temple_wall{i}")
            k.box((length + 0.2, t + 0.5, 0.3), (mid[0], mid[1], h), c.mat("roof"), 0.03, rotation_deg=rot,
                  name=f"temple_wall{i}_cap")
            k.box((length, 0.05, 0.35), (mid[0], mid[1], h - 0.6), c.mat("vermilion"), 0.0, rotation_deg=rot,
                  name=f"temple_wall{i}_band")
        else:
            k.box((length, t, h), mid, c.mat("foliage"), 0.25, rotation_deg=rot, name=f"hedge{i}")
        k.col(f"wall_{i}", (length, t, 3.0), mid, rot)
    return k.done()


def ground(ctx, L):
    k = Kit(ctx, "ground")
    c = k.ctx
    gr = L.data["ground"]
    near, temple = [], []
    near.append(k.add(k.g.extrude(gr["road"], 0.2, z=-0.2, mat=c.mat("asphalt"), name="ground_road")))
    for side, poly in gr["sidewalks"].items():
        near.append(k.add(k.g.extrude(poly, 0.2, z=-0.2, mat=c.mat("concrete"), name=f"ground_sidewalk_{side}")))
    temple.append(k.add(k.g.extrude(gr["templeGrounds"], 0.2, z=-0.2, mat=c.mat("concrete", name="gravel"),
                                    name="ground_temple")))
    temple.append(k.add(k.g.extrude(gr["templePath"], 0.22, z=-0.2, mat=c.mat("plaster"), name="ground_temple_path")))
    extent = k.add(k.g.extrude(gr["extent"], 0.02, z=-0.05, mat=c.mat("asphalt", name="ground_far"),
                               name="ground_extent"))
    walk = [k.g.extrude(gr["road"], 0.0, name="walk_road")]
    walk += [k.g.extrude(poly, 0.0, name=f"walk_{side}") for side, poly in gr["sidewalks"].items()]
    k.colliders.append(_hide(k.g.join(walk, "WALK_street")))
    k.colliders.append(_hide(k.g.extrude(gr["templeGrounds"], 0.0, name="WALK_temple")))
    pts = gr["walkBounds"]
    for i in range(len(pts)):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
        length = math.hypot(x1 - x0, y1 - y0)
        k.col(f"bounds_{i:02d}", (length + 0.4, 0.4, 3.0), ((x0 + x1) / 2, (y0 + y1) / 2, 0),
              math.degrees(math.atan2(y1 - y0, x1 - x0)))
    k.done()
    return near, temple, [extent]


def puddles(ctx, L):
    k = Kit(ctx, "puddles")
    mat = k.ctx.mat("night", name="puddle", roughness=0.1)
    out = []
    for i, p in enumerate(L.data["puddles"], start=1):
        obj = k.g.cylinder(0.5, 0.012, verts=20, mat=mat, name=f"PUDDLE_{i}", smooth=False)
        obj.data.transform(Matrix.Diagonal((p["size"][0], p["size"][1], 1.0, 1.0)))
        obj.location = (p["position"][0], p["position"][1], 0.0)
        obj.rotation_euler.z = math.radians(p["rotation"])
        out.append(k.add(obj))
    k.done()
    return out


def backdrop(ctx, L):
    k = Kit(ctx, "backdrop")
    c = k.ctx
    spec = L.data["backdrop"]
    regions = spec["regions"]
    areas = [(r[2] - r[0]) * (r[3] - r[1]) for r in regions]
    body, lit = c.mat("dusk"), c.emit("lamp", 2.0, name="window_far")
    for i in range(spec["count"]):
        r = c.rng.choices(regions, weights=areas)[0]
        w = c.rng.uniform(*spec["size"])
        d = c.rng.uniform(*spec["size"])
        h = c.rng.uniform(*spec["height"])
        x = c.rng.uniform(r[0] + w / 2, r[2] - w / 2)
        y = c.rng.uniform(r[1] + d / 2, r[3] - d / 2)
        if any(k0 - w / 2 < x < k2 + w / 2 and k1 - d / 2 < y < k3 + d / 2 for k0, k1, k2, k3 in spec["keepClear"]):
            continue  # keep the sky behind the tower clear
        rot = 0 if r[1] >= 110 else (90 if x < 0 else -90)
        fw, fd = (w, d) if rot == 0 else (d, w)
        m = matrix_from((x, y, 0), rot)
        parts = [k.g.box((fw, fd, h), mat=body, name=f"backdrop{i:02d}")]
        if c.rng.random() < spec["litChance"]:
            for j in range(c.rng.randint(1, 3)):
                z = c.rng.uniform(2.0, h - 2.0)
                parts.append(k.g.box((fw * 0.8, 0.1, 0.8), mat=lit, location=(0, -fd / 2 - 0.05, z)))
        _apply(parts, m)
        k.parts.extend(parts)
    return k.done()


# ---- bake lighting ---------------------------------------------------------------------

WATTS_PER_INTENSITY = 50  # Blender point-light watts per LIGHT_ extras.intensity unit (bake only)


def bake_lights(ctx, L):
    coll = scene.new_collection("bake_lights", ctx.collection)
    sc = bpy.context.scene
    scene.world(sc, ctx.color("dusk"), 1.4)
    scene.sun_light("moon", (55, 0, 160), ctx.color("vending"), 0.12, collection=coll)
    for name, s in L.data["lights"].items():
        scene.point_light(f"bake_{name}", s["position"], s["color"], s["intensity"] * WATTS_PER_INTENSITY,
                          radius=0.3, collection=coll)
    for i, s in enumerate(L.data["props"]["streetlight"]):
        x, y, _ = s["position"]
        hx, hy = rotate_z((0, -0.85), s["rotation"])
        if not any(math.dist((x + hx, y + hy), lt["position"][:2]) < 1.0 for lt in L.data["lights"].values()):
            scene.point_light(f"bake_streetlight_{i}", (x + hx, y + hy, 4.9), ctx.color("lamp"), 600, radius=0.3,
                              collection=coll)
    for i, s in enumerate(L.data["props"]["stone_lantern"]):
        x, y, _ = s["position"]
        scene.point_light(f"bake_lantern_{i}", (x, y, 1.0), ctx.color("lamp"), 90, collection=coll)
    kx, ky, _ = L.to_world("konbini", (0, -3.6, 1.6))
    scene.point_light("bake_konbini_spill", (kx, ky, 1.6), ctx.color("vending"), 700, radius=1.5, collection=coll)
    tw = L.landmarks["tower"]
    tx, ty, _ = tw["position"]
    for sx in (-1, 1):
        for sy in (-1, 1):
            data = bpy.data.lights.new(f"bake_tower_flood{sx:+d}{sy:+d}", "SPOT")
            data.energy = 9000
            data.color = ctx.materials.color("tower")[:3]
            data.spot_size = math.radians(35)
            data.shadow_soft_size = 0.5
            obj = bpy.data.objects.new(data.name, data)
            obj.location = (tx + sx * 12, ty + sy * 9 - 2, 0.5)
            direction = (tx - obj.location.x, ty - obj.location.y, tw["height"] * 0.3)
            obj.rotation_euler = Vector(direction).to_track_quat("-Z", "Y").to_euler()
            coll.objects.link(obj)


# ---- build ---------------------------------------------------------------------------------


def build(ctx):
    L = ctx.layout
    nodes.place_layout_nodes(ctx, L)
    near, temple, far = ground(ctx, L)
    puddle_objs = puddles(ctx, L)
    for spec in L.data["buildings"]:
        near += building(ctx, spec)
    for lm_id, lm in L.landmarks.items():
        parts = LANDMARK_KITS[lm["prop"]](ctx, lm)
        (near if lm_id in ("vending", "konbini") else temple).extend(parts)
    props = L.data["props"]
    for i, s in enumerate(props["streetlight"]):
        near += streetlight(ctx, i, s)
    for i, s in enumerate(props["stone_lantern"]):
        temple += stone_lantern(ctx, i, s)
    for i, s in enumerate(props["controls_sign"]):
        near += controls_sign(ctx, i, s)
    temple += walls(ctx, L.data["ground"]["walls"])
    far += backdrop(ctx, L)
    bake_lights(ctx, L)
    ctx.atlas("street", near + puddle_objs, size=2048)
    ctx.atlas("temple", temple, size=2048)
    ctx.atlas("far", far, size=512)
    return ctx.collection


def wayfinding_tower():
    """Objects that count as 'the tower' for the wayfinding check."""
    from .. import wayfinding

    return wayfinding.tower_objects("tokyo_tower")
