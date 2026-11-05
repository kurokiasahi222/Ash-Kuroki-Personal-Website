"""Japanese signage text (`ctx.text_jp`) with Noto Sans JP (SIL OFL 1.1, overview § 6.8).

The font is downloaded once into `art/.cache/fonts/` from a pinned commit and
checked against its sha256. It is never committed; its license is in
`art/fonts/OFL.txt`. The downloaded file is only loaded as a font, never run.

Source: the static weights in notofonts/noto-cjk at the commit Google Fonts
cites as the source of its Noto Sans JP (google/fonts ofl/notosansjp/METADATA.pb).
Google Fonts' own file is a variable font whose default instance is Thin, and
Blender text objects can't pick a variable-font axis.
"""

import hashlib
import math
import os
import shutil
import subprocess
import urllib.request

import bpy
from mathutils import Matrix

from . import paths

NOTO_CJK_COMMIT = "523d033d6cb47f4a80c58a35753646f5c3608a78"
_BASE = f"https://raw.githubusercontent.com/notofonts/noto-cjk/{NOTO_CJK_COMMIT}/Sans/SubsetOTF/JP"
FONTS = {
    "bold": {
        "file": "NotoSansJP-Bold.otf",
        "url": f"{_BASE}/NotoSansJP-Bold.otf",
        "sha256": "1b0edfb500b73a4fa8a4fcaae1bbbd403994e08e73e3e0da37e70d3853f42c5f",
    },
    "regular": {
        "file": "NotoSansJP-Regular.otf",
        "url": f"{_BASE}/NotoSansJP-Regular.otf",
        "sha256": "dff723ba59d57d136764a04b9b2d03205544f7cd785a711442d6d2d085ac5073",
    },
}
FONT_DIR = paths.CACHE / "fonts"


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _download(url, dest):
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
            shutil.copyfileobj(r, f)
    except Exception as err:  # proxies/CA bundles vary; curl is the fallback
        if not shutil.which("curl"):
            raise RuntimeError(f"could not download {url}: {err}") from err
        subprocess.run(["curl", "-fsSL", "--retry", "3", "-o", str(tmp), url], check=True)
    os.replace(tmp, dest)


def ensure_font(weight="bold"):
    """Path to the cached font file, downloading and verifying it if needed."""
    spec = FONTS[weight]
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    dest = FONT_DIR / spec["file"]
    if not dest.exists() or _sha256(dest) != spec["sha256"]:
        print(f"[text] downloading {spec['file']} (pinned noto-cjk@{NOTO_CJK_COMMIT[:7]})")
        _download(spec["url"], dest)
        digest = _sha256(dest)
        if digest != spec["sha256"]:
            dest.unlink()
            raise RuntimeError(f"{spec['file']}: sha256 {digest} does not match the pinned {spec['sha256']}")
    return dest


def load_font(weight="bold"):
    return bpy.data.fonts.load(str(ensure_font(weight)), check_existing=True)


def text_jp(ctx, string, size, *, weight="bold", depth=0.0, align="CENTER", upright=True, resolution=3,
            name=None, mat=None, location=(0, 0, 0), rotation_deg=0, collection=None):
    """Text as a mesh object, in Noto Sans JP.

    size      em size in meters (roughly the height of a kanji)
    depth     total thickness; 0 makes flat text
    align     'LEFT' | 'CENTER' | 'RIGHT' (horizontal; the baseline sits at z = 0)
    upright   True: stands in the XZ plane facing -Y, like a sign on a prop's front.
              False: lies flat in XY facing up, like a road marking.
    """
    from .geo import euler_deg

    name = name or ctx.auto_name("text")
    curve = bpy.data.curves.new(name + "_curve", type="FONT")
    curve.body = string
    curve.font = load_font(weight)
    curve.size = size
    curve.extrude = depth / 2.0
    curve.align_x = align
    curve.align_y = "BOTTOM_BASELINE"
    curve.resolution_u = resolution
    curve.fill_mode = "BOTH" if depth > 0 else "FRONT"
    tmp = bpy.data.objects.new(name + "_tmp", curve)
    bpy.context.scene.collection.objects.link(tmp)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(depsgraph))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(curve)
    me.name = name
    if upright:
        me.transform(Matrix.Rotation(math.radians(90), 4, "X"))
    obj = bpy.data.objects.new(name, me)
    if mat is not None:
        me.materials.clear()
        me.materials.append(mat)
    obj.location = location
    obj.rotation_euler = [math.radians(v) for v in euler_deg(rotation_deg)]
    (collection or ctx.collection).objects.link(obj)
    return obj
