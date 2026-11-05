#!/usr/bin/env python3
"""Check a .glb against the naming contract (overview § 6.2, § 6.3) and budgets (§ 7).

    python art/validate.py public/models/street.glb            target inferred from the name
    python art/validate.py public/models/ash.glb --target ash
    python art/validate.py art/out/prop-konbini.glb --target prop --max-tris 10000
    python art/validate.py public/models/street.glb --self-test   broken copies must fail
    python art/validate.py public/models/street.glb --json out.json   machine-readable summary

Prints a PASS/FAIL list and exits 1 on any failure. Validate the optimized
files: gltf-transform's defaults merge and rename meshes, and build.py's
settings exist to stop that, so check what was actually written.
"""

import argparse
import copy
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
ART = Path(__file__).resolve().parent
if str(ART) not in sys.path:
    sys.path.insert(0, str(ART))

from lib import contract as C  # noqa: E402

TARGETS = ("street", "deck", "ash", "prop")


# ---- loading ------------------------------------------------------------------------


def load(path):
    import pygltflib

    g = pygltflib.GLTF2().load(str(path))
    return json.loads(g.gltf_to_json()), Path(path).stat().st_size


def infer(path):
    stem = Path(path).stem
    if stem.endswith(".raw"):
        stem = stem[: -len(".raw")]
    if stem.startswith("prop-"):
        return "prop", stem, stem[len("prop-"):]
    base = stem[: -len("-low")] if stem.endswith("-low") else stem
    return (base if base in TARGETS else None), stem, None


# ---- model ------------------------------------------------------------------------------


class Model:
    def __init__(self, doc):
        self.doc = doc
        self.nodes = doc.get("nodes", [])
        self.parent = {}
        for i, n in enumerate(self.nodes):
            for c in n.get("children", []):
                self.parent[c] = i
        scenes = doc.get("scenes", [])
        self.roots = scenes[doc.get("scene", 0)].get("nodes", []) if scenes else []
        self.reachable = set()
        stack = list(self.roots)
        while stack:
            i = stack.pop()
            if i in self.reachable:
                continue
            self.reachable.add(i)
            stack += self.nodes[i].get("children", [])
        self.joints = {j for s in doc.get("skins", []) for j in s.get("joints", [])}
        self.by_name = {}
        for i in sorted(self.reachable):
            self.by_name.setdefault(self.nodes[i].get("name", ""), []).append(i)

    def name(self, i):
        return self.nodes[i].get("name", "")

    def ancestors(self, i):
        while i in self.parent:
            i = self.parent[i]
            yield i

    def find(self, name):
        hits = self.by_name.get(name, [])
        return hits[0] if hits else None

    def named(self, prefix):
        return sorted((n, ids[0]) for n, ids in self.by_name.items() if n.startswith(prefix))

    def is_empty(self, i):
        n = self.nodes[i]
        return "mesh" not in n and "camera" not in n and "skin" not in n

    def has_mesh_below(self, i):
        stack = [i]
        while stack:
            j = stack.pop()
            if "mesh" in self.nodes[j]:
                return True
            stack += self.nodes[j].get("children", [])
        return False

    def hidden(self, i):
        return any(self.name(j).startswith(C.HIDDEN_PREFIXES) for j in [i, *self.ancestors(i)])

    def primitive_tris(self, prim):
        acc = self.doc.get("accessors", [])
        mode = prim.get("mode", 4)
        if "indices" in prim:
            count = acc[prim["indices"]]["count"]
        else:
            count = acc[prim["attributes"]["POSITION"]]["count"]
        if mode == 4:
            return count // 3
        if mode in (5, 6):
            return max(count - 2, 0)
        return 0

    def drawn(self):
        """(node index, primitive) for every primitive that renders."""
        meshes = self.doc.get("meshes", [])
        for i in sorted(self.reachable):
            n = self.nodes[i]
            if "mesh" in n and not self.hidden(i):
                for prim in meshes[n["mesh"]].get("primitives", []):
                    yield i, prim

    def triangles(self):
        return sum(self.primitive_tris(p) for _, p in self.drawn())


# ---- report -------------------------------------------------------------------------------


