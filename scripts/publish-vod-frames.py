"""Publish only the reviewed stills; preserve the complete broadcast composition.

uv run --with pillow python scripts/publish-vod-frames.py
Raw captures must first exist in .cache/vod/fowler-parry/ (see sample-vod.py).
"""
import hashlib
import argparse
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--game', default='fowler-parry', help='Game directory under public/vod and .cache/vod')
args = parser.parse_args()
if not args.game or Path(args.game).name != args.game or args.game in {'.', '..'}:
    parser.error('Game must be a directory name')
destination = root / 'public/vod' / args.game
analysis = json.loads((destination / "game.json").read_text())
manifest = []
checkpoints = [dict(frame, file=frame['image']) for frame in analysis['frames']]
if analysis.get('roster'):
    roster = analysis['roster']
    checkpoints.append(dict(second=roster['second'], file=roster['image']))
    if roster.get('opponentImage'):
        checkpoints.append(dict(second=roster['opponentSecond'], file=roster['opponentImage']))
for checkpoint in checkpoints:
    second = checkpoint["second"]
    source = root / f".cache/vod/{args.game}/{second:06d}.jpg"
    target = destination / checkpoint['file']
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
