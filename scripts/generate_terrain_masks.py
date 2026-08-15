#!/usr/bin/env python3
"""Generate sight-blocking terrain footprints from the current cropped GDM maps."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / "public/reference/11th-edition/maps"
MASKS = ROOT / "public/reference/11th-edition/terrain-masks"


def wall_seed_mask(image: np.ndarray) -> np.ndarray:
    """Find GDM's green ruin walls and orange obstacle bars."""
    blue, green, red = cv2.split(image)
    ruin = (green > 66) & (green > red * 1.18) & (green > blue * 1.08) & (red < 120)
    obstacle = (red > 180) & (green > 65) & (green < 175) & (blue < 85)
    seeds = np.where(ruin | obstacle, 255, 0).astype(np.uint8)
    return cv2.morphologyEx(seeds, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))


def generate_mask(source: Path, destination: Path) -> None:
    image = cv2.imread(str(source), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Could not read {source}")

    # GDM draws every baseplate with a nearly-black closed outline. The board grid
    # and deployment fills are deliberately excluded by this strict threshold.
    dark = np.where(np.max(image, axis=2) < 52, 255, 0).astype(np.uint8)
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(dark, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    candidates: list[tuple[float, np.ndarray]] = []
    for contour in contours:
        area = cv2.contourArea(contour)
        x, y, width, height = cv2.boundingRect(contour)
        if 450 <= area <= 20_000 and width >= 16 and height >= 16:
            candidates.append((area, contour))

    seed_count, labels, stats, centroids = cv2.connectedComponentsWithStats(wall_seed_mask(image), 8)
    chosen: list[np.ndarray] = []
    chosen_indexes: set[int] = set()
    uncovered_seeds = np.zeros(image.shape[:2], dtype=np.uint8)
    for label in range(1, seed_count):
        if stats[label, cv2.CC_STAT_AREA] < 14:
            continue
        point = tuple(float(value) for value in centroids[label])
        enclosing = [(index, item) for index, item in enumerate(candidates) if cv2.pointPolygonTest(item[1], point, False) >= 0]
        if not enclosing:
            uncovered_seeds[labels == label] = 255
            continue
        candidate_index, (_, contour) = min(enclosing, key=lambda entry: entry[1][0])
        if candidate_index not in chosen_indexes:
            chosen.append(contour)
            chosen_indexes.add(candidate_index)

    mask = np.zeros(image.shape[:2], dtype=np.uint8)
    cv2.drawContours(mask, chosen, -1, 255, thickness=cv2.FILLED)
    # A few GDM ruin pieces are so narrow that their wall interrupts the outer
    # baseplate line. For those pieces, a small expansion of the printed wall is
    # a closer footprint than discarding the blocker entirely.
    uncovered_seeds = cv2.dilate(uncovered_seeds, np.ones((9, 9), np.uint8), iterations=1)
    mask = cv2.bitwise_or(mask, uncovered_seeds)
    # A slight inward erosion keeps the visibility boundary on the printed edge.
    mask = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=1)
    cv2.imwrite(str(destination), mask)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("maps", nargs="*", help="Optional layout numbers, for example 12 13")
    args = parser.parse_args()
    wanted = {int(value) for value in args.maps}
    MASKS.mkdir(parents=True, exist_ok=True)
    for source in sorted(MAPS.glob("layout-*.jpg")):
        number = int(source.stem.removeprefix("layout-"))
        if wanted and number not in wanted:
            continue
        generate_mask(source, MASKS / f"layout-{number:02d}.png")


if __name__ == "__main__":
    main()
