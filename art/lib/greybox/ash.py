"""Placeholder `ash` (WP-02 step 8): a capsule body, a sphere head and an umbrella,
rigged with exactly the § 6.3 bones and crude keyframed `idle`, `walk` and
`interact` clips, plus the root extras. WP-13's `art/characters/ash.py`
replaces it without code changes (WP-05 integrates against this one).

1.15 m tall including hair, head ≈ 40 % of the height, origin between the
feet, facing Blender +Y. The body is skinned with rigid weights (one bone per
part); UMBRELLA is a separate mesh parented to hand.R.
"""

import math

import bpy
from mathutils import Matrix, Vector

FPS = 24
WALK_FRAMES = 20  # 0.83 s loop
STRIDE_DEG = 25.0
LEG = 0.43  # hip joint to ankle, m

# name: (head, tail, parent). Right is +X when facing +Y.
BONES = {
    "hips": ((0, 0, 0.50), (0, 0, 0.58), None),
    "spine": ((0, 0, 0.58), (0, 0, 0.66), "hips"),
    "chest": ((0, 0, 0.66), (0, 0, 0.73), "spine"),
    "neck": ((0, 0, 0.73), (0, 0, 0.76), "chest"),
    "head": ((0, 0, 0.76), (0, 0, 1.12), "neck"),
}
for side, sx in (("L", -1), ("R", 1)):
    BONES[f"upper_arm.{side}"] = ((sx * 0.15, 0, 0.74), (sx * 0.19, 0, 0.60), "chest")
    BONES[f"forearm.{side}"] = ((sx * 0.19, 0, 0.60), (sx * 0.21, 0.01, 0.47), f"upper_arm.{side}")
    BONES[f"hand.{side}"] = ((sx * 0.21, 0.01, 0.47), (sx * 0.215, 0.02, 0.41), f"forearm.{side}")
    BONES[f"thigh.{side}"] = ((sx * 0.075, 0, 0.50), (sx * 0.075, 0, 0.28), "hips")
    BONES[f"shin.{side}"] = ((sx * 0.075, 0, 0.28), (sx * 0.075, 0, 0.07), f"thigh.{side}")
    BONES[f"foot.{side}"] = ((sx * 0.075, 0, 0.07), (sx * 0.075, 0.10, 0.02), f"shin.{side}")


def _limb(g, head, tail, radius, mat, name):
    """A capsule from `head` to `tail` (overlapping the joints by `radius`)."""
    a, b = Vector(head), Vector(tail)
    d = b - a
    length = d.length + radius
    obj = g.capsule(radius, length, segments=10, rings=2, mat=mat, name=name)
    rot = d.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    obj.data.transform(Matrix.Translation(a - d.normalized() * radius * 0.5) @ rot)
    return obj


def _bind(obj, bone):
    vg = obj.vertex_groups.new(name=bone)
    vg.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    return obj


def _rig(ctx):
    data = bpy.data.armatures.new("ash_rig")
    arm = bpy.data.objects.new("ash", data)
    ctx.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (head, tail, parent) in BONES.items():
        b = data.edit_bones.new(name)
        b.head, b.tail = head, tail
        b.roll = 0.0
        if parent:
            b.parent = data.edit_bones[parent]
            b.use_connect = Vector(head) == data.edit_bones[parent].tail
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    return arm


def _body(ctx, arm):
    g = ctx.geo
    skin = ctx.dyn("#F0C9A5", name="skin")
    hair = ctx.dyn("#2B2624", name="hair", roughness=0.4)
    jacket = ctx.dyn("dusk", name="jacket")
    tee = ctx.dyn("towerWhite", name="tee")
    jeans = ctx.dyn("#2E3C57", name="jeans")
    shoes = ctx.dyn("towerWhite", name="shoes")
    eyes = ctx.dyn("night", name="eyes", roughness=0.3)
    parts = []
    torso = g.capsule(0.15, 0.36, segments=12, rings=3, mat=jacket, name="ash_torso", location=(0, 0, 0.44))
    torso.data.transform(Matrix.Translation((0, 0, 0.44)))
    torso.location = (0, 0, 0)
    vg = {b: torso.vertex_groups.new(name=b) for b in ("hips", "spine", "chest")}
    for v in torso.data.vertices:
        vg["hips" if v.co.z < 0.58 else "spine" if v.co.z < 0.66 else "chest"].add([v.index], 1.0, "REPLACE")
    parts.append(torso)
    parts.append(_bind(g.rounded_box((0.14, 0.03, 0.16), 0.01, mat=tee, name="ash_tee", location=(0, 0.145, 0.58)),
                       "chest"))
    parts.append(_bind(g.sphere(0.23, segments=16, rings=10, mat=skin, name="ash_head", location=(0, 0, 0.92)),
                       "head"))
    cap = g.lathe([(0.0, 0.255), (0.13, 0.235), (0.21, 0.175), (0.25, 0.08), (0.255, 0.0), (0.235, -0.02),
                   (0.2, -0.02)], segments=16, mat=hair, name="ash_hair", location=(0, -0.025, 0.95))
    parts.append(_bind(cap, "head"))
    for sx in (-1, 1):
        parts.append(_bind(g.sphere(0.024, segments=8, rings=4, mat=eyes, name="ash_eye",
                                    location=(sx * 0.075, 0.216, 0.875)), "head"))
    parts.append(_bind(_limb(g, (0, 0, 0.72), (0, 0, 0.8), 0.06, skin, "ash_neck"), "neck"))
    for side, sx in (("L", -1), ("R", 1)):
        for bone, r, mat in (("upper_arm", 0.05, jacket), ("forearm", 0.045, jacket), ("thigh", 0.065, jeans),
                             ("shin", 0.058, jeans)):
            head, tail, _ = BONES[f"{bone}.{side}"]
            parts.append(_bind(_limb(g, head, tail, r, mat, f"ash_{bone}"), f"{bone}.{side}"))
        hx, hy, hz = BONES[f"hand.{side}"][0]
        parts.append(_bind(g.sphere(0.05, segments=10, rings=6, mat=skin, name="ash_hand",
                                    location=(hx, hy + 0.01, hz - 0.04)), f"hand.{side}"))
        fx, _, _ = BONES[f"foot.{side}"][0]
        parts.append(_bind(g.rounded_box((0.1, 0.19, 0.075), 0.025, mat=shoes, name="ash_shoe",
                                         location=(fx, 0.035, 0.0)), f"foot.{side}"))
    bpy.context.view_layer.update()
    for p in parts:  # bake object transforms into the meshes before joining
        p.data.transform(p.matrix_basis)
        p.matrix_basis = Matrix.Identity(4)
    body = g.join(parts, "ash_body")
    body.parent = arm
    mod = body.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    return body


