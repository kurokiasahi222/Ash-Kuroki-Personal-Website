"""The glTF naming contract (overview § 6.2, § 6.3) and budgets (§ 7), as data.

Pure Python, so `validate.py` and the Blender builders share one definition.
"""

import re

SECTION_IDS = ("builds", "about", "sayhi")
INTERACTION_IDS = ("vending", "bell")
ZONE_IDS = ("builds", "about", "sayhi", "vending", "bell", "door")
STAND_IDS = ("builds", "about", "sayhi", "vending", "bell")
LABEL_IDS = STAND_IDS

SPAWNS = ("SPAWN_start", "SPAWN_tower_exit")
ANIM_NAMES = ("ANIM_bell", "ANIM_bell_striker", "ANIM_vending_can", "ANIM_konbini_door")
SND_NAMES = ("SND_vending_hum", "SND_konbini", "SND_bell")

STREET_SHOTS = ("establish", "start", "vending", "konbini", "gate", "bell", "tower-base")
DECK_SHOTS = ("deck",)

# § 6.2: the gameplay shots and the character pose each one frames.
SHOT_POSES = {
    "start": "SPAWN_start",
    "vending": "STAND_vending",
    "konbini": "STAND_builds",
    "gate": "STAND_about",
    "bell": "STAND_bell",
    "tower-base": "STAND_sayhi",
}

MAX_LIGHTS = 8

# § 6.3
BONES = (
    "hips", "spine", "chest", "neck", "head",
    "upper_arm.L", "upper_arm.R", "forearm.L", "forearm.R", "hand.L", "hand.R",
    "thigh.L", "thigh.R", "shin.L", "shin.R", "foot.L", "foot.R",
)  # fmt: skip
CLIPS = ("idle", "walk", "interact")
UMBRELLA = "UMBRELLA"
UMBRELLA_BONE = "hand.R"

# § 6.9: which prop carries which named objects. WP-12 adds extras.swingAxis.
PROP_ANIMS = {
    "vending_row": ("ANIM_vending_can",),
    "konbini": ("ANIM_konbini_door",),
    "bell_tower": ("ANIM_bell", "ANIM_bell_striker"),
}
SWING_ANIMS = ("ANIM_bell", "ANIM_bell_striker")
SWING_AXES = ("x", "y")

SHIPPED_MATERIAL_PREFIXES = ("BAKED_", "EMIT_", "DYN_", "GLASS_")
PROP_MATERIAL_PREFIXES = ("MAT_", "EMIT_", "DYN_", "GLASS_")
CHARACTER_MATERIAL_PREFIXES = ("DYN_", "GLASS_")
EMIT_MIN_STRENGTH = 2.0

# Node-name prefixes that carry meaning for code. Objects with these names (and
# their descendants) are never merged, renamed or flattened by the pipeline.
NODE_PREFIXES = (
    "SPAWN_", "ZONE_", "STAND_", "LABEL_", "PATH_", "COL_", "WALK_", "PUDDLE_",
    "LIGHT_", "REFL_", "ANIM_", "SND_", "CAM_shot_", "CAM_sweep_",
)  # fmt: skip
HIDDEN_PREFIXES = ("COL_", "WALK_")  # in the file for physics/raycasts, never drawn
EMPTY_PREFIXES = (
    "SPAWN_", "ZONE_", "STAND_", "LABEL_", "PATH_", "LIGHT_", "REFL_", "SND_", "CAM_sweep_",
)  # fmt: skip
MESH_PREFIXES = ("COL_", "WALK_", "PUDDLE_")

# three.js' GLTFLoader strips these from node names (PropertyBinding.sanitizeNodeName),
# so contract names must not contain them. Bone names are the § 6.3 exception.
THREE_UNSAFE = re.compile(r"[\[\]\.:/\s]")

# § 7. 1 MB = 1,000,000 bytes (the stricter reading). Triangle limits are the
# per-frame budgets, applied to everything a file draws. `ash` uses WP-13's 8k cap.
BUDGETS = {
    "street": {"bytes": 5_000_000, "tris": 400_000},
    "street-low": {"bytes": 2_500_000, "tris": 200_000},
    "deck": {"bytes": 2_000_000, "tris": 400_000},
    "deck-low": {"bytes": 1_000_000, "tris": 200_000},
    "ash": {"bytes": 800_000, "tris": 8_000},
}
# Draw calls are reported, not enforced: § 7 allows 150 (high) / 90 (low) per
# frame for everything, including the character (≤ 6) and effects (≤ 20 / 10).
DRAW_CALL_BUDGETS = {"high": 150 - 6 - 20, "low": 90 - 6 - 10}

HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


def is_contract_name(name):
    return name.startswith(NODE_PREFIXES) or name == UMBRELLA


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def extras_errors(name, extras):
    """Errors in the `extras` a contract node must carry (§ 6.2). [] when fine."""
    extras = extras or {}
    errors = []

    def need_num(key, positive=True):
        v = extras.get(key)
        if not _num(v):
            errors.append(f"{name}: extras.{key} must be a number, got {v!r}")
        elif positive and v <= 0:
            errors.append(f"{name}: extras.{key} must be > 0, got {v!r}")

    def need_color():
        v = extras.get("color")
        if not (isinstance(v, str) and HEX_COLOR.match(v)):
            errors.append(f"{name}: extras.color must be '#rrggbb', got {v!r}")

    if name.startswith("ZONE_"):
        need_num("radius")
    elif name.startswith("LIGHT_"):
        need_color()
        need_num("intensity")
        need_num("distance")
    elif name.startswith("REFL_"):
        need_color()
        need_num("length")
    if name in SWING_ANIMS and extras.get("swingAxis") not in SWING_AXES:
        errors.append(f"{name}: extras.swingAxis must be 'x' or 'y', got {extras.get('swingAxis')!r}")
    return errors
