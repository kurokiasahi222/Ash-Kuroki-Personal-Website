"""Repository paths used by the art pipeline."""

from pathlib import Path

ART = Path(__file__).resolve().parents[1]
REPO = ART.parent
OUT = ART / "out"  # gitignored: .blend files, raw exports, bakes
BAKE_DIR = OUT / "bake"
CACHE = ART / ".cache"  # gitignored: downloaded fonts
MODELS = REPO / "public" / "models"  # committed, optimized .glb files
SHOTS = REPO / "shots" / "art"  # gitignored: preview renders
LAYOUT = ART / "layout.json"
PALETTE = ART / "palette.json"
