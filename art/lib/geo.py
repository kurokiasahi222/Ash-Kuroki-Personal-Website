"""Geometry helpers (`ctx.geo`). Every helper returns a new mesh object.

Shared keyword arguments:
    name          object and mesh name (default: `<module>_<kind>NN`)
    mat           a material from ctx.mat/emit/dyn/glass (or None)
    location      (x, y, z), default origin
    rotation_deg  degrees: one number (about Z) or an (x, y, z) Euler triple
    collection    where to link the object (default: ctx.collection)

Boxy shapes get a bevel of at least 2 cm by default: the soft-miniature look.
`origin="base"` (the default) puts the object origin at the bottom center,
like a prop (overview § 6.9); `origin="center"` centers it.
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

DEFAULT_BEVEL = 0.02


def euler_deg(rotation_deg):
    if rotation_deg is None:
        return (0.0, 0.0, 0.0)
    if isinstance(rotation_deg, (int, float)):
        return (0.0, 0.0, float(rotation_deg))
    return tuple(float(v) for v in rotation_deg)


def matrix_from(location=(0, 0, 0), rotation_deg=0, scale=(1, 1, 1)):
    from mathutils import Euler

    rx, ry, rz = (math.radians(v) for v in euler_deg(rotation_deg))
    if isinstance(scale, (int, float)):
        scale = (scale, scale, scale)
    return Matrix.LocRotScale(Vector(location), Euler((rx, ry, rz), "XYZ"), Vector(scale))


def ordered_join(objects):
    """Join mesh objects into objects[0], keeping list order (so builds repeat).

    `bpy.ops.object.join()` with many selected objects appends them in an order
    that changes between runs. Joining pairs, as a balanced tree, keeps the
    order and costs O(n log n).
    """
    objs = list(objects)
    while len(objs) > 1:
        merged = []
        for i in range(0, len(objs), 2):
            if i + 1 < len(objs):
                pair = [objs[i], objs[i + 1]]
                with bpy.context.temp_override(active_object=objs[i], selected_editable_objects=pair,
                                               selected_objects=pair):
                    bpy.ops.object.join()
            merged.append(objs[i])
        objs = merged
    return objs[0]


class Geo:
    def __init__(self, ctx):
        self.ctx = ctx

    # ---- plumbing ------------------------------------------------------------

    def _finish(self, bm, kind, name, mat, location, rotation_deg, collection, smooth=False, sharp_angle=40):
        name = name or self.ctx.auto_name(kind)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        if smooth:
            me.shade_smooth()
            me.set_sharp_from_angle(angle=math.radians(sharp_angle))
        obj = bpy.data.objects.new(name, me)
        if mat is not None:
            me.materials.append(mat)
        obj.location = Vector(location)
        obj.rotation_euler = [math.radians(v) for v in euler_deg(rotation_deg)]
        (collection or self.ctx.collection).objects.link(obj)
        return obj

    @staticmethod
    def _shift(bm, origin, half_height):
        if origin == "base":
            bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, half_height))
        elif origin != "center":
            raise ValueError(f"origin must be 'base' or 'center', got {origin!r}")

    # ---- primitives ----------------------------------------------------------

    def rounded_box(self, size, bevel=DEFAULT_BEVEL, *, segments=1, origin="base", name=None, mat=None,
                    location=(0, 0, 0), rotation_deg=0, collection=None):
        """A box of `size` (x, y, z) with bevelled edges (`bevel` in meters, 0 for none)."""
        sx, sy, sz = size
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
        if bevel > 0:
            limit = min(sx, sy, sz) * 0.45
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, limit), segments=segments,
                            profile=0.5, affect="EDGES", clamp_overlap=True)
        self._shift(bm, origin, sz / 2)
        return self._finish(bm, "box", name, mat, location, rotation_deg, collection)

    def box(self, size, **kw):
        """A sharp box (no bevel): for colliders, walk surfaces and distant filler."""
        return self.rounded_box(size, 0.0, **kw)

    def cylinder(self, radius, depth, *, verts=16, radius_top=None, bevel=0.0, origin="base", smooth=True,
                 cap=True, name=None, mat=None, location=(0, 0, 0), rotation_deg=0, collection=None):
        """A cylinder (or cone with `radius_top`) along Z."""
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts, radius1=radius,
                              radius2=radius if radius_top is None else radius_top, depth=depth)
        if bevel > 0:
            rim = [e for e in bm.edges if len(e.link_faces) == 2 and
                   any(len(f.verts) > 4 for f in e.link_faces)]
            bmesh.ops.bevel(bm, geom=rim, offset=bevel, segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
        self._shift(bm, origin, depth / 2)
        return self._finish(bm, "cyl", name, mat, location, rotation_deg, collection, smooth=smooth)

    def sphere(self, radius, *, segments=16, rings=8, smooth=True, name=None, mat=None, location=(0, 0, 0),
               rotation_deg=0, collection=None):
        """A UV sphere centered on its origin.

        Built with lathe(): bmesh.ops.create_uvsphere orders faces differently on each run.
        """
        profile = [(radius * math.sin(math.pi * i / rings), -radius * math.cos(math.pi * i / rings))
                   for i in range(rings + 1)]
        profile[0], profile[-1] = (0.0, -radius), (0.0, radius)
        obj = self.lathe(profile, segments=segments, smooth=False, name=name or self.ctx.auto_name("sphere"),
                         mat=mat, location=location, rotation_deg=rotation_deg, collection=collection)
        if smooth:
            obj.data.shade_smooth()
            obj.data.set_sharp_from_angle(angle=math.radians(80))
        return obj

    def lathe(self, profile, *, segments=16, start_deg=0.0, smooth=True, name=None, mat=None, location=(0, 0, 0),
              rotation_deg=0, collection=None):
        """Revolve `profile` [(r, z), ...] around Z. Points with r == 0 close the shape on the axis.

        `start_deg` rotates the first segment: with `segments=4, start_deg=45` the
        result is an axis-aligned square frustum whose half-side is r / sqrt(2).
        """
        if len(profile) < 2:
            raise ValueError("lathe needs at least two profile points")
        bm = bmesh.new()
        rings = []
        for r, z in profile:
            if r <= 1e-6:
                rings.append([bm.verts.new((0.0, 0.0, z))])
            else:
                a0 = math.radians(start_deg)
                rings.append([bm.verts.new((r * math.cos(a0 + 2 * math.pi * i / segments),
                                            r * math.sin(a0 + 2 * math.pi * i / segments), z))
                              for i in range(segments)])
        for a, b in zip(rings, rings[1:]):
            if len(a) == 1 and len(b) == 1:
                continue
            for i in range(segments):
                j = (i + 1) % segments
                if len(a) == 1:
                    bm.faces.new((a[0], b[i], b[j]))
                elif len(b) == 1:
                    bm.faces.new((a[i], b[0], a[j]))
                else:
                    bm.faces.new((a[i], b[i], b[j], a[j]))
        return self._finish(bm, "lathe", name, mat, location, rotation_deg, collection, smooth=smooth)

    def capsule(self, radius, length, *, segments=12, rings=3, name=None, mat=None, location=(0, 0, 0),
                rotation_deg=0, collection=None, origin="base"):
        """A capsule along Z: total height `length` (≥ 2·radius)."""
        body = max(length - 2 * radius, 0.0)
        profile = [(0.0, 0.0)]
        for i in range(1, rings + 1):
            a = -math.pi / 2 + (math.pi / 2) * i / rings
            profile.append((radius * math.cos(a), radius + radius * math.sin(a)))
        for i in range(0, rings):
            a = (math.pi / 2) * i / rings
            profile.append((radius * math.cos(a), radius + body + radius * math.sin(a)))
        profile.append((0.0, length))
        if origin == "center":
            profile = [(r, z - length / 2) for r, z in profile]
        return self.lathe(profile, segments=segments, name=name or self.ctx.auto_name("capsule"), mat=mat,
                          location=location, rotation_deg=rotation_deg, collection=collection)

    def extrude(self, polyline, depth, *, name=None, mat=None, location=(0, 0, 0), rotation_deg=0,
                collection=None, z=0.0):
        """Extrude a closed 2D polygon [(x, y), ...] upward by `depth` (from `z`)."""
        pts = [(float(p[0]), float(p[1])) for p in polyline]
        if len(pts) > 2 and pts[0] == pts[-1]:
            pts = pts[:-1]
        area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
                   for i in range(len(pts)))
        if area < 0:
            pts.reverse()
        bm = bmesh.new()  # faces built explicitly: extrude_face_region's face order varies between runs
        bottom = [bm.verts.new((x, y, z)) for x, y in pts]
        if depth > 0:
            top = [bm.verts.new((x, y, z + depth)) for x, y in pts]
            bm.faces.new(list(reversed(bottom)))
            bm.faces.new(top)
            for i in range(len(pts)):
                j = (i + 1) % len(pts)
                bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
        else:
            bm.faces.new(bottom)
        return self._finish(bm, "extrude", name, mat, location, rotation_deg, collection)

    def sweep(self, curve, profile, *, closed_profile=True, cap=True, smooth=False, up=(0, 0, 1), name=None,
              mat=None, location=(0, 0, 0), rotation_deg=0, collection=None):
        """Sweep a 2D `profile` [(u, v), ...] along a 3D `curve` [(x, y, z), ...].

        At each curve point, u runs along the horizontal side vector (tangent × up)
        and v along the local up vector. Good for eaves, rails, wires and trims.
        """
        if len(curve) < 2 or len(profile) < 2:
            raise ValueError("sweep needs at least two curve and two profile points")
        pts = [Vector(p) for p in curve]
        upv = Vector(up)
        bm = bmesh.new()
        rings = []
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            side = t.cross(upv)
            if side.length < 1e-6:
                side = t.cross(Vector((1, 0, 0)))
            side.normalize()
            vup = side.cross(t).normalized()
            rings.append([bm.verts.new(p + side * u + vup * v) for u, v in profile])
        n = len(profile)
        edges = n if closed_profile else n - 1
        for a, b in zip(rings, rings[1:]):
            for i in range(edges):
                j = (i + 1) % n
                bm.faces.new((a[i], a[j], b[j], b[i]))
        if cap and closed_profile and n >= 3:
            bm.faces.new(list(reversed(rings[0])))
            bm.faces.new(rings[-1])
        return self._finish(bm, "sweep", name, mat, location, rotation_deg, collection, smooth=smooth)

    # ---- composition -----------------------------------------------------------

    def instance(self, collection, transforms, *, linked=True, target=None, prefix=None):
        """Copy every object of `collection` once per transform.

        `transforms` is a list of (location, rotation_deg[, scale]) tuples applied
        relative to the collection's origin. Copies share mesh data when `linked`
        (cheap to export; the bake makes them single-user before merging).
        Copies are named `<name>_<NN>` and linked into `target` (default ctx.collection).
        Returns one list of new objects per transform.
        """
        source = list(collection.all_objects) if isinstance(collection, bpy.types.Collection) else list(collection)
        target = target or self.ctx.collection
        bpy.context.view_layer.update()  # matrix_world is stale until the depsgraph updates
        copies = []
        for idx, t in enumerate(transforms):
            loc, rot = t[0], t[1] if len(t) > 1 else 0
            scale = t[2] if len(t) > 2 else (1, 1, 1)
            m = matrix_from(loc, rot, scale)
            mapping = {}
            for obj in source:
                new = obj.copy()
                if obj.data is not None and not linked:
                    new.data = obj.data.copy()
                new.name = f"{obj.name}_{idx:02d}" if prefix is None else f"{prefix}_{obj.name}_{idx:02d}"
                target.objects.link(new)
                mapping[obj] = new
            for obj, new in mapping.items():
                if obj.parent in mapping:
                    new.parent = mapping[obj.parent]
                    new.matrix_parent_inverse = obj.matrix_parent_inverse.copy()
                else:
                    new.parent = None
                    new.matrix_world = m @ obj.matrix_world
            copies.append(list(mapping.values()))
        return copies

    def join(self, objects, name, *, origin=None):
        """Join mesh objects into one and return it.

        The result keeps the first object's origin, or sits at `origin` (a point in
        the objects' shared parent space) with its geometry moved to match. Use
        `origin` to set a pivot, for example the top of a bell.
        """
        objects = [o for o in objects if o is not None]
        for o in objects:
            if o.data.users > 1:
                o.data = o.data.copy()
        obj = ordered_join(objects)
        obj.name = name
        obj.data.name = name
        if origin is not None:
            o = Matrix.Translation(Vector(origin))
            obj.data.transform(o.inverted() @ obj.matrix_basis)
            obj.matrix_basis = o
        return obj
