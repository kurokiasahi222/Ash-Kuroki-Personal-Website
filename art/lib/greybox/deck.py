"""Greybox `deck` (WP-02 step 8): Tokyo Tower's main deck at night, seen only
through `CAM_shot_deck`. A slice of the room, an outward-leaning window band,
and a city of skyline boxes with emissive windows, street glow, aviation lights
and a distant Skytree-like spire. WP-14's `art/scenes/deck.py` replaces it.

The deck floor is at z = 0 and the city ground 150 m below. The web mounts this
file at DECK_OFFSET (WP-03), so everything sits near the origin.
"""

from .. import scene
from ..geo import matrix_from
from ..nodes import camera

CITY_Z = -150.0
CAMERA = {"position": (-1.0, -2.6, 1.45), "target": (-160.0, 800.0, -150.0), "fovDeg": 50.0}


def _place(objs, m):
    import bpy

    bpy.context.view_layer.update()
    for o in objs:
        if o.parent is None:
            o.matrix_world = m @ o.matrix_world


def room(ctx):
    c = ctx.child("deck_room")
    g = c.geo
    white, frame = c.mat("towerWhite"), c.mat("concrete")
    parts = [
        g.rounded_box((14, 7.4, 0.2), 0.02, mat=c.mat("roof"), name="deck_floor", location=(0, -0.9, -0.2)),
        g.rounded_box((14, 7.8, 0.25), 0.02, mat=c.mat("plaster"), name="deck_ceiling", location=(0, -0.7, 3.3)),
        g.rounded_box((14, 0.3, 3.3), 0.02, mat=c.mat("dusk"), name="deck_back_wall", location=(0, -4.6, 0)),
        g.rounded_box((14, 0.5, 0.45), 0.03, mat=white, name="deck_sill", location=(0, 2.45, 0)),
        g.rounded_box((14, 0.6, 0.3), 0.03, mat=white, name="deck_head", location=(0, 2.9, 3.05)),
    ]
    lean = 15.0  # the windows lean outward toward the top
    for i, x in enumerate(range(-7, 8, 2)):
        parts.append(g.rounded_box((0.14, 0.18, 2.75), 0.02, mat=white, name=f"deck_mullion{i}",
                                   location=(x, 2.5, 0.42), rotation_deg=(-lean, 0, 0)))
    glass = c.glass("vending", 0.12, name="deck_window")
    panes = [g.box((1.86, 0.03, 2.7), mat=glass, name=f"deck_pane{i}", location=(x + 1.0, 2.52, 0.44),
                   rotation_deg=(-lean, 0, 0)) for i, x in enumerate(range(-7, 7, 2))]
    rail = c.mat("roof", name="rail")
    parts.append(g.rounded_box((13.6, 0.08, 0.08), 0.0, mat=rail, name="deck_rail", location=(0, 1.75, 0.95)))
    parts += [g.box((0.06, 0.06, 0.95), mat=rail, name=f"deck_rail_post{i}", location=(x, 1.75, 0))
              for i, x in enumerate(range(-6, 7, 3))]
    wood = c.mat("wood")
    parts.append(g.rounded_box((2.4, 0.5, 0.1), 0.02, mat=wood, name="deck_bench_seat", location=(-2.4, -0.4, 0.42)))
    parts += [g.rounded_box((0.12, 0.45, 0.42), 0.02, mat=frame, name=f"deck_bench_leg{i}", location=(x, -0.4, 0))
              for i, x in enumerate((-3.4, -1.4))]
    parts.append(g.rounded_box((3.0, 0.08, 0.05), 0.0, mat=c.emit("lamp", 2.0, name="deck_cove"),
                               name="deck_cove_light", location=(-2.0, -4.4, 3.2)))
    return parts, panes


