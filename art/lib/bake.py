"""Light baking (WP-02 step 3).

    bake(objects, atlas, size)               one atlas
    bake_atlases({atlas: objects}, sizes)    several atlases (bakes all, then swaps)

For each atlas:
  1. Static meshes merge into one mesh, `static_<atlas>`, to keep draw calls low.
     Contract-named objects (overview § 6.2) and their descendants are never
     merged; they bake into the same atlas but stay separate (PUDDLE_ meshes).
  2. Faces with EMIT_, GLASS_ or DYN_ materials are split off and merged per
     material (`<atlas>_<material>`), since only MAT_ faces are baked.
  3. A second UV map ("lightmap", lightmap pack) is created, Cycles bakes on the
     CPU (diffuse direct + indirect + color) into `art/out/bake/<atlas>.png`, and
     every MAT_ slot becomes `BAKED_<atlas>`.

With `fast=True`: few samples and a quarter resolution. The view transform is AgX.
All atlases are baked before any material is swapped, so a baked (unlit,
self-lit) surface never lights another atlas.
"""

import time

import bpy
from mathutils import Matrix

from . import contract, paths, scene
from .geo import ordered_join
from .materials import BAKED_UV, baked_material

BAKE_NODE = "__bake_target"
FAST_SAMPLES = 64
FULL_SAMPLES = 128  # CPU-friendly; pass --bake-samples for more


def is_protected(obj):
    """True for contract-named objects and anything parented under one."""
    o = obj
    while o is not None:
        if contract.is_contract_name(o.name):
            return True
        o = o.parent
    return False


def _has_mat_faces(obj):
    return any(m is not None and m.name.startswith("MAT_") for m in obj.data.materials)


def _realize(obj):
    """Single-user mesh data with modifiers applied."""
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    if obj.modifiers:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
        old = obj.data
        obj.modifiers.clear()
        obj.data = mesh
        if old.users == 0:
            bpy.data.meshes.remove(old)


def _detach_children(objs):
    bpy.context.view_layer.update()
    keep = set(objs)
    for o in objs:
        for c in list(o.children):
            if c not in keep:
                mw = c.matrix_world.copy()
                c.parent = None
                c.matrix_world = mw


def _apply_world(obj):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = None
    obj.data.transform(mw)
    obj.matrix_world = Matrix.Identity(4)


def compact_slots(obj):
    """Drop unused material slots and merge slots that hold the same material."""
    me = obj.data
    n = len(me.polygons)
    idx = [0] * n
    me.polygons.foreach_get("material_index", idx)
    mats = list(me.materials)
    order, remap = [], {}
    for i in sorted(set(idx)):
        m = mats[i] if i < len(mats) else None
        if m not in order:
            order.append(m)
        remap[i] = order.index(m)
    me.materials.clear()
    for m in order:
        me.materials.append(m)
    me.polygons.foreach_set("material_index", [remap[i] for i in idx])
    me.update()


def _select_only(objs):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def merge_static(objs, atlas):
    """Merge `objs` (non-contract meshes) → (`static_<atlas>` or None, [per-material pieces])."""
    objs = [o for o in objs if o.type == "MESH"]
    if not objs:
        return None, []
    for o in objs:
        _realize(o)
    _detach_children(objs)
    joined = ordered_join(objs)
    _apply_world(joined)
    compact_slots(joined)
    if len(joined.data.materials) > 1:
        _select_only([joined])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.separate(type="MATERIAL")
        bpy.ops.object.mode_set(mode="OBJECT")
        pieces = list(bpy.context.selected_objects)
    else:
        pieces = [joined]
    for p in pieces:
        compact_slots(p)
    pieces.sort(key=lambda p: p.data.materials[0].name if len(p.data.materials) else "")  # repeatable order
    statics, others = [], []
    for p in pieces:
        mat = p.data.materials[0] if len(p.data.materials) else None
        (statics if mat is not None and mat.name.startswith("MAT_") else others).append(p)
    merged = None
    if statics:
        merged = ordered_join(statics)
        merged.name = merged.data.name = f"static_{atlas}"
        compact_slots(merged)
    for p in others:
        mat = p.data.materials[0] if len(p.data.materials) else None
        p.name = p.data.name = f"{atlas}_{mat.name if mat else 'nomat'}"
    return merged, others


def _lightmap_pack(obj, margin):
    _select_only([obj])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.lightmap_pack(PREF_CONTEXT="ALL_FACES", PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False,
                             PREF_BOX_DIV=12, PREF_MARGIN_DIV=margin)
    bpy.ops.object.mode_set(mode="OBJECT")


