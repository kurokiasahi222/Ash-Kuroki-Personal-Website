#!/usr/bin/env python3
"""Build Tokyo Night Walk 3D assets headlessly (overview § 6.9, WP-02).

    python art/build.py street            build, bake, export, optimize, validate
    python art/build.py deck ash --fast   several targets; --fast = cheap bakes
    python art/build.py prop:<name>       one prop: export + validate (+ preview.py)

Targets and their modules (the real module wins unless --greybox is passed):
    street       art/scenes/street.py      else the greybox from layout.json
    deck         art/scenes/deck.py        else the greybox deck
    ash          art/characters/ash.py     else the placeholder rig
    prop:<name>  art/props/<name>.py

Outputs:
    public/models/<target>.glb (+ <target>-low.glb for street and deck)   committed
    art/out/<target>.blend, art/out/<target>.raw.glb, art/out/bake/*.png   gitignored
    art/out/prop-<name>.blend, art/out/prop-<name>.glb                      gitignored
"""

import argparse
import importlib
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
ART = Path(__file__).resolve().parent
if str(ART) not in sys.path:
    sys.path.insert(0, str(ART))

# Pinned gltf-transform CLI, run through npx (WP-02 step 4).
GLTF_TRANSFORM = "@gltf-transform/cli@4.5.1"

SETUP = """\
setup (once, from the repo root; bpy 5.2.3 needs Python 3.13):
  python3.13 -m venv .venv-art && .venv-art/bin/pip install -r art/requirements.txt
  .venv-art/bin/python -c "import bpy; print(bpy.app.version_string)"
gltf-transform runs through npx (Node 22), pinned to {gltf}.
then:
  .venv-art/bin/python art/build.py street deck ash
  .venv-art/bin/python art/preview.py street --shot start
"""

TARGETS = {
    "street": {"real": "scenes.street", "greybox": "lib.greybox.street",
               "variants": (("street", 2048), ("street-low", 1024)), "animations": False},
    "deck": {"real": "scenes.deck", "greybox": "lib.greybox.deck",
             "variants": (("deck", 2048), ("deck-low", 1024)), "animations": False},
    "ash": {"real": "characters.ash", "greybox": "lib.greybox.ash",
            "variants": (("ash", 2048),), "animations": True},
}


def log(msg):
    print(msg, flush=True)


def resolve_module(target, greybox):
    spec = TARGETS[target]
    real_path = ART / (spec["real"].replace(".", "/") + ".py")
    if real_path.exists() and not greybox:
        return importlib.import_module(spec["real"]), spec["real"]
    return importlib.import_module(spec["greybox"]), spec["greybox"]


def build_target(target, args):
    from lib import bake, export, paths, scene, wayfinding
    from lib.context import BuildContext
    from lib.layout import Layout

    import validate

    t0 = time.time()
    spec = TARGETS[target]
    module, source = resolve_module(target, args.greybox)
    log(f"== {target}: building from {source}{' (--fast)' if args.fast else ''}")
    scene.reset()
    ctx = BuildContext(target, fast=args.fast, layout=Layout.load() if target == "street" else None)
    module.build(ctx)

    if target == "street":
        tower = module.wayfinding_tower() if hasattr(module, "wayfinding_tower") else None
        passed, _ = wayfinding.check(ctx.layout, tower=tower, log=log)
        if not passed:
            log("[wayfinding] WARNING: the start shot does not show the tower's lit upper section (overview § 4)")

    if args.no_bake:
        export.prepare(log)
        blend = paths.OUT / f"{target}.blend"
        _save_blend(blend)
        log(f"== {target}: --no-bake, saved {blend.relative_to(paths.REPO)} only ({time.time() - t0:.0f}s)")
        return True

    if ctx.atlases:
        groups = {name: entry["objects"] for name, entry in ctx.atlases.items()}
        sizes = {name: entry["size"] for name, entry in ctx.atlases.items()}
        bake.bake_atlases(groups, sizes, fast=args.fast, samples=args.bake_samples, log=log)

    export.prepare(log)
    blend = paths.OUT / f"{target}.blend"
    _save_blend(blend)
    raw = paths.OUT / f"{target}.raw.glb"
    export.export_glb(raw, animations=spec["animations"])
    export.patch_glb(raw, scene_extras={"source": source, "fast": bool(args.fast)})
    ok = True
    for variant, tex in spec["variants"]:
        out = paths.MODELS / f"{variant}.glb"
        export.optimize(raw, out, tex, cli=GLTF_TRANSFORM, work_dir=paths.OUT, log=log)
        if not args.no_validate:
            ok &= validate.run(out, target=target, max_tris=args.max_tris, log=log) == 0
    log(f"== {target}: {'ok' if ok else 'FAILED'} in {time.time() - t0:.0f}s")
    return ok


def build_prop(name, args):
    from lib import export, paths, scene
    from lib.context import BuildContext

    import validate

    t0 = time.time()
    path = ART / "props" / f"{name}.py"
    if not path.exists():
        raise SystemExit(f"no prop module {path.relative_to(ART.parent)}")
    log(f"== prop:{name}: building art/props/{name}.py")
    scene.reset()
    module = importlib.import_module(f"props.{name}")
    ctx = BuildContext(name, fast=args.fast)
    result = module.build(ctx)
    import bpy

    if not isinstance(result, bpy.types.Collection):
        raise SystemExit(f"props/{name}.py build() must return a bpy.types.Collection, got {type(result)}")
    export.prepare(log)
    blend = paths.OUT / f"prop-{name}.blend"
    _save_blend(blend)
    raw = paths.OUT / f"prop-{name}.glb"
    export.export_glb(raw)
    export.patch_glb(raw, scene_extras={"source": f"props.{name}"})
    max_tris = args.max_tris if args.max_tris is not None else getattr(module, "MAX_TRIS", None)
    ok = args.no_validate or validate.run(raw, target="prop", max_tris=max_tris, prop=name, log=log) == 0
    log(f"== prop:{name}: {'ok' if ok else 'FAILED'} in {time.time() - t0:.0f}s "
        f"(preview: python art/preview.py prop:{name})")
    return ok


def _save_blend(path):
    import bpy

    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True, relative_remap=False)


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="build.py", description=__doc__, epilog=SETUP.format(gltf=GLTF_TRANSFORM),
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("targets", nargs="+", metavar="target",
                        help="street | deck | ash | prop:<name> | all (= street deck ash)")
    parser.add_argument("--fast", action="store_true", help="few bake samples, quarter-resolution atlases")
    parser.add_argument("--greybox", action="store_true", help="use the greybox/placeholder even if a real module exists")
    parser.add_argument("--bake-samples", type=int, default=None,
                        help="Cycles bake samples (default 64 with --fast, else 128)")
    parser.add_argument("--max-tris", type=int, default=None, help="triangle cap passed to validate.py")
    parser.add_argument("--no-bake", action="store_true",
                        help="build and save art/out/<target>.blend only (quick layout iteration; no export)")
    parser.add_argument("--no-validate", action="store_true", help="skip validate.py")
    args = parser.parse_args(argv)

    targets = []
    for t in args.targets:
        targets += ["street", "deck", "ash"] if t == "all" else [t]
    ok = True
    for t in targets:
        if t.startswith("prop:"):
            ok &= build_prop(t.split(":", 1)[1], args)
        elif t in TARGETS:
            ok &= build_target(t, args)
        else:
            parser.error(f"unknown target {t!r}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
