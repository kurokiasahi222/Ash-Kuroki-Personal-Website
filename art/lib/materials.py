"""Palette materials (overview § 6.2 prefixes, § 6.8 colors).

Every material an art module uses comes from here, through `ctx`:

    ctx.mat("concrete")              MAT_concrete    static, baked later
    ctx.emit("lamp", 4)              EMIT_lamp       glows, strength kept on export
    ctx.dyn("vermilion")             DYN_vermilion   moving / code-animated
    ctx.glass("vending", 0.3)        GLASS_vending   transparent

`token` is a palette token. Pass `name=` to get a distinct material from the
same color (for example `ctx.emit("lamp", 2, name="lamp_dim")` → EMIT_lamp_dim).
Characters may pass a raw '#rrggbb' with an explicit `name` for colors the
palette doesn't have (skin, denim); everything else uses palette tokens only.
"""

import bpy

from . import palette as pal

BAKED_UV = "lightmap"


def _principled(mat):
    for node in mat.node_tree.nodes:
        if node.bl_idname == "ShaderNodeBsdfPrincipled":
            return node
    raise RuntimeError(f"{mat.name} has no Principled BSDF")


def principled(mat):
    """The material's Principled BSDF node, or None."""
    if not mat or not mat.node_tree:
        return None
    for node in mat.node_tree.nodes:
        if node.bl_idname == "ShaderNodeBsdfPrincipled":
            return node
    return None


class MaterialLibrary:
    def __init__(self, palette):
        self.palette = palette
        self._specs = {}  # material name → spec tuple, to catch conflicting reuse

    def color(self, token_or_hex, alpha=1.0):
        """Linear RGBA for a palette token or '#rrggbb'."""
        return pal.hex_to_linear(pal.resolve(self.palette, token_or_hex), alpha)

    def _get(self, name, spec, make):
        if name in self._specs:
            if self._specs[name] != spec:
                raise ValueError(f"material {name} already exists with {self._specs[name]}, asked for {spec}; pass name=")
            return bpy.data.materials[name]
        if name in bpy.data.materials:
            raise ValueError(f"material {name} exists outside the library")
        mat = bpy.data.materials.new(name)
        make(mat)
        self._specs[name] = spec
        return mat

    def _check_token(self, token, name):
        if token not in self.palette and name is None:
            raise ValueError(f"{token!r} is not a palette token (raw colors need an explicit name=)")

    def mat(self, token, *, name=None, roughness=0.85):
        self._check_token(token, name)
        color = self.color(token)

        def make(m):
            p = _principled(m)
            p.inputs["Base Color"].default_value = color
            p.inputs["Roughness"].default_value = roughness
            m.diffuse_color = color

        return self._get(f"MAT_{name or token}", ("mat", token, roughness), make)

    def emit(self, token, strength=3.0, *, name=None):
        if strength < 2.0:
            raise ValueError(f"EMIT_ strength must be ≥ 2 (overview § 6.2), got {strength}")
        self._check_token(token, name)
        color = self.color(token)

        def make(m):
            p = _principled(m)
            p.inputs["Base Color"].default_value = color
            p.inputs["Emission Color"].default_value = color
            p.inputs["Emission Strength"].default_value = strength
            p.inputs["Roughness"].default_value = 0.5
            m.diffuse_color = color

        return self._get(f"EMIT_{name or token}", ("emit", token, strength), make)

    def dyn(self, token, *, name=None, roughness=0.6, metallic=0.0):
        self._check_token(token, name)
        color = self.color(token)

        def make(m):
            p = _principled(m)
            p.inputs["Base Color"].default_value = color
            p.inputs["Roughness"].default_value = roughness
            p.inputs["Metallic"].default_value = metallic
            m.diffuse_color = color

        return self._get(f"DYN_{name or token}", ("dyn", token, roughness, metallic), make)

    def glass(self, tint, alpha=0.3, *, name=None):
        self._check_token(tint, name)
        color = self.color(tint)

        def make(m):
            p = _principled(m)
            p.inputs["Base Color"].default_value = color
            p.inputs["Alpha"].default_value = alpha
            p.inputs["Roughness"].default_value = 0.05
            m.diffuse_color = (*color[:3], alpha)
            m.surface_render_method = "BLENDED"
            m.use_backface_culling = False

        return self._get(f"GLASS_{name or tint}", ("glass", tint, alpha), make)


def baked_material(atlas, image):
    """`BAKED_<atlas>`: the baked texture, shadeless.

    A Background shader renders as plain emission in Cycles (so previews show the
    bake as-is) and the glTF exporter writes it as KHR_materials_unlit with the
    texture as baseColorTexture, which the web draws with MeshBasicMaterial.
    """
    name = f"BAKED_{atlas}"
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nt = mat.node_tree
    for node in list(nt.nodes):
        nt.nodes.remove(node)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = BAKED_UV
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Linear"
    bg = nt.nodes.new("ShaderNodeBackground")
    nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return mat


def emission_of(mat):
    """(linear rgb, strength) of an EMIT_ material, read from its Principled BSDF."""
    p = principled(mat)
    if p is None:
        return None
    c = p.inputs["Emission Color"].default_value
    return (float(c[0]), float(c[1]), float(c[2])), float(p.inputs["Emission Strength"].default_value)