def _pack_lightmap(objs, margin):
    """One shared lightmap UV space for `objs`, packed repeatably.

    lightmap_pack over several objects in edit mode visits them in an order that
    changes between runs, so the objects are copied, joined in list order, packed
    as one mesh, and the UVs copied back loop by loop.
    """
    for o in objs:
        uv = o.data.uv_layers.get(BAKED_UV) or o.data.uv_layers.new(name=BAKED_UV)
        o.data.uv_layers.active = uv
    if len(objs) == 1:
        _lightmap_pack(objs[0], margin)
        return
    copies = []
    for o in objs:
        c = o.copy()
        c.data = o.data.copy()
        c.parent = None
        bpy.context.scene.collection.objects.link(c)
        copies.append(c)
    bpy.context.view_layer.update()
    for o, c in zip(objs, copies):
        c.matrix_world = o.matrix_world.copy()
    tmp = ordered_join(copies)
    tmp.data.uv_layers.active = tmp.data.uv_layers[BAKED_UV]
    _lightmap_pack(tmp, margin)
    flat = [0.0] * (2 * len(tmp.data.loops))
    tmp.data.uv_layers[BAKED_UV].data.foreach_get("uv", flat)
    start = 0
    for o in objs:
        n = 2 * len(o.data.loops)
        o.data.uv_layers[BAKED_UV].data.foreach_set("uv", flat[start:start + n])
        start += n
    mesh = tmp.data
    bpy.data.objects.remove(tmp)
    bpy.data.meshes.remove(mesh)


def _uses_textures(mat):
    return mat is not None and mat.node_tree is not None and any(
        n.bl_idname == "ShaderNodeTexImage" and n.name != BAKE_NODE for n in mat.node_tree.nodes)


def _set_bake_target(mat, image):
    nt = mat.node_tree
    node = nt.nodes.get(BAKE_NODE) or nt.nodes.new("ShaderNodeTexImage")
    node.name = BAKE_NODE
    node.image = image
    node.select = True
    nt.nodes.active = node


def bake_atlases(groups, sizes=2048, *, fast=False, samples=None, out_dir=None, log=print):
    """Bake every atlas in `groups` ({atlas: [objects]}). `sizes` is one size or {atlas: size}.

    Returns {atlas: {"object": merged mesh or None, "targets": [...], "pieces": [...], "image": path}}.
    """
    sc = bpy.context.scene
    out_dir = out_dir or paths.BAKE_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    scene.cycles(sc, samples or (FAST_SAMPLES if fast else FULL_SAMPLES), denoise=False)
    bake = sc.render.bake
    bake.use_pass_direct = True
    bake.use_pass_indirect = True
    bake.use_pass_color = True
    bake.margin = 2 if fast else 8
    bake.margin_type = "EXTEND"
    bake.target = "IMAGE_TEXTURES"
    bake.use_clear = True

    plans = []
    for atlas, objects in groups.items():
        size = sizes.get(atlas, 2048) if isinstance(sizes, dict) else sizes
        px = max(64, size // 4) if fast else size
        objects = [o for o in objects if o.type == "MESH" and not o.hide_render]
        protected = [o for o in objects if is_protected(o)]
        merged, pieces = merge_static([o for o in objects if not is_protected(o)], atlas)
        targets = ([merged] if merged else []) + [o for o in protected if _has_mat_faces(o)]
        if not targets:
            log(f"[bake] {atlas}: nothing to bake")
            continue
        _pack_lightmap(targets, 0.25 if px <= 512 else 0.15)
        image = bpy.data.images.new(f"bake_{atlas}", px, px, alpha=False, float_buffer=False)
        plans.append({"atlas": atlas, "targets": targets, "pieces": pieces, "merged": merged, "image": image,
                      "px": px})

    for plan in plans:
        t0 = time.time()
        mats = {m for o in plan["targets"] for m in o.data.materials if m and m.name.startswith("MAT_")}
        for m in mats:
            _set_bake_target(m, plan["image"])
        _select_only(plan["targets"])
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT", "COLOR"}, margin=bake.margin,
                            use_clear=True, target="IMAGE_TEXTURES")
        path = out_dir / f"{plan['atlas']}.png"
        img = plan["image"]
        img.filepath_raw = str(path)
        img.file_format = "PNG"
        img.save()
        img.pack()
        plan["path"] = path
        tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in plan["targets"])
        log(f"[bake] {plan['atlas']}: {plan['px']}px, {sc.cycles.samples} samples, {len(plan['targets'])} "
            f"object(s), {tris} tris, {time.time() - t0:.1f}s → {path.relative_to(paths.REPO)}")

    for plan in plans:
        mat = baked_material(plan["atlas"], plan["image"])
        for o in plan["targets"]:
            for i, m in enumerate(o.data.materials):
                if m is not None and m.name.startswith("MAT_"):
                    o.data.materials[i] = mat
            compact_slots(o)
            if not any(_uses_textures(m) for m in o.data.materials if m is not mat):
                for uv in [uv for uv in o.data.uv_layers if uv.name != BAKED_UV]:
                    o.data.uv_layers.remove(uv)

    for m in list(bpy.data.materials):
        if m.node_tree and BAKE_NODE in m.node_tree.nodes:
            m.node_tree.nodes.remove(m.node_tree.nodes[BAKE_NODE])
        if m.name.startswith("MAT_") and m.users == 0:
            bpy.data.materials.remove(m)

    return {p["atlas"]: {"object": p["merged"], "targets": p["targets"], "pieces": p["pieces"],
                         "image": p.get("path")} for p in plans}


def bake(objects, atlas, size=2048, *, fast=False, samples=None):
    """Bake `objects` into `BAKED_<atlas>` at `size` px (a quarter of it with `fast`)."""
    return bake_atlases({atlas: objects}, {atlas: size}, fast=fast, samples=samples)[atlas]
