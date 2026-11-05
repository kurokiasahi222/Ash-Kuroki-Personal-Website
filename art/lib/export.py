"""Export, patch and optimize (WP-02 step 4).

export_glb()  Blender → glTF binary: Y-up, custom properties as extras, cameras in,
              punctual lights out (the web uses LIGHT_ empties instead).
patch_glb()   Keeps each EMIT_ material's Blender emission strength on export
              (KHR_materials_emissive_strength). Blender's exporter folds the
              strength into emissiveFactor whenever color × strength ≤ 1, which
              would drop it for darker colors such as `mart`.
optimize()    gltf-transform: meshopt + WebP, with joining, flattening,
              instancing, simplification, palette merging and leaf pruning off,
              so contract node names (and empties) survive.

`prepare()` runs first. Two things in it keep the contract intact through optimize:
  * meshopt quantization rewrites the transform of childless mesh nodes. An
    `ANIM_*` mesh therefore becomes an `ANIM_*` empty (same pivot, same extras)
    with its mesh as an identity child, so code still rotates it about its pivot.
  * three.js strips '.' from node names, so Blender's 'name.001' becomes 'name_001'.
"""

import contextlib
import os
import re
import shutil
import tempfile
import subprocess

import bpy
import pygltflib
from mathutils import Matrix

from . import contract
from .materials import emission_of

# ---- prepare -------------------------------------------------------------------


def sanitize_names(log=print):
    taken = {o.name for o in bpy.data.objects}
    renamed = []
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        if not contract.THREE_UNSAFE.search(obj.name):
            continue
        new = re.sub(r"\.(\d+)$", r"_\1", obj.name)
        new = contract.THREE_UNSAFE.sub("_", new)
        base, n = new, 1
        while new in taken:
            new = f"{base}_{n}"
            n += 1
        taken.discard(obj.name)
        renamed.append(f"{obj.name} → {new}")
        obj.name = new
        taken.add(new)
    if renamed:
        log(f"[export] {len(renamed)} name(s) made three.js-safe, e.g. {renamed[0]}")


def wrap_anim_meshes(log=print):
    """`ANIM_x` mesh → `ANIM_x` empty (pivot, extras) + child mesh `anim_x_geo`."""
    bpy.context.view_layer.update()
    for obj in [o for o in bpy.data.objects if o.name.startswith("ANIM_") and o.type == "MESH"]:
        name = obj.name
        obj.name = f"anim_{name[len('ANIM_'):]}_geo"
        obj.data.name = obj.name
        empty = bpy.data.objects.new(name, None)
        empty.empty_display_type = "ARROWS"
        empty.empty_display_size = 0.3
        for coll in obj.users_collection:
            coll.objects.link(empty)
        empty.parent = obj.parent
        empty.parent_type = obj.parent_type
        empty.parent_bone = obj.parent_bone
        empty.matrix_world = obj.matrix_world.copy()
        for key in list(obj.keys()):
            empty[key] = obj[key]
            del obj[key]
        children = list(obj.children)
        obj.parent = empty
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = Matrix.Identity(4)
        for c in children:  # keep the pivot object as the parent of attached parts
            mw = c.matrix_world.copy()
            c.parent = empty
            c.matrix_world = mw
        log(f"[export] {name}: mesh wrapped in a pivot empty")


def remove_helper_empties():
    """Delete non-contract empties that hold nothing (prop roots left after merging)."""
    changed = True
    while changed:
        changed = False
        for obj in list(bpy.data.objects):
            if obj.type == "EMPTY" and not obj.children and not contract.is_contract_name(obj.name) \
                    and not [k for k in obj.keys() if not k.startswith("_")]:
                bpy.data.objects.remove(obj)
                changed = True


def prepare(log=print):
    sanitize_names(log)
    wrap_anim_meshes(log)
    remove_helper_empties()


# ---- export --------------------------------------------------------------------


