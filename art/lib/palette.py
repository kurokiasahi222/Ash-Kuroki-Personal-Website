"""Palette loading (overview § 6.8). Hex values are sRGB; Blender wants linear."""

import json
import re

from . import paths

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def load(path=None):
    with open(path or paths.PALETTE, encoding="utf-8") as f:
        data = json.load(f)
    for token, value in data.items():
        if not HEX_RE.match(value):
            raise ValueError(f"palette.json: {token} = {value!r} is not #rrggbb")
    return data


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_srgb(value):
    if not HEX_RE.match(value):
        raise ValueError(f"{value!r} is not a #rrggbb color")
    return tuple(int(value[i : i + 2], 16) / 255.0 for i in (1, 3, 5))


def hex_to_linear(value, alpha=1.0):
    r, g, b = (srgb_to_linear(c) for c in hex_to_srgb(value))
    return (r, g, b, alpha)


def resolve(palette, token_or_hex):
    """A palette token ('lamp') or a raw '#rrggbb' → '#rrggbb'."""
    if token_or_hex in palette:
        return palette[token_or_hex]
    if HEX_RE.match(token_or_hex):
        return token_or_hex.upper()
    raise KeyError(f"{token_or_hex!r} is neither a palette token nor #rrggbb")
