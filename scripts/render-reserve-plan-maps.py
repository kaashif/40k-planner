"""uv run --with pillow python scripts/render-reserve-plan-maps.py"""
from pathlib import Path
import hashlib
import json
from PIL import Image
root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'public/matchups/world-eaters-reserve-plan/plans.json').read_text())
for plan in data['layouts']:
    source = root / 'public' / plan['sourceImage'].lstrip('/')
    assert hashlib.sha256(source.read_bytes()).hexdigest() == plan['sourceSha256'], 'Review changed terrain before regenerating the plan'
    target = root / 'public' / plan['image'].lstrip('/')
    Image.open(source).transpose(Image.Transpose.TRANSPOSE).save(target, optimize=True)
    assert hashlib.sha256(target.read_bytes()).hexdigest() == plan['sha256']
    print(plan['variant'], target.relative_to(root))