class Report:
    def __init__(self):
        self.rows = []

    def check(self, ok, label, detail=""):
        self.rows.append((bool(ok), label, detail))
        return ok

    def info(self, label, detail=""):
        self.rows.append((None, label, detail))

    @property
    def failed(self):
        return [r for r in self.rows if r[0] is False]

    def lines(self):
        for ok, label, detail in self.rows:
            tag = "INFO" if ok is None else ("PASS" if ok else "FAIL")
            yield f"  {tag}  {label}" + (f": {detail}" if detail else "")


# ---- checks -------------------------------------------------------------------------------


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def check_names(m, r):
    contract_nodes = [(n, ids) for n, ids in m.by_name.items() if C.is_contract_name(n)]
    dupes = [n for n, ids in contract_nodes if len(ids) > 1]
    r.check(not dupes, "contract node names are unique", ", ".join(dupes))
    bad = [n for n, ids in contract_nodes if C.THREE_UNSAFE.search(n) and not set(ids) & m.joints]
    r.check(not bad, "contract node names survive three.js (no '.', ':', '/', '[', ']' or spaces)", ", ".join(bad))


def check_empty_group(m, r, label, names, required=True):
    missing = [n for n in names if m.find(n) is None]
    if required:
        r.check(not missing, f"{label} present", ", ".join(missing) if missing else ", ".join(names))
    not_empty = [n for n in names if m.find(n) is not None and not m.is_empty(m.find(n))]
    r.check(not not_empty, f"{label} are empties", ", ".join(not_empty))


def check_ids(m, r, prefix, ids):
    found = [n for n, _ in m.named(prefix)]
    unknown = [n for n in found if n[len(prefix):] not in ids]
    r.check(not unknown, f"{prefix}* ids are known ({', '.join(ids)})", ", ".join(unknown))


def check_sequence(m, r, prefix, minimum=2, empties=True):
    found = [n for n, _ in m.named(prefix)]
    expected = [f"{prefix}{i:02d}" for i in range(len(found))]
    ok = len(found) >= minimum and sorted(found) == expected
    r.check(ok, f"{prefix}00..nn contiguous (≥ {minimum})", f"{len(found)} found" if ok else f"found {found}")
    if empties:
        bad = [n for n in found if not m.is_empty(m.find(n))]
        r.check(not bad, f"{prefix}* are empties", ", ".join(bad))


def check_extras(m, r, prefix, label):
    errors = []
    for n, i in m.named(prefix):
        errors += C.extras_errors(n, m.nodes[i].get("extras"))
    r.check(not errors, f"{label} extras", "; ".join(errors))


def check_meshes(m, r, prefix, minimum=1):
    found = m.named(prefix)
    bad = [n for n, i in found if "mesh" not in m.nodes[i]]
    r.check(len(found) >= minimum and not bad, f"{prefix}* meshes (≥ {minimum})",
            f"{len(found)} found" + (f"; not meshes: {', '.join(bad)}" if bad else ""))


def check_lights(m, r, minimum=0):
    lights = m.named("LIGHT_")
    r.check(minimum <= len(lights) <= C.MAX_LIGHTS, f"LIGHT_* count {minimum}..{C.MAX_LIGHTS}", str(len(lights)))
    bad = [n for n, i in lights if not m.is_empty(i)]
    r.check(not bad, "LIGHT_* are empties", ", ".join(bad))
    check_extras(m, r, "LIGHT_", "LIGHT_* {color, intensity, distance}")


def check_shots(m, r, shots):
    cams = m.doc.get("cameras", [])
    missing, bad = [], []
    for s in shots:
        i = m.find(f"CAM_shot_{s}")
        if i is None:
            missing.append(s)
            continue
        cam = cams[m.nodes[i]["camera"]] if "camera" in m.nodes[i] else None
        yfov = (cam or {}).get("perspective", {}).get("yfov")
        if cam is None or cam.get("type") != "perspective" or not (_num(yfov) and 0 < yfov < math.pi):
            bad.append(s)
    r.check(not missing, f"CAM_shot_* listed ({', '.join(shots)})", ", ".join(missing))
    r.check(not bad, "CAM_shot_* are perspective cameras", ", ".join(bad))


