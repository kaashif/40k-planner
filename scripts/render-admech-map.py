"""uv run --with pillow python scripts/render-admech-map.py"""
from pathlib import Path
import hashlib
import json
from PIL import Image
root = Path(__file__).resolve().parents[1]
plan = json.loads((root / 'public/matchups/adeptus-mechanicus/terrain.json').read_text())
source = root / 'public' / plan['sourceImage'].lstrip('/')
assert hashlib.sha256(source.read_bytes()).hexdigest() == plan['sourceSha256'], 'Review changed terrain before regenerating'
target = root / 'public' / plan['image'].lstrip('/')
Image.open(source).transpose(Image.Transpose.TRANSPOSE).save(target, optimize=True)
assert hashlib.sha256(target.read_bytes()).hexdigest() == plan['sha256']
print(target.relative_to(root))
