#!/usr/bin/env python3
"""Generate exact sight-blocking masks from current vector terrain footprints."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
GEOMETRY = ROOT / "public/reference/11th-edition/data/layout-geometry.json"
MASKS = ROOT / "public/reference/11th-edition/terrain-masks"
SIZE = (522, 708)


def point_on_portrait(point: dict) -> tuple[int, int]:
    """Rotate the source's 60x44 landscape coordinates onto our 44x60 board."""
    return round(point["y"] / 44 * (SIZE[0] - 1)), round(point["x"] / 60 * (SIZE[1] - 1))


def generate_mask(layout: dict, destination: Path) -> None:
    image = Image.new("L", SIZE, 0)
    draw = ImageDraw.Draw(image)
    for item in layout["terrain"]:
        if not item.get("base") or not item.get("obscuring"):
            continue
        draw.polygon([point_on_portrait(point) for point in item["points"]], fill=255)
    image.save(destination, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("maps", nargs="*", help="Optional layout numbers, for example 12 13")
    args = parser.parse_args()
    wanted = {int(value) for value in args.maps}
    layouts = json.loads(GEOMETRY.read_text())["layouts"]
    MASKS.mkdir(parents=True, exist_ok=True)
    for layout in layouts:
        number = layout["pdfPage"]
        if wanted and number not in wanted:
            continue
        generate_mask(layout, MASKS / f"layout-{number:02d}.png")


if __name__ == "__main__":
    main()
