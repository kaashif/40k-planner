#!/usr/bin/env python3
"""Generate exact blue deployment-zone masks for Brighton's 15 Take layouts."""

from math import sqrt
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/reference/11th-edition/deployment-masks"
WIDTH = 522
HEIGHT = 708
BOARD_WIDTH = 44
BOARD_HEIGHT = 60


def is_blue_zone(page: int, x: float, y: float) -> bool:
    if page in (10, 19, 23):
        return x >= 32
    if page in (14, 17, 22):
        return y >= 42
    if page in (9, 18):
        return y >= 48 or (x >= 22 and y >= 40)
    if page in (12, 15):
        return x >= 36 or (x >= 30 and y >= 30)
    if page in (11, 13, 20):
        if x < 22 or y < 30:
            return False
        return x >= 31 or y >= 30 + sqrt(max(0, 81 - (x - 22) ** 2))
    if page in (16, 21):
        return y >= 60 - (30 / 44) * x
    raise ValueError(f"Unsupported layout page: {page}")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for page in range(9, 24):
        mask = Image.new("L", (WIDTH, HEIGHT), 0)
        pixels = mask.load()
        covered = 0
        for py in range(HEIGHT):
            for px in range(WIDTH):
                x = (px + 0.5) / WIDTH * BOARD_WIDTH
                y = (py + 0.5) / HEIGHT * BOARD_HEIGHT
                if is_blue_zone(page, x, y):
                    pixels[px, py] = 255
                    covered += 1
        mask.save(OUTPUT / f"layout-{page:02}.png", optimize=True)
        print(f"layout-{page:02}: {covered / (WIDTH * HEIGHT):.1%} blue deployment zone")


if __name__ == "__main__":
    main()