def check_anims(m, r, names):
    check_ids(m, r, "ANIM_", [n[len("ANIM_"):] for n in C.ANIM_NAMES])
    missing = [n for n in names if m.find(n) is None]
    r.check(not missing, f"ANIM_* present ({', '.join(names)})", ", ".join(missing))
    no_mesh = [n for n in names if m.find(n) is not None and not m.has_mesh_below(m.find(n))]
    r.check(not no_mesh, "ANIM_* carry geometry", ", ".join(no_mesh))
    errors = []
    for n in names:
        if n in C.SWING_ANIMS and m.find(n) is not None:
            errors += C.extras_errors(n, m.nodes[m.find(n)].get("extras"))
    if any(n in C.SWING_ANIMS for n in names):
        r.check(not errors, "ANIM_bell / ANIM_bell_striker extras.swingAxis ('x' | 'y')", "; ".join(errors))


def check_materials(m, r, allowed, *, require_glass=False):
    mats = m.doc.get("materials", [])
    names = [mt.get("name", "") for mt in mats]
    bad = [n or "<unnamed>" for n in names if not n.startswith(allowed)]
    r.check(not bad, f"material names use {'/'.join(p.rstrip('_') for p in allowed)}_",
            ", ".join(bad) if bad else f"{len(names)} materials")
    if "MAT_" not in allowed:
        leftover = [n for n in names if n.startswith("MAT_")]
        r.check(not leftover, "no MAT_* materials (bake them)", ", ".join(leftover))
    weak = []
    for mt in mats:
        if mt.get("name", "").startswith("EMIT_"):
            ext = mt.get("extensions", {}).get("KHR_materials_emissive_strength", {})
            s = ext.get("emissiveStrength", 1.0)
            if not (_num(s) and s >= C.EMIT_MIN_STRENGTH and max(mt.get("emissiveFactor", [0, 0, 0])) > 0):
                weak.append(f"{mt.get('name')} ({s})")
    r.check(not weak, f"EMIT_* emissive strength ≥ {C.EMIT_MIN_STRENGTH:g}", ", ".join(weak))
    opaque = [mt.get("name") for mt in mats if mt.get("name", "").startswith("GLASS_") and mt.get("alphaMode") != "BLEND"]
    r.check(not opaque, "GLASS_* are transparent (alphaMode BLEND)", ", ".join(opaque))
    untextured = [mt.get("name") for mt in mats if mt.get("name", "").startswith("BAKED_")
                  and "baseColorTexture" not in mt.get("pbrMetallicRoughness", {})]
    r.check(not untextured, "BAKED_* carry their baked texture", ", ".join(untextured))
    nomat = sorted({m.name(i) for i, p in m.drawn() if "material" not in p})
    r.check(not nomat, "every drawn primitive has a material", ", ".join(nomat))
    if require_glass:
        r.check(any(n.startswith("GLASS_") for n in names), "a GLASS_ material (umbrella canopy)")


def check_budget(m, r, size, budget_key, max_tris=None):
    tris = m.triangles()
    calls = sum(1 for _ in m.drawn())
    b = C.BUDGETS.get(budget_key)
    if b:
        r.check(size <= b["bytes"], f"file size ≤ {b['bytes'] / 1e6:g} MB", f"{size / 1e6:.3f} MB")
        r.check(tris <= b["tris"], f"triangles ≤ {b['tris']:,}", f"{tris:,}")
    if max_tris is not None:
        r.check(tris <= max_tris, f"triangles ≤ --max-tris {max_tris:,}", f"{tris:,}")
    if not b and max_tris is None:
        r.info("triangles", f"{tris:,}")
    tier = "low" if budget_key.endswith("-low") else "high"
    if budget_key in ("street", "street-low", "deck", "deck-low"):
        r.info(f"draw calls (primitives drawn; § 7 {tier}-tier share ≈ {C.DRAW_CALL_BUDGETS[tier]})", str(calls))
    else:
        r.info("draw calls (primitives drawn)", str(calls))
    return tris, calls


