#!/usr/bin/env python3
"""Render Cycles previews of built assets (WP-02 step 6), CPU only, AgX, 960×540.

    python art/preview.py street --shot start        one CAM_shot_<name>
    python art/preview.py street                     every CAM_shot_* in the file
    python art/preview.py deck --shot deck --fast
    python art/preview.py ash                        front, three-quarter, side, gameplay
    python art/preview.py prop:<name>                front and three-quarter

Renders `art/out/<target>.blend` (written by build.py) into
`shots/art/<target>-<shot>.png`. Props and the character are shown under a
neutral night setup: a dim blue sky and one warm lamp, on a dark ground plane.
"""

import argparse
import math
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
ART = Path(__file__).resolve().parent
if str(ART) not in sys.path:
    sys.path.insert(0, str(ART))

FAST_SAMPLES = 12
FULL_SAMPLES = 64
STUDIO_VIEWS = {  # name: (yaw from the front, elevation), degrees; the front faces -Y
    "front": (0, 8),
    "three-quarter": (35, 20),
    "side": (90, 8),
}


def log(msg):
    print(msg, flush=True)


def visible_meshes(bpy):
    return [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render]


def bounds(bpy, objs):
    from mathutils import Vector

    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def studio(bpy, lo, hi, front=-1):
    """A dim blue sky, one warm lamp and a dark ground plane, sized to the subject.

    `front` is the subject's facing along Y: -1 for props, +1 for the character.
    """
    from lib import palette as pal
    from lib import scene

    palette = pal.load()
    sc = bpy.context.scene
    scene.world(sc, palette["dusk"], 2.0)
    size = max((hi - lo).length, 1.0)
    center = (lo + hi) / 2
    lamp = scene.point_light("preview_lamp", (center.x - 0.6 * size, center.y + front * 0.9 * size, hi.z + 0.5 * size),
                             palette["lamp"], 120 * size * size, radius=0.1 * size)
    me = bpy.data.meshes.new("preview_ground")
    r = size * 6
    me.from_pydata([(-r, -r, lo.z), (r, -r, lo.z), (r, r, lo.z), (-r, r, lo.z)], [], [(0, 1, 2, 3)])
    ground = bpy.data.objects.new("preview_ground", me)
    mat = bpy.data.materials.new("preview_ground")
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = pal.hex_to_linear(palette["asphalt"])
    me.materials.append(mat)
    sc.collection.objects.link(ground)
    return lamp


def studio_camera(bpy, name, lo, hi, yaw, elevation, fov=35.0):
    from mathutils import Vector

    from lib.nodes import camera as make_camera
    from lib.layout import look_rotation

    center = (lo + hi) / 2
    radius = max((hi - lo).length / 2, 0.2)
    dist = radius / math.sin(math.radians(fov / 2)) * 1.05
    a, e = math.radians(yaw), math.radians(elevation)
    direction = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    pos = center + direction * dist
    cam = bpy.data.objects.get(name) or make_camera(None, name, tuple(pos), look_rotation(tuple(pos), tuple(center)),
                                                    fov, collection=bpy.context.scene.collection)
    return cam


def gameplay_camera(bpy):
    """The § 6.4 follow camera, with the character turned to face it (to see the face)."""
    from lib.layout import Layout
    from lib.nodes import camera as make_camera

    cam = Layout.load().camera
    pos = (0.0, cam["behind"], cam["height"])
    return make_camera(None, "preview_gameplay", pos, (90.0 - cam["pitchDeg"], 0.0, 180.0), cam["fovDeg"],
                       collection=bpy.context.scene.collection)


def render(bpy, cam, out, samples):
    from lib import scene

    sc = bpy.context.scene
    scene.cycles(sc, samples)
    sc.render.resolution_x, sc.render.resolution_y = scene.PREVIEW_RESOLUTION
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.film_transparent = False
    sc.camera = cam
    out.parent.mkdir(parents=True, exist_ok=True)
    sc.render.filepath = str(out)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    log(f"[preview] {out.relative_to(ART.parent)} ({samples} samples, {time.time() - t0:.0f}s)")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("target", help="street | deck | ash | prop:<name>")
    p.add_argument("--shot", action="append",
                   help="shot name (repeatable). street/deck: CAM_shot_<name>; ash: front, three-quarter, side, "
                        "gameplay; props: front, three-quarter. Default: all")
    p.add_argument("--fast", action="store_true", help=f"{FAST_SAMPLES} samples instead of {FULL_SAMPLES}")
    p.add_argument("--samples", type=int)
    a = p.parse_args(argv)

    import bpy

    from lib import paths, scene

    samples = a.samples or (FAST_SAMPLES if a.fast else FULL_SAMPLES)
    is_prop = a.target.startswith("prop:")
    stem = f"prop-{a.target.split(':', 1)[1]}" if is_prop else a.target
    blend = paths.OUT / f"{stem}.blend"
    if not blend.exists():
        raise SystemExit(f"{blend.relative_to(paths.REPO)} is missing: run python art/build.py {a.target}")
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    scene.color_management(bpy.context.scene)

    if a.target in ("street", "deck"):
        cams = {o.name[len("CAM_shot_"):]: o for o in bpy.data.objects
                if o.type == "CAMERA" and o.name.startswith("CAM_shot_")}
        shots = a.shot or sorted(cams)
        for shot in shots:
            if shot not in cams:
                raise SystemExit(f"{a.target} has no CAM_shot_{shot} (has: {', '.join(sorted(cams))})")
            render(bpy, cams[shot], paths.SHOTS / f"{a.target}-{shot}.png", samples)
        return 0

    lo, hi = bounds(bpy, visible_meshes(bpy))
    studio(bpy, lo, hi, front=1 if a.target == "ash" else -1)
    views = list(STUDIO_VIEWS) + (["gameplay"] if a.target == "ash" else [])
    if is_prop:
        views = ["front", "three-quarter"]
    for view in a.shot or views:
        if view == "gameplay":
            cam = gameplay_camera(bpy)
        elif view in STUDIO_VIEWS:
            yaw, elevation = STUDIO_VIEWS[view]
            if a.target == "ash":
                yaw += 180  # the character faces +Y (§ 6.3); props face -Y
            cam = studio_camera(bpy, f"preview_{view}", lo, hi, yaw, elevation)
        else:
            raise SystemExit(f"unknown view {view!r} (have: {', '.join(views)})")
        render(bpy, cam, paths.SHOTS / f"{stem}-{view}.png", samples)
    return 0


if __name__ == "__main__":
    sys.exit(main())
