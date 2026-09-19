"""Rebuild matched VOD terrain PNGs from the pinned planner archive.
Run: uv run --with pillow python scripts/render-vod-layouts.py
Requires the source commit in the local Git history.
"""
from pathlib import Path
import hashlib
import io
import json
import subprocess
from PIL import Image

root = Path(__file__).resolve().parents[1]
for path in sorted((root / 'public/vod').glob('*/game.json')):
    game = json.loads(path.read_text())
    layout = game.get('terrainLayout')
    if not layout:
        continue
    source = f"{layout['sourceCommit']}:public/reference/11th-edition/maps/layout-{layout['page']}.jpg"
    raw = subprocess.check_output(['git', 'show', source], cwd=root)
    assert hashlib.sha256(raw).hexdigest() == layout['sourceSha256']
    image = Image.open(io.BytesIO(raw))
    if layout['orientation'] == '90° counterclockwise from the portrait layout':
        image = image.transpose(Image.Transpose.ROTATE_90)
    else:
        assert layout['orientation'] == 'portrait'
    assert image.size == (layout['width'], layout['height'])
    image.save(root / 'public' / layout['image'].lstrip('/'), optimize=True)
    print(f"{game['id']}: {layout['label']}")