@contextlib.contextmanager
def _quiet(log):
    """Swallow the exporter's per-primitive INFO lines; pass warnings and errors on."""
    with tempfile.TemporaryFile(mode="w+b") as tmp:
        saved = [os.dup(1), os.dup(2)]
        try:
            os.dup2(tmp.fileno(), 1)
            os.dup2(tmp.fileno(), 2)
            yield
        finally:
            os.dup2(saved[0], 1)
            os.dup2(saved[1], 2)
            for fd in saved:
                os.close(fd)
            tmp.seek(0)
            for line in tmp.read().decode("utf-8", "replace").splitlines():
                if "is not available because library could not be found" in line:
                    continue  # the exporter's own Draco/meshopt; gltf-transform compresses instead
                if "WARNING" in line or "ERROR" in line or "Error" in line:
                    log(f"[export] {line.strip()}")


def export_glb(path, *, animations=False, log=print):
    path.parent.mkdir(parents=True, exist_ok=True)
    with _quiet(log):
        _export(path, animations)


def _export(path, animations):
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=False,
        use_visible=False,
        export_yup=True,
        export_extras=True,
        export_cameras=True,
        export_lights=False,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_animations=animations,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_anim_slide_to_zero=False,
        export_skins=True,
        export_def_bones=False,
        export_leaf_bone=False,
        export_morph=False,
        export_gpu_instances=False,
        export_hierarchy_flatten_objs=False,
    )


def patch_glb(path, *, scene_extras=None):
    """Write each EMIT_ material's Blender emission (color, strength) into the file."""
    g = pygltflib.GLTF2().load(str(path))
    used = set(g.extensionsUsed or [])
    for m in g.materials or []:
        if m.name and m.name.startswith("EMIT_") and m.name in bpy.data.materials:
            info = emission_of(bpy.data.materials[m.name])
            if info is None:
                continue
            color, strength = info
            m.emissiveFactor = [round(c, 6) for c in color]
            m.extensions = dict(m.extensions or {})
            m.extensions["KHR_materials_emissive_strength"] = {"emissiveStrength": round(strength, 4)}
            used.add("KHR_materials_emissive_strength")
        for slot in ("baseColorTexture",):
            tex = getattr(m.pbrMetallicRoughness, slot, None) if m.pbrMetallicRoughness else None
            if tex is not None and (tex.texCoord or 0) < 0:
                raise RuntimeError(f"{m.name}: {slot} has no UV map (texCoord {tex.texCoord})")
    g.extensionsUsed = sorted(used) if used else g.extensionsUsed
    if scene_extras and g.scenes:
        g.scenes[g.scene or 0].extras = scene_extras
    g.save(str(path))


# ---- optimize ------------------------------------------------------------------


def _npx():
    exe = shutil.which("npx")
    if not exe:
        raise RuntimeError("npx not found: install Node 22 (gltf-transform runs through npx)")
    return exe


def _run(args, log):
    log("[optimize] " + " ".join(args[2:]))
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"gltf-transform failed ({proc.returncode}):\n{proc.stdout}\n{proc.stderr}")
    return proc


def optimize(raw, out, texture_size, *, cli, work_dir, log=print):
    """raw .glb → optimized .glb with meshopt geometry and WebP textures ≤ texture_size px.

    `cli` is the pinned npm spec, e.g. "@gltf-transform/cli@4.5.1" (build.py pins it).
    """
    npx = _npx()
    work_dir.mkdir(parents=True, exist_ok=True)
    pruned = work_dir / (out.stem + ".pruned.glb")
    base = [npx, "--yes", cli]
    _run(base + ["prune", str(raw), str(pruned), "--keep-leaves", "true"], log)
    out.parent.mkdir(parents=True, exist_ok=True)
    _run(base + ["optimize", str(pruned), str(out),
                 "--compress", "meshopt",
                 "--texture-compress", "webp",
                 "--texture-size", str(texture_size),
                 "--flatten", "false",
                 "--join", "false",
                 "--instance", "false",
                 "--simplify", "false",
                 "--palette", "false",
                 "--prune", "false"], log)
    pruned.unlink(missing_ok=True)
    return out