def _umbrella(ctx, arm):
    g = ctx.geo
    handle = ctx.dyn("towerWhite", name="umbrella_handle")
    canopy = ctx.glass("towerWhite", 0.28, name="umbrella")
    grip = (0.215, 0.03, 0.42)
    top = Vector((0.11, 0.02, 1.38))
    stick = _limb(g, grip, tuple(top), 0.012, handle, "UMBRELLA")
    cone = g.lathe([(0.0, 0.1), (0.25, 0.06), (0.5, -0.06), (0.47, -0.08), (0.0, 0.07)], segments=12, mat=canopy,
                   name="umbrella_canopy", location=tuple(top))
    tilt = Matrix.Rotation(math.radians(-14), 4, "Y") @ Matrix.Rotation(math.radians(-10), 4, "X")
    cone.data.transform(tilt)
    ribs = []
    for i in range(6):
        a = 2 * math.pi * i / 6
        tip = top + tilt.to_3x3() @ Vector((0.49 * math.cos(a), 0.49 * math.sin(a), -0.07))
        ribs.append(_limb(g, tuple(top + Vector((0, 0, 0.09))), tuple(tip), 0.006, handle, "umbrella_rib"))
    hook = _limb(g, grip, (grip[0], grip[1] - 0.05, grip[2] - 0.06), 0.014, handle, "umbrella_hook")
    bpy.context.view_layer.update()
    for p in [cone, hook, *ribs]:
        p.data.transform(p.matrix_basis)
        p.matrix_basis = Matrix.Identity(4)
    umbrella = g.join([stick, cone, hook, *ribs], "UMBRELLA", origin=grip)
    umbrella.parent = arm
    umbrella.parent_type = "BONE"
    umbrella.parent_bone = "hand.R"
    bpy.context.view_layer.update()
    umbrella.matrix_world = Matrix.Translation(grip)
    return umbrella


def _key(arm, action, frames):
    """frames: {frame: {bone: (rx, ry, rz) degrees | ("loc", (x, y, z))}}"""
    arm.animation_data.action = action
    for frame, poses in sorted(frames.items()):
        for bone, value in poses.items():
            pb = arm.pose.bones[bone]
            if isinstance(value, tuple) and value and value[0] == "loc":
                pb.location = value[1]
                pb.keyframe_insert("location", frame=frame)
            else:
                pb.rotation_euler = [math.radians(v) for v in value]
                pb.keyframe_insert("rotation_euler", frame=frame)
    track = arm.animation_data.nla_tracks.new()
    track.name = action.name
    track.strips.new(action.name, int(min(frames)), action)
    track.mute = True
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)


def _clips(arm):
    arm.animation_data_create()
    still = (0, 0, 0)
    _key(arm, bpy.data.actions.new("idle"), {
        0: {"chest": still, "head": still, "upper_arm.R": (8, 0, 0)},
        24: {"chest": (3, 0, 0), "head": (-2, 0, 0), "upper_arm.R": (10, 0, 0)},
        48: {"chest": still, "head": still, "upper_arm.R": (8, 0, 0)},
    })
    s, n = STRIDE_DEG, WALK_FRAMES
    walk = {}
    for i, f in enumerate(range(0, n + 1, n // 4)):
        phase = (s, 0, -s, 0, s)[i]
        knee = (0, -30, 0, 0, 0)[i], (0, 0, 0, -30, 0)[i]
        walk[f] = {
            "thigh.L": (phase, 0, 0), "thigh.R": (-phase, 0, 0),
            "shin.L": (knee[0], 0, 0), "shin.R": (knee[1], 0, 0),
            "upper_arm.L": (-0.8 * phase, 0, 0), "upper_arm.R": (8 + 0.4 * phase, 0, 0),
            "hips": ("loc", (0, 0.02 if i in (1, 3) else 0.0, 0)),
        }
    _key(arm, bpy.data.actions.new("walk"), walk)
    _key(arm, bpy.data.actions.new("interact"), {
        0: {"upper_arm.L": still, "forearm.L": still},
        10: {"upper_arm.L": (80, 0, 0), "forearm.L": (10, 0, 0)},
        14: {"upper_arm.L": (82, 0, 0), "forearm.L": (8, 0, 0)},
        24: {"upper_arm.L": still, "forearm.L": still},
    })


def build(ctx):
    bpy.context.scene.render.fps = FPS
    arm = _rig(ctx)
    _body(ctx, arm)
    _umbrella(ctx, arm)
    _clips(arm)
    step = 2 * LEG * math.sin(math.radians(STRIDE_DEG))  # one foot's travel per half cycle
    arm["walkSpeed"] = round(2 * step / (WALK_FRAMES / FPS), 3)
    arm["footstepTimes"] = [0.0, 0.5]
    return ctx.collection