def check_street(m, r):
    check_empty_group(m, r, "SPAWN_start, SPAWN_tower_exit", C.SPAWNS)
    check_ids(m, r, "ZONE_", C.ZONE_IDS)
    check_empty_group(m, r, "ZONE_*", [f"ZONE_{i}" for i in C.ZONE_IDS])
    check_extras(m, r, "ZONE_", "ZONE_* extras.radius")
    check_ids(m, r, "STAND_", C.STAND_IDS)
    check_empty_group(m, r, "STAND_*", [f"STAND_{i}" for i in C.STAND_IDS])
    check_ids(m, r, "LABEL_", C.LABEL_IDS)
    check_empty_group(m, r, "LABEL_*", [f"LABEL_{i}" for i in C.LABEL_IDS])
    check_sequence(m, r, "PATH_")
    check_meshes(m, r, "COL_")
    check_meshes(m, r, "WALK_")
    check_meshes(m, r, "PUDDLE_")
    check_lights(m, r, minimum=1)
    check_empty_group(m, r, "REFL_*", [n for n, _ in m.named("REFL_")], required=False)
    check_extras(m, r, "REFL_", "REFL_* {color, length}")
    check_anims(m, r, C.ANIM_NAMES)
    check_ids(m, r, "SND_", [n[len("SND_"):] for n in C.SND_NAMES])
    check_empty_group(m, r, "SND_*", C.SND_NAMES)
    check_shots(m, r, C.STREET_SHOTS)
    check_sequence(m, r, "CAM_sweep_")
    check_materials(m, r, C.SHIPPED_MATERIAL_PREFIXES)


def check_deck(m, r):
    check_shots(m, r, C.DECK_SHOTS)
    check_lights(m, r)
    check_extras(m, r, "REFL_", "REFL_* {color, length}")
    check_materials(m, r, C.SHIPPED_MATERIAL_PREFIXES)


def check_ash(m, r):
    skins = m.doc.get("skins", [])
    r.check(len(skins) >= 1, "a skinned armature", f"{len(skins)} skin(s)")
    joint_names = [m.name(j) for j in sorted(m.joints)]
    missing = sorted(set(C.BONES) - set(joint_names))
    extra = sorted(set(joint_names) - set(C.BONES))
    r.check(not missing and not extra and len(joint_names) == len(C.BONES), "bones are exactly § 6.3",
            (f"missing {missing} " if missing else "") + (f"unexpected {extra}" if extra else ""))
    u = m.find(C.UMBRELLA)
    parent = m.name(m.parent[u]) if u is not None and u in m.parent else None
    r.check(u is not None and m.has_mesh_below(u), "UMBRELLA mesh present")
    r.check(parent == C.UMBRELLA_BONE, f"UMBRELLA parented to {C.UMBRELLA_BONE}", f"parent {parent}")
    anims = {a.get("name"): a for a in m.doc.get("animations", [])}
    r.check(set(anims) == set(C.CLIPS), f"clips are exactly {', '.join(C.CLIPS)}", ", ".join(sorted(anims)))
    acc = m.doc.get("accessors", [])

    def duration(a):
        return max((acc[s["input"]].get("max", [0])[0] for s in a.get("samplers", [])), default=0.0)

    for clip in C.CLIPS:
        if clip in anims:
            r.info(f"clip {clip}", f"{duration(anims[clip]):.2f} s, {len(anims[clip].get('channels', []))} channels")
    if "interact" in anims:
        d = duration(anims["interact"])
        r.check(0.5 <= d <= 1.6, "interact is about 1 s (0.5–1.6)", f"{d:.2f} s")
    r.check(len(m.roots) == 1, "one root node", ", ".join(m.name(i) for i in m.roots))
    extras = m.nodes[m.roots[0]].get("extras", {}) if m.roots else {}
    ws = extras.get("walkSpeed")
    r.check(_num(ws) and ws > 0, "root extras.walkSpeed (m/s > 0)", repr(ws))
    ft = extras.get("footstepTimes")
    ok = isinstance(ft, list) and ft and all(_num(t) and 0 <= t <= 1 for t in ft)
    r.check(ok, "root extras.footstepTimes (normalized times)", repr(ft))
    check_materials(m, r, C.CHARACTER_MATERIAL_PREFIXES, require_glass=True)


