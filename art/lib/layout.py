"""`art/layout.json` → world-space poses for every layout-owned node (overview § 6.9).

Pure Python (no bpy), so tools and tests can read resolved positions too:

    python art/lib/layout.py            # every node, Blender coordinates
    python art/lib/layout.py --three    # the same in three.js coordinates (x, z, -y)

Conventions (§ 6.1): Blender Z-up, +Y toward the tower. `rotation` and `facing`
are degrees about Z, and a facing of 0 looks along +Y. Landmark `empties` offsets
are in the landmark's frame, so they rotate with it.
"""

import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path

if __package__ in (None, ""):
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from lib import contract, paths  # noqa: E402
else:
    from . import contract, paths


@dataclass
class Node:
    """A resolved contract node: world location, Euler rotation (deg, XYZ), extras."""

    name: str
    location: tuple
    rotation_deg: tuple = (0.0, 0.0, 0.0)
    extras: dict = field(default_factory=dict)
    kind: str = "empty"  # "empty" | "camera"
    fov_deg: float | None = None


def rotate_z(xy, deg):
    a = math.radians(deg)
    x, y = xy[0], xy[1]
    return (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a))


def _xyz(p):
    return (float(p[0]), float(p[1]), float(p[2]) if len(p) > 2 else 0.0)


def look_rotation(position, target):
    """Blender camera Euler (deg) that looks from `position` at `target`, no roll."""
    dx, dy, dz = (target[i] - position[i] for i in range(3))
    yaw = math.degrees(math.atan2(-dx, dy))
    elevation = math.degrees(math.atan2(dz, math.hypot(dx, dy)))
    return (90.0 + elevation, 0.0, yaw)


