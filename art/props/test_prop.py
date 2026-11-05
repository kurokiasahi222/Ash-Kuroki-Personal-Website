"""WP-02 test prop: exercises every BuildContext helper. Remove before merging."""

import math

import bpy

MAX_TRIS = 6000


def build(ctx):
    g = ctx.geo
    g.rounded_box((1.2, 0.8, 0.3), mat=ctx.mat("concrete"), name="test_prop_base")
    g.cylinder(0.08, 1.4, verts=12, mat=ctx.mat("roof"), name="test_prop_pole", location=(0.4, 0.1, 0.3))
    g.lathe([(0.0, 0.0), (0.18, 0.0), (0.22, 0.12), (0.12, 0.3), (0.0, 0.32)], segments=12,
            mat=ctx.emit("lamp", 4.0), name="test_prop_lamp", location=(0.4, 0.1, 1.7))
    g.extrude([(0, 0), (0.5, 0), (0.5, 0.2), (0.25, 0.35), (0, 0.2)], 0.1, mat=ctx.mat("wood"),
              name="test_prop_plank", location=(-0.55, -0.25, 0.3))
    curve = [(-0.5 + i * 0.25, -0.42, 0.34 + 0.06 * math.sin(i * 1.5)) for i in range(5)]
    square = [(-0.02, -0.02), (0.02, -0.02), (0.02, 0.02), (-0.02, 0.02)]
    g.sweep(curve, square, mat=ctx.mat("vermilion"), name="test_prop_rail")
    g.sphere(0.1, mat=ctx.mat("foliage"), name="test_prop_ball", location=(-0.4, 0.2, 0.42))
    g.capsule(0.05, 0.3, mat=ctx.mat("plaster"), name="test_prop_capsule", location=(0.0, 0.25, 0.3))
    g.box((0.9, 0.03, 0.5), mat=ctx.glass("vending", 0.3), name="test_prop_glass", location=(-0.1, -0.38, 0.35))
    ctx.text_jp("あさひ", 0.16, mat=ctx.emit("mart", 3.0), name="test_prop_sign", location=(-0.1, -0.41, 0.5))
    g.cylinder(0.033, 0.12, mat=ctx.dyn("vermilion"), name="ANIM_vending_can", location=(0.0, -0.1, 0.3))

    # instance(): three seeded copies of a template, which is then removed
    template = ctx.child("test_prop_template").collection
    g.rounded_box((0.06, 0.06, 0.2), mat=ctx.mat("tower"), name="test_prop_peg", collection=template)
    spots = [((-0.45 + 0.12 * i, 0.32 + ctx.rng.uniform(-0.05, 0.05), 0.3), 15 * i) for i in range(3)]
    g.instance(template, spots)
    for obj in list(template.objects):
        bpy.data.objects.remove(obj)
    bpy.data.collections.remove(template)

    ctx.empty("REFL_test_prop", (0.4, -0.6, 0.0), color=ctx.color("lamp"), length=2.0)
    col = g.box((1.2, 0.8, 1.0), name="COL_test_prop_base")
    col.hide_render = col.hide_viewport = True
    return ctx.collection
