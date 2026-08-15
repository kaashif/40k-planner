#!/usr/bin/env python3
"""Sync current 11th-edition maps from GDM and build the layout reference PDF."""

from __future__ import annotations

import json
import shutil
import urllib.request
from pathlib import Path

from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/reference/11th-edition/data/event-layouts.json"
MAPS = ROOT / "public/reference/11th-edition/maps"
LAYOUTS = ROOT / "public/reference/11th-edition/layouts"
TEMP = ROOT / "tmp/gdm-layouts"
OUTPUT_PDF = ROOT / "public/reference/11th-edition/current-layout-reference.pdf"
GDM_ROOT = "https://gdmissions.app/assets/11th/layouts"
ORDER = ["take-and-hold", "disruption", "purge-the-foe", "priority-assets", "reconnaissance"]
PORTRAIT_LAYOUT = {
    "disruption-mirror": 3,
    "disruption-vs-priority-assets": 1,
    "disruption-vs-purge-the-foe": 3,
    "disruption-vs-reconnaissance": 2,
    "priority-assets-mirror": 1,
    "priority-assets-vs-reconnaissance": 3,
    "purge-the-foe-mirror": 3,
    "purge-the-foe-vs-priority-assets": 1,
    "purge-the-foe-vs-reconnaissance": 2,
    "reconnaissance-mirror": 1,
    "take-and-hold-mirror": 2,
    "take-and-hold-vs-disruption": 1,
    "take-and-hold-vs-priority-assets": 3,
    "take-and-hold-vs-purge-the-foe": 1,
    "take-and-hold-vs-reconnaissance": 2,
}


def slug(value: str) -> str:
    return value.lower().replace(" ", "-")


def gdm_pair(left: str, right: str) -> str:
    left_slug, right_slug = slug(left), slug(right)
    if left_slug == right_slug:
        return f"{left_slug}-mirror"
    ordered = sorted((left_slug, right_slug), key=ORDER.index)
    return f"{ordered[0]}-vs-{ordered[1]}"


def source_url(pair: str, number: int, measured: bool) -> str:
    portrait = "-portrait" if PORTRAIT_LAYOUT[pair] == number else ""
    variant = "with-measurements" if measured else "no-measurements"
    return f"{GDM_ROOT}/{variant}/{pair}-{number}{portrait}.png"


def download(url: str, destination: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "40k-planner-layout-sync/1.0"})
    with urllib.request.urlopen(request) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def crop_board(source: Path, destination: Path, portrait: bool) -> None:
    # GDM cards use one of two near-identical board frames.
    bounds = (261, 757, 1392, 2296) if portrait else (263, 753, 1390, 2285)
    with Image.open(source) as image:
        board = image.crop(bounds).resize((522, 708), Image.Resampling.LANCZOS).convert("RGB")
        board.save(destination, quality=94, optimize=True)


def save_preview(source: Path, destination: Path) -> None:
    """Store a browser-friendly copy of the complete measured GDM card."""
    with Image.open(source) as image:
        preview = image.convert("RGB")
        preview.thumbnail((910, 1400), Image.Resampling.LANCZOS)
        preview.save(destination, quality=88, optimize=True, progressive=True)


def build_pdf(layouts: list[dict], measured_images: list[Path]) -> None:
    page_width, page_height = A4
    pdf = canvas.Canvas(str(OUTPUT_PDF), pagesize=A4, pageCompression=1)
    pdf.setTitle("Warhammer 40,000 Current Layout Reference - July 2026")
    pdf.setAuthor("40k Planner")

    pdf.setFillColorRGB(0.06, 0.08, 0.11)
    pdf.rect(0, 0, page_width, page_height, fill=1, stroke=0)
    pdf.setFillColorRGB(0.91, 0.74, 0.38)
    pdf.setFont("Helvetica-Bold", 28)
    pdf.drawString(42, page_height - 90, "CURRENT LAYOUT REFERENCE")
    pdf.setFillColorRGB(0.93, 0.94, 0.96)
    pdf.setFont("Helvetica", 14)
    pdf.drawString(42, page_height - 122, "Warhammer 40,000 - July 2026 objective update")
    pdf.setFillColorRGB(0.70, 0.73, 0.78)
    text = pdf.beginText(42, page_height - 180)
    text.setFont("Helvetica", 10)
    text.setLeading(15)
    for line in (
        "Planner-maintained reference generated from current GDM/Battlemaster layout images.",
        "It replaces the June Event Companion maps, which still show obsolete five-objective",
        "Purge the Foe layouts. Games Workshop confirmed on 22 July 2026 that every Purge",
        "matchup now uses six objectives, with the former central objective split into two.",
        "",
        "Terrain geometry, deployment zones, objectives and measurements shown on the following",
        "45 pages are synchronized from GDM on generation.",
    ):
        text.textLine(line)
    pdf.drawText(text)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(42, 42, "Sources: gdmissions.app / battlemaster.online / Warhammer Community July 2026 update")
    pdf.showPage()

    for index, (layout, image_path) in enumerate(zip(layouts, measured_images, strict=True), start=2):
        title = f"{layout['attacker']['forceDisposition']} vs {layout['defender']['forceDisposition']} - Layout {layout['layout']}"
        pdf.setFont("Helvetica-Bold", 13)
        pdf.setFillColorRGB(0.08, 0.10, 0.13)
        pdf.drawString(28, page_height - 28, title)
        with Image.open(image_path) as image:
            image_width, image_height = image.size
        available_width, available_height = page_width - 36, page_height - 64
        scale = min(available_width / image_width, available_height / image_height)
        draw_width, draw_height = image_width * scale, image_height * scale
        pdf.drawImage(
            str(image_path),
            (page_width - draw_width) / 2,
            24,
            width=draw_width,
            height=draw_height,
            preserveAspectRatio=True,
            mask="auto",
        )
        pdf.setFillColorRGB(0.35, 0.38, 0.43)
        pdf.setFont("Helvetica", 7)
        pdf.drawRightString(page_width - 20, 12, f"Current layout reference - page {index}")
        pdf.showPage()

    pdf.save()


def main() -> None:
    layouts = json.loads(DATA.read_text())["layouts"]
    MAPS.mkdir(parents=True, exist_ok=True)
    LAYOUTS.mkdir(parents=True, exist_ok=True)
    TEMP.mkdir(parents=True, exist_ok=True)
    measured_images: list[Path] = []

    try:
        for layout in layouts:
            pair = gdm_pair(layout["attacker"]["forceDisposition"], layout["defender"]["forceDisposition"])
            number = ord(layout["layout"]) - ord("A") + 1
            portrait = PORTRAIT_LAYOUT[pair] == number
            plain = TEMP / f"{layout['id']}-plain.png"
            measured = TEMP / f"{layout['id']}-measured.png"
            download(source_url(pair, number, False), plain)
            download(source_url(pair, number, True), measured)
            crop_board(plain, MAPS / f"layout-{layout['pdfPage']:02d}.jpg", portrait)
            save_preview(measured, LAYOUTS / f"layout-{layout['pdfPage']:02d}.jpg")
            measured_images.append(measured)
        build_pdf(layouts, measured_images)
    finally:
        shutil.rmtree(TEMP, ignore_errors=True)


if __name__ == "__main__":
    main()
