"""Blender scene setup: a clean file, Cycles on the CPU, AgX, world and bake lights."""

import math

import bpy

from . import palette as pal

PREVIEW_RESOLUTION = (960, 540)


def reset():
    """An empty scene with fixed settings, so every build starts the same."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 24
    scene.frame_start = 0
    scene.frame_end = 48
    scene.render.resolution_x, scene.render.resolution_y = PREVIEW_RESOLUTION
    scene.render.resolution_percentage = 100
    scene.unit_settings.system = "METRIC"
    color_management(scene)
    return scene


def color_management(scene):
    """AgX, matching THREE.AgXToneMapping on the web (overview § 6.2)."""
    scene.display_settings.display_device = "sRGB"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.sequencer_colorspace_settings.name = "sRGB"


def cycles(scene, samples, *, denoise=True):
    """Cycles on the CPU (bpy as a module has no GPU)."""
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.05
    scene.cycles.seed = 0
    scene.cycles.use_animated_seed = False
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 4
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.sample_clamp_indirect = 10.0
    scene.render.use_persistent_data = False
    scene.cycles.use_denoising = False
    if denoise:
        try:
            scene.cycles.denoiser = "OPENIMAGEDENOISE"
            scene.cycles.use_denoising = True
        except (TypeError, ValueError):  # a build without OpenImageDenoise
            pass
    color_management(scene)


def world(scene, color_hex, strength=1.0):
    """A plain-color sky."""
    w = scene.world or bpy.data.worlds.new("World")
    scene.world = w
    nt = w.node_tree
    bg = next(n for n in nt.nodes if n.bl_idname == "ShaderNodeBackground")
    bg.inputs["Color"].default_value = pal.hex_to_linear(color_hex)
    bg.inputs["Strength"].default_value = strength
    return w


def point_light(name, location, color_hex, watts, *, radius=0.15, collection=None):
    """A Blender point light. Used for baking and previews only: the exporter
    skips punctual lights, and the web gets `LIGHT_` empties instead."""
    data = bpy.data.lights.new(name, "POINT")
    data.energy = watts
    data.color = pal.hex_to_linear(color_hex)[:3]
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def sun_light(name, rotation_deg, color_hex, strength, *, angle_deg=5.0, collection=None):
    data = bpy.data.lights.new(name, "SUN")
    data.energy = strength
    data.color = pal.hex_to_linear(color_hex)[:3]
    data.angle = math.radians(angle_deg)
    obj = bpy.data.objects.new(name, data)
    obj.rotation_euler = [math.radians(v) for v in rotation_deg]
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def new_collection(name, parent=None):
    coll = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(coll)
    return coll
