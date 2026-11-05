"""Place the contract nodes that `layout.json` owns (overview § 6.2, § 6.9).

    place_layout_nodes(ctx)   SPAWN_*, PATH_*, LIGHT_*, landmark ZONE_/STAND_/LABEL_/SND_,
                              CAM_shot_* (computed from the camera block) and CAM_sweep_*

Both the greybox and the final street assembler (WP-15) call this, so the node
set stays identical whichever builds `street.glb`. Props build their own
ANIM_*, REFL_* and COL_* objects.
"""

import math

import bpy

from . import scene


def camera(ctx, name, location, rotation_deg, fov_deg, *, clip_end=1500.0, collection=None):
    """A Blender camera with a vertical field of view (glTF `yfov`)."""
    data = bpy.data.cameras.new(name)
    data.sensor_fit = "VERTICAL"
    data.angle_y = math.radians(fov_deg)
    data.clip_start = 0.1
    data.clip_end = clip_end
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = [math.radians(v) for v in rotation_deg]
    (collection or ctx.collection).objects.link(obj)
    if obj.name != name:
        raise ValueError(f"an object named {name} already exists")
    return obj


def place_layout_nodes(ctx, layout=None, *, collection=None, clip_end=1500.0):
    """Create every layout-owned node. Returns {name: object}."""
    layout = layout or ctx.layout
    coll = collection or scene.new_collection("contract_nodes", ctx.collection)
    made = {}
    for name, node in layout.nodes().items():
        if node.kind == "camera":
            made[name] = camera(ctx, name, node.location, node.rotation_deg, node.fov_deg, clip_end=clip_end,
                                collection=coll)
        else:
            made[name] = ctx.empty(name, node.location, node.rotation_deg, collection=coll, unique=True,
                                   **node.extras)
    return made