def check_prop(m, r, prop):
    check_materials(m, r, C.PROP_MATERIAL_PREFIXES)
    banned = [n for n in m.by_name if n.startswith(("SPAWN_", "ZONE_", "STAND_", "LABEL_", "PATH_", "LIGHT_", "SND_",
                                                     "CAM_", "WALK_"))]
    r.check(not banned, "no layout-owned nodes (the assembler places those)", ", ".join(banned))
    if prop:
        cols = m.named("COL_")
        own = [n for n, _ in cols if n.startswith(f"COL_{prop}_")]
        r.check(own and len(own) == len(cols), f"COL_{prop}_* colliders", ", ".join(n for n, _ in cols) or "none")
        stray = []
        for n, ids in m.by_name.items():
            i = ids[0]
            if "mesh" not in m.nodes[i] or C.is_contract_name(n):
                continue
            if any(m.name(a).startswith("ANIM_") for a in m.ancestors(i)):
                continue
            if not n.startswith(f"{prop}_"):
                stray.append(n)
        r.check(not stray, f"mesh names are {prop}_<part>", ", ".join(sorted(stray)[:12]))
        needs = C.PROP_ANIMS.get(prop, ())
        if needs:
            check_anims(m, r, needs)
    check_extras(m, r, "REFL_", "REFL_* {color, length}")


def check(doc, size, target, variant, *, max_tris=None, prop=None):
    m = Model(doc)
    r = Report()
    check_names(m, r)
    if target == "street":
        check_street(m, r)
    elif target == "deck":
        check_deck(m, r)
    elif target == "ash":
        check_ash(m, r)
    elif target == "prop":
        check_prop(m, r, prop)
    key = variant if variant in C.BUDGETS else target
    tris, calls = check_budget(m, r, size, key, max_tris)
    return r, {"nodes": sorted(n for n in m.by_name), "triangles": tris, "drawCalls": calls, "bytes": size}


# ---- self-test ----------------------------------------------------------------------------------


def _rename(doc, old, new):
    for n in doc["nodes"]:
        if n.get("name") == old:
            n["name"] = new
            return True
    return False


def _first(doc, prefix):
    return next(n for n in doc["nodes"] if n.get("name", "").startswith(prefix))


def mutations(target):
    def drop_extra(name, key):
        def f(d):
            node = next(n for n in d["nodes"] if n.get("name") == name)
            node.get("extras", {}).pop(key, None)
        return f

    def add_lights(d):
        for i in range(C.MAX_LIGHTS + 1):
            d["nodes"].append({"name": f"LIGHT_extra{i}", "extras": {"color": "#FFFFFF", "intensity": 1, "distance": 2}})
            d["scenes"][d.get("scene", 0)]["nodes"].append(len(d["nodes"]) - 1)

    def mat_leak(d):
        d["materials"][0]["name"] = "MAT_concrete"

    common = [("a MAT_ material left unbaked", mat_leak)]
    if target == "street":
        return common + [
            ("SPAWN_start missing", lambda d: _rename(d, "SPAWN_start", "spawn")),
            ("CAM_shot_start missing", lambda d: _rename(d, "CAM_shot_start", "cam")),
            ("ZONE_bell radius is a string", lambda d: _first(d, "ZONE_bell")["extras"].update(radius="2.6")),
            ("an unknown ZONE_ id", lambda d: _rename(d, "ZONE_door", "ZONE_doors")),
            ("PATH_01 missing (gap)", lambda d: _rename(d, "PATH_01", "PATH_99")),
            ("nine more LIGHT_ empties", add_lights),
            ("LIGHT_ color not #rrggbb", lambda d: _first(d, "LIGHT_")["extras"].update(color="orange")),
            ("ANIM_bell missing", lambda d: _rename(d, "ANIM_bell", "bell")),
            ("ANIM_bell swingAxis missing", drop_extra("ANIM_bell", "swingAxis")),
            ("a duplicate contract name", lambda d: _rename(d, "STAND_bell", "STAND_about")),
            ("a three.js-unsafe name", lambda d: _rename(d, "SND_bell", "SND_bell.001")),
            ("EMIT_ strength below 2", lambda d: next(mt for mt in d["materials"] if mt["name"].startswith("EMIT_"))
             .setdefault("extensions", {}).update(KHR_materials_emissive_strength={"emissiveStrength": 1.0})),
        ]
    if target == "deck":
        return common + [("CAM_shot_deck missing", lambda d: _rename(d, "CAM_shot_deck", "cam"))]
    if target == "ash":
        def reparent_umbrella(d):
            u = next(i for i, n in enumerate(d["nodes"]) if n.get("name") == C.UMBRELLA)
            for n in d["nodes"]:
                if u in n.get("children", []):
                    n["children"].remove(u)
            d["nodes"][0].setdefault("children", []).append(u) if d["nodes"][0].get("name") != C.UMBRELLA else None
        return [
            ("a bone renamed", lambda d: _rename(d, "forearm.L", "forearm_L")),
            ("a clip renamed", lambda d: d["animations"][0].update(name="Idle")),
            ("walkSpeed missing", lambda d: d["nodes"][d["scenes"][0]["nodes"][0]].get("extras", {}).pop("walkSpeed")),
            ("footstepTimes out of range", lambda d: d["nodes"][d["scenes"][0]["nodes"][0]]["extras"]
             .update(footstepTimes=[0.0, 1.5])),
            ("UMBRELLA not under hand.R", reparent_umbrella),
            ("a BAKED_ material on the character", lambda d: d["materials"][0].update(name="BAKED_ash")),
        ]
    if target == "prop":
        return [
            ("a BAKED_ material in a prop", lambda d: d["materials"][0].update(name="BAKED_prop")),
            ("a collider named for another prop", lambda d: _rename(d, _first(d, "COL_")["name"], "COL_other_box")),
            ("a layout-owned node in a prop", lambda d: _rename(d, _first(d, "REFL_")["name"], "SPAWN_start")),
        ]
    return common