def city(ctx):
    c = ctx.child("deck_city")
    g = c.geo
    rng = c.rng
    body = c.mat("dusk", name="city")
    warm = c.emit("lamp", 2.5, name="city_window")
    cool = c.emit("vending", 2.0, name="city_window_cool")
    red = c.emit("vermilion", 5.0, name="aviation")
    glow = c.emit("lamp", 2.0, name="street_glow")
    statics, lit = [], []
    statics.append(g.box((5200, 3800, 1.0), mat=c.mat("night", name="city_ground"), name="deck_city_ground",
                         location=(0, 1850, CITY_Z - 1.0)))
    for i in range(260):
        t = rng.random() ** 1.7  # denser near the tower (Shiba, Minato)
        y = 60 + t * 2400
        x = rng.uniform(-1, 1) * (180 + 0.9 * y)
        w, d = rng.uniform(14, 40), rng.uniform(14, 40)
        h = rng.uniform(8, 45) * (1.0 + 1.6 * (1 - t) * rng.random())
        m = matrix_from((x, y, CITY_Z), rng.uniform(-8, 8))
        parts = [g.box((w, d, h), mat=body, name=f"deck_block{i:03d}")]
        if rng.random() < 0.6:
            mat = warm if rng.random() < 0.7 else cool
            for j in range(rng.randint(1, 4)):
                z = rng.uniform(3.0, max(h - 3.0, 3.5))
                parts.append(g.box((w * 0.85, 0.4, 1.6), mat=mat, location=(0, -d / 2 - 0.2, z)))
        if h > 55:
            parts.append(g.box((2.0, 2.0, 2.0), mat=red, location=(0, 0, h)))
        _place(parts, m)
        statics.append(parts[0])
        lit += parts[1:]
    for i, x in enumerate(range(-900, 901, 150)):  # glowing avenues between the blocks
        lit.append(g.box((4.0, 2600, 0.3), mat=glow, name=f"deck_avenue{i}", location=(x + 40, 1400, CITY_Z)))
    for i, y in enumerate((180, 420, 760, 1200, 1800)):
        lit.append(g.box((2 * (200 + 0.9 * y), 4.0, 0.3), mat=glow, name=f"deck_street{i}", location=(0, y, CITY_Z)))
    spire = c.emit("vending", 3.0, name="spire")
    sx, sy = -900.0, 2600.0
    lit.append(g.lathe([(0.0, 0.0), (40.0, 0.0), (9.0, 220.0), (5.0, 420.0), (0.0, 470.0)], segments=8,
                       mat=spire, name="deck_spire", location=(sx, sy, CITY_Z)))
    lit.append(g.cylinder(16.0, 12.0, verts=12, mat=c.emit("lamp", 3.0, name="spire_deck"), name="deck_spire_deck",
                          location=(sx, sy, CITY_Z + 330)))
    return statics, lit


def build(ctx):
    from ..layout import look_rotation

    room_parts, _panes = room(ctx)
    statics, lit = city(ctx)
    contract = scene.new_collection("contract_nodes", ctx.collection)
    pos = CAMERA["position"]
    camera(ctx, "CAM_shot_deck", pos, look_rotation(pos, CAMERA["target"]), CAMERA["fovDeg"], clip_end=6000.0,
           collection=contract)
    ctx.empty("LIGHT_deck_interior", (-1.0, -1.5, 3.0), collection=contract, color=ctx.color("lamp"), intensity=6,
              distance=8)
    ctx.empty("REFL_deck_window", (-1.0, 1.2, 0.0), collection=contract, color=ctx.color("lamp"), length=2.5)

    import bpy

    sc = bpy.context.scene
    lights = scene.new_collection("bake_lights", ctx.collection)
    scene.world(sc, ctx.color("dusk"), 1.2)
    scene.point_light("bake_deck_interior", (-1.0, -1.5, 3.0), ctx.color("lamp"), 120, radius=0.5,
                      collection=lights)
    scene.point_light("bake_deck_cove", (-2.0, -4.0, 3.0), ctx.color("lamp"), 60, radius=0.5, collection=lights)
    scene.sun_light("city_glow", (125, 0, 180), ctx.color("lamp"), 0.15, angle_deg=40, collection=lights)
    ctx.atlas("deck_room", room_parts, size=2048)
    ctx.atlas("deck_city", statics + lit, size=1024)  # lit parts merge per EMIT_ material
    return ctx.collection