class Layout:
    def __init__(self, data):
        self.data = data
        self.camera = data["camera"]
        self.landmarks = data["landmarks"]

    @classmethod
    def load(cls, path=None):
        with open(path or paths.LAYOUT, encoding="utf-8") as f:
            return cls(json.load(f))

    # ---- frames -------------------------------------------------------------

    def to_world(self, landmark_id, offset):
        """A landmark-relative offset → world (x, y, z)."""
        lm = self.landmarks[landmark_id]
        ox, oy, oz = _xyz(offset)
        rx, ry = rotate_z((ox, oy), lm.get("rotation", 0))
        px, py, pz = _xyz(lm["position"])
        return (px + rx, py + ry, pz + oz)

    def landmark_yaw(self, landmark_id, facing=0.0):
        return self.landmarks[landmark_id].get("rotation", 0) + facing

    # ---- nodes ----------------------------------------------------------------

    def landmark_empties(self):
        nodes = {}
        for lm_id, lm in self.landmarks.items():
            for name, spec in lm.get("empties", {}).items():
                extras = {}
                if name.startswith("ZONE_"):
                    extras["radius"] = spec["radius"]
                yaw = self.landmark_yaw(lm_id, spec.get("facing", 0))
                nodes[name] = Node(name, self.to_world(lm_id, spec["offset"]), (0.0, 0.0, yaw), extras)
        return nodes

    def spawns(self):
        return {
            name: Node(name, _xyz(s["position"]), (0.0, 0.0, float(s.get("facing", 0))))
            for name, s in self.data["spawns"].items()
        }

    def path(self):
        pts = self.data["path"]
        nodes = {}
        for i, p in enumerate(pts):
            nxt = pts[i + 1] if i + 1 < len(pts) else None
            prv = pts[i - 1] if i > 0 else None
            a, b = (p, nxt) if nxt else (prv, p)
            yaw = math.degrees(math.atan2(-(b[0] - a[0]), b[1] - a[1]))
            name = f"PATH_{i:02d}"
            nodes[name] = Node(name, _xyz(p), (0.0, 0.0, yaw))
        return nodes

    def lights(self):
        nodes = {}
        for name, s in self.data["lights"].items():
            extras = {"color": s["color"], "intensity": s["intensity"], "distance": s["distance"]}
            nodes[name] = Node(name, _xyz(s["position"]), extras=extras)
        return nodes

    def stand_poses(self):
        """Every pose a shot can name: SPAWN_* and STAND_*, as Nodes."""
        poses = dict(self.spawns())
        poses.update({k: v for k, v in self.landmark_empties().items() if k.startswith("STAND_")})
        return poses

    def gameplay_camera(self, pose_location):
        """The § 6.4 follow camera for a character at `pose_location`.

        Yaw is locked toward the tower (+Y), so the camera sits `behind` meters
        along -Y and `height` meters up, pitched down `pitchDeg`.
        """
        cam = self.camera
        x, y, z = pose_location
        location = (x, y - cam["behind"], z + cam["height"])
        return location, (90.0 - cam["pitchDeg"], 0.0, 0.0), float(cam["fovDeg"])

    def shots(self):
        shots = {}
        est = self.data["shots"]["establish"]
        pos = _xyz(est["position"])
        name = "CAM_shot_establish"
        shots[name] = Node(name, pos, look_rotation(pos, _xyz(est["target"])), kind="camera", fov_deg=float(est["fovDeg"]))
        poses = self.stand_poses()
        for shot, pose_name in self.data["shots"]["gameplay"].items():
            if contract.SHOT_POSES.get(shot) != pose_name:
                raise ValueError(f"layout.json: shot {shot!r} must frame {contract.SHOT_POSES.get(shot)}, not {pose_name}")
            loc, rot, fov = self.gameplay_camera(poses[pose_name].location)
            name = f"CAM_shot_{shot}"
            shots[name] = Node(name, loc, rot, kind="camera", fov_deg=fov)
        return shots

    def sweep(self):
        sw = self.data["sweep"]
        look = _xyz(sw["lookAt"])
        nodes = {}
        for i, p in enumerate(sw["points"]):
            loc = _xyz(p)
            yaw = look_rotation(loc, look)[2]  # empties face their look target along +Y
            name = f"CAM_sweep_{i:02d}"
            nodes[name] = Node(name, loc, (0.0, 0.0, yaw))
        return nodes

    def nodes(self):
        """Every node layout.json owns, keyed by name."""
        out = {}
        for group in (self.spawns(), self.path(), self.lights(), self.landmark_empties(), self.shots(), self.sweep()):
            for name, node in group.items():
                if name in out:
                    raise ValueError(f"layout.json: {name} is defined twice")
                out[name] = node
        if len(self.data["lights"]) > contract.MAX_LIGHTS:
            raise ValueError(f"layout.json: {len(self.data['lights'])} LIGHT_ entries, at most {contract.MAX_LIGHTS}")
        return out

    def check(self):
        """Layout sanity checks beyond the contract. Returns a list of problems."""
        problems = []
        pts = self.data["path"]
        for i in range(1, len(pts)):
            d = math.dist(pts[i - 1], pts[i])
            if not 6.0 <= d <= 8.0:
                problems.append(f"PATH_{i - 1:02d}→PATH_{i:02d} is {d:.2f} m (want 6–8 m)")
        names = set(self.nodes())
        for zid in contract.ZONE_IDS:
            if f"ZONE_{zid}" not in names:
                problems.append(f"missing ZONE_{zid}")
        for sid in contract.STAND_IDS:
            for prefix in ("STAND_", "LABEL_"):
                if f"{prefix}{sid}" not in names:
                    problems.append(f"missing {prefix}{sid}")
        for snd in contract.SND_NAMES:
            if snd not in names:
                problems.append(f"missing {snd}")
        return problems


def blender_to_three(p):
    return (p[0], p[2], -p[1])


def main(argv):
    three = "--three" in argv
    layout = Layout.load()
    rows = {}
    for name, node in sorted(layout.nodes().items()):
        loc = blender_to_three(node.location) if three else node.location
        row = {"location": [round(v, 4) for v in loc], "rotationDeg": [round(v, 3) for v in node.rotation_deg]}
        if node.extras:
            row["extras"] = node.extras
        if node.fov_deg is not None:
            row["fovDeg"] = node.fov_deg
        rows[name] = row
    print(json.dumps({"frame": "three" if three else "blender", "nodes": rows}, indent=2, ensure_ascii=False))
    problems = layout.check()
    for p in problems:
        print("layout check:", p, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
