"""The wayfinding rule (overview § 4): from `SPAWN_start`, the camera frame shows
the tower's lit upper section.

`check()` samples points up the tower's axis between `low` and `high` (fractions
of the layout height: the main deck sits near 40 %, the top deck near 70 %),
and for each point tests that it projects inside the `CAM_shot_start` frame and
that the first thing a ray from the camera hits is part of the tower.
Run it after building and before baking (the bake merges the tower's meshes).
"""

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


def tower_objects(collection_name="tokyo_tower"):
    coll = bpy.data.collections.get(collection_name)
    return set(coll.all_objects) if coll else set()


def check(layout, *, camera_name="CAM_shot_start", tower=None, low=0.4, high=0.75, samples=8, log=print):
    sc = bpy.context.scene
    bpy.context.view_layer.update()
    cam = bpy.data.objects[camera_name]
    tower = tower if tower is not None else tower_objects()
    lm = layout.landmarks["tower"]
    px, py, pz = lm["position"]
    height = lm["height"]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    origin = cam.matrix_world.translation.copy()
    rows, visible = [], 0
    for i in range(samples):
        frac = low + (high - low) * i / max(samples - 1, 1)
        target = Vector((px, py, pz + frac * height))
        ndc = world_to_camera_view(sc, cam, target)
        in_frame = 0.0 <= ndc.x <= 1.0 and 0.0 <= ndc.y <= 1.0 and ndc.z > 0
        direction = (target - origin)
        dist = direction.length
        hit, loc, _n, _i, obj, _m = sc.ray_cast(depsgraph, origin, direction.normalized(), distance=dist)
        if hit and obj is not None:
            src = obj.original if hasattr(obj, "original") else obj
            unblocked = src in tower
            blocker = src.name
        else:
            unblocked, blocker = True, None
        ok = in_frame and unblocked
        visible += ok
        rows.append((frac, ndc.y, in_frame, unblocked, blocker))
    for frac, y, in_frame, unblocked, blocker in rows:
        state = "visible" if in_frame and unblocked else ("out of frame" if not in_frame else f"behind {blocker}")
        log(f"[wayfinding] tower at {frac * 100:4.0f}% height ({frac * height:5.1f} m): frame y {y:5.2f}  {state}")
    passed = visible >= (samples + 1) // 2
    log(f"[wayfinding] {camera_name}: {visible}/{samples} upper-section samples visible → "
        f"{'PASS' if passed else 'FAIL'}")
    return passed, rows