def self_test(doc, size, target, variant, prop, log):
    base, _ = check(doc, size, target, variant, prop=prop)
    if base.failed:
        log("self-test needs a file that passes first")
        return 1
    bad = 0
    for label, fn in mutations(target):
        d = copy.deepcopy(doc)
        fn(d)
        r, _ = check(d, size, target, variant, prop=prop)
        caught = bool(r.failed)
        bad += not caught
        log(f"  {'PASS' if caught else 'FAIL'}  broken copy ({label}) fails" +
            (f": {r.failed[0][1]}" if caught else ": it passed"))
    if target != "prop":  # props have no file-size budget
        oversized, _ = check(doc, 10**9, target, variant, prop=prop)
        caught = bool(oversized.failed)
        bad += not caught
        log(f"  {'PASS' if caught else 'FAIL'}  broken copy (1 GB file) fails")
    return 1 if bad else 0


# ---- entry points --------------------------------------------------------------------------------


def run(path, *, target=None, max_tris=None, prop=None, log=print, json_out=None, selftest=False):
    path = Path(path)
    t, variant, inferred_prop = infer(path)
    target = target or t
    prop = prop or inferred_prop
    if target not in TARGETS:
        log(f"{path}: can't infer the target; pass --target {'|'.join(TARGETS)}")
        return 2
    doc, size = load(path)
    log(f"validate {path.name} (target {target}{', prop ' + prop if prop else ''})")
    if selftest:
        return self_test(doc, size, target, variant, prop, log)
    r, summary = check(doc, size, target, variant, max_tris=max_tris, prop=prop)
    for line in r.lines():
        log(line)
    n_fail = len(r.failed)
    n_pass = sum(1 for row in r.rows if row[0])
    log(f"{path.name}: {'PASS' if not n_fail else 'FAIL'} ({n_pass} passed, {n_fail} failed)")
    if json_out:
        summary.update(target=target, variant=variant, passed=not n_fail)
        Path(json_out).write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return 1 if n_fail else 0


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("glb", nargs="+")
    p.add_argument("--target", choices=TARGETS)
    p.add_argument("--max-tris", type=int)
    p.add_argument("--prop", help="prop name for --target prop (default: from prop-<name>.glb)")
    p.add_argument("--json", help="write a summary (node names, triangles, draw calls, bytes) here")
    p.add_argument("--self-test", action="store_true", help="check that broken copies of this (valid) file fail")
    a = p.parse_args(argv)
    code = 0
    for g in a.glb:
        code = max(code, run(g, target=a.target, max_tris=a.max_tris, prop=a.prop, json_out=a.json,
                             selftest=a.self_test))
    return code


if __name__ == "__main__":
    sys.exit(main())
