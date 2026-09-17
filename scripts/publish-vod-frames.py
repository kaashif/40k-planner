"""Publish only the reviewed stills; preserve the complete broadcast composition.

uv run --with pillow python scripts/publish-vod-frames.py
Raw captures must first exist in .cache/vod/fowler-parry/ (see sample-vod.py).
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
destination = root / "public/vod/fowler-parry"
analysis = json.loads((destination / "analysis.json").read_text())
manifest = []
for checkpoint in analysis["checkpoints"]:
    second = checkpoint["second"]
    source = root / f".cache/vod/fowler-parry/{second:06d}.jpg"
    target = destination / f"{second:06d}.jpg"
    with Image.open(source) as frame:
        frame = frame.convert("RGB")
        frame.thumbnail((1600, 900))
        frame.save(target, quality=86, optimize=True)
        width, height = frame.size
    manifest.append({
        "file": target.name, "second": second, "width": width, "height": height,
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "source": f"https://www.youtube.com/watch?v={analysis['videoId']}&t={second}s",
        "processing": "Full frame resized to 1600×900 maximum; JPEG quality 86. No crop or compositing.",
    })
(destination / "frames.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Published {len(manifest)} attributed evidence stills")
