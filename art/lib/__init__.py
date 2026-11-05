"""Shared machinery for the art pipeline (WP-02, overview § 6.9).

Pure-Python modules (no bpy): ``paths``, ``contract``, ``palette``, ``layout``.
Blender modules (import bpy): ``context``, ``materials``, ``geo``, ``text``,
``scene``, ``nodes``, ``bake``, ``export``, ``wayfinding`` and ``greybox``.

Keep this file free of bpy imports so ``validate.py`` stays fast.
"""
