#!/usr/bin/env python3
"""Sync current 11th-edition layouts from Rapid Ingress geometry.

GDM's card images remained on the pre-26-August geometry when this revision
was published. Rapid Ingress exposes current and previous vector layouts and
therefore provides both an auditable change set and exact terrain polygons.
"""

from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/reference/11th-edition/data/event-layouts.json"
GEOMETRY = ROOT / "public/reference/11th-edition/data/layout-geometry.json"
MAPS = ROOT / "public/reference/11th-edition/maps"
LAYOUTS = ROOT / "public/reference/11th-edition/layouts"
OUTPUT_PDF = ROOT / "public/reference/11th-edition/current-layout-reference.pdf"
RAPID_DATA_URL = "https://rapidingress.com/terrain-data-11e.js"
DISPOSITION_CODES = {
    "Take and Hold": "TH",
    "Disruption": "DI",
    "Purge the Foe": "PF",
    "Reconnaissance": "RE",
    "Priority Assets": "PA",
}
MAP_SIZE = (522, 708)


def download_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "40k-planner-layout-sync/2.0"})
    with urllib.request.urlopen(request) as response:
        return response.read().decode("utf-8")


def parse_rapid_layouts(source: str) -> list[dict]:
    match = re.search(r"const ELEVEN_E_LAYOUTS = (\[.*\]);\s*const ELEVEN_E_MATCHUPS", source, re.DOTALL)
    if not match:
        raise RuntimeError("Could not find ELEVEN_E_LAYOUTS in Rapid Ingress data")
    layouts = json.loads(match.group(1))
    if len(layouts) != 45:
        raise RuntimeError(f"Expected 45 Rapid Ingress layouts, found {len(layouts)}")
    return layouts


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = ["DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", "Arial Bold.ttf" if bold else "Arial.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def point_on_portrait(point: dict, size: tuple[int, int]) -> tuple[int, int]:
    width, height = size
    return round(point["y"] / 44 * (width - 1)), round(point["x"] / 60 * (height - 1))


def polygon(item: dict, size: tuple[int, int]) -> list[tuple[int, int]]:
    return [point_on_portrait(point, size) for point in item["points"]]


def objective_position(item: dict, size: tuple[int, int]) -> tuple[int, int]:
    points = item.get("losPoints") or item["points"]
    left, right = min(point["y"] for point in points), max(point["y"] for point in points)
    top, bottom = min(point["x"] for point in points), max(point["x"] for point in points)
    return point_on_portrait({"x": (top + bottom) / 2, "y": (left + right) / 2}, size)


def render_map(layout: dict, destination: Path, size: tuple[int, int] = MAP_SIZE) -> None:
    width, height = size
    image = Image.new("RGB", size, "#eee9dc")
    draw = ImageDraw.Draw(image)

    for zone in layout["deploymentZones"]:
        colour = "#b9625f" if zone["type"] == "opponent" else "#46657d"
        draw.polygon(polygon(zone, size), fill=colour)

    for inch in range(1, 44):
        x = round(inch / 44 * width)
        draw.line((x, 0, x, height), fill="#c8c2b5" if inch % 5 else "#aaa396", width=1)
    for inch in range(1, 60):
        y = round(inch / 60 * height)
        draw.line((0, y, width, y), fill="#c8c2b5" if inch % 5 else "#aaa396", width=1)

    bases = [item for item in layout["terrain"] if item.get("base")]
    features = [item for item in layout["terrain"] if item.get("feature")]
    for item in bases:
        points = polygon(item, size)
        draw.polygon(points, fill="#deddd7", outline="#24292d", width=2)
    for item in features:
        points = polygon(item, size)
        colour = "#287552" if item.get("category") == "DENSE" else "#df8618"
        draw.polygon(points, fill=colour, outline="#17241e", width=1)

    objective_font = font(max(10, round(width / 42)), bold=True)
    for item in bases:
        objective = item.get("objective")
        if not objective:
            continue
        x, y = objective_position(item, size)
        radius = max(10, round(width / 34))
        kind = objective["type"]
        colour = "#a62f2f" if objective.get("owner") == "attacker" else "#244c69" if objective.get("owner") == "defender" else "#148a96" if kind == "expansion" else "#15191d"
        label = "H" if kind == "home" else "E" if kind == "expansion" else "C"
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill="#f7f5ef", outline=colour, width=3)
        box = draw.textbbox((0, 0), label, font=objective_font)
        draw.text((x - (box[2] - box[0]) / 2, y - (box[3] - box[1]) / 2 - 1), label, font=objective_font, fill=colour)

    draw.rectangle((0, 0, width - 1, height - 1), outline="#15191d", width=3)
    image.save(destination, quality=94, optimize=True)


def render_preview(layout: dict, map_path: Path, destination: Path) -> None:
    size = (910, 1400)
    page = Image.new("RGB", size, "#f1eee6")
    draw = ImageDraw.Draw(page)
    draw.rectangle((0, 0, size[0], 190), fill="#183a55")
    draw.text((52, 42), layout["dispositionLabel"].upper(), font=font(31, bold=True), fill="#ffffff")
    draw.text((52, 98), f"LAYOUT {layout['variant']}  -  AUGUST 2026", font=font(18, bold=True), fill="#d2b468")
    draw.text((52, 145), "ATTACKER / RED", font=font(15, bold=True), fill="#d97772")
    draw.text((size[0] - 220, 145), "DEFENDER / BLUE", font=font(15, bold=True), fill="#8db4cf")

    with Image.open(map_path) as map_image:
        board = map_image.resize((650, 882), Image.Resampling.LANCZOS)
    page.paste(board, (130, 225))
    objective_count = sum(1 for item in layout["terrain"] if item.get("objective"))
    draw.text((130, 1140), f"60 x 44 BOARD  -  {objective_count} OBJECTIVES", font=font(17, bold=True), fill="#303942")
    draw.text((130, 1190), "H  Home     C  Centre     E  Expansion", font=font(16), fill="#4e5963")
    draw.text((130, 1230), "Grey  Terrain area     Green/Orange  Terrain feature", font=font(16), fill="#4e5963")
    draw.text((130, 1315), "Current vector geometry: Rapid Ingress - 26 August 2026", font=font(14), fill="#69737c")
    page.save(destination, quality=90, optimize=True, progressive=True)


def build_pdf(layouts: list[dict], previews: list[Path]) -> None:
    page_width, page_height = A4
    pdf = canvas.Canvas(str(OUTPUT_PDF), pagesize=A4, pageCompression=1)
    pdf.setTitle("Warhammer 40,000 Current Layout Reference - August 2026")
    pdf.setAuthor("40k Planner")
    pdf.setFillColorRGB(0.06, 0.08, 0.11)
    pdf.rect(0, 0, page_width, page_height, fill=1, stroke=0)
    pdf.setFillColorRGB(0.91, 0.74, 0.38)
    pdf.setFont("Helvetica-Bold", 28)
    pdf.drawString(42, page_height - 90, "CURRENT LAYOUT REFERENCE")
    pdf.setFillColorRGB(0.93, 0.94, 0.96)
    pdf.setFont("Helvetica", 14)
    pdf.drawString(42, page_height - 122, "Warhammer 40,000 - August 2026 layout update")
    pdf.setFillColorRGB(0.70, 0.73, 0.78)
    text = pdf.beginText(42, page_height - 180)
    text.setFont("Helvetica", 10)
    text.setLeading(15)
    for line in (
        "Planner-maintained reference generated from current vector layout geometry.",
        "Games Workshop's 26 August update changed 27 of the 45 recommended layouts,",
        "including terrain and objective placement. Deployment-zone shapes did not materially",
        "change; tiny coordinate differences in source vectors are artwork normalization.",
        "",
        "Terrain footprints, deployment zones and objectives on the following 45 pages are",
        "synchronized from the current Rapid Ingress layout data.",
    ):
        text.textLine(line)
    pdf.drawText(text)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(42, 42, "Sources: Warhammer Community 26 August 2026 update / rapidingress.com/layout-updates")
    pdf.showPage()

    for index, (layout, image_path) in enumerate(zip(layouts, previews, strict=True), start=2):
        title = f"{layout['attacker']['forceDisposition']} vs {layout['defender']['forceDisposition']} - Layout {layout['layout']}"
        pdf.setFont("Helvetica-Bold", 13)
        pdf.setFillColorRGB(0.08, 0.10, 0.13)
        pdf.drawString(28, page_height - 28, title)
        with Image.open(image_path) as image:
            image_width, image_height = image.size
        available_width, available_height = page_width - 36, page_height - 64
        scale = min(available_width / image_width, available_height / image_height)
        draw_width, draw_height = image_width * scale, image_height * scale
        pdf.drawImage(str(image_path), (page_width - draw_width) / 2, 24, width=draw_width, height=draw_height, preserveAspectRatio=True, mask="auto")
        pdf.setFillColorRGB(0.35, 0.38, 0.43)
        pdf.setFont("Helvetica", 7)
        pdf.drawRightString(page_width - 20, 12, f"Current layout reference - page {index}")
        pdf.showPage()
    pdf.save()


def main() -> None:
    index = json.loads(DATA.read_text())
    rapid_layouts = parse_rapid_layouts(download_text(RAPID_DATA_URL))
    by_key = {(tuple(sorted(layout["matchup"])), layout["variant"]): layout for layout in rapid_layouts}
    MAPS.mkdir(parents=True, exist_ok=True)
    LAYOUTS.mkdir(parents=True, exist_ok=True)
    ordered_geometry = []
    previews = []

    for entry in index["layouts"]:
        matchup = tuple(sorted((DISPOSITION_CODES[entry["attacker"]["forceDisposition"]], DISPOSITION_CODES[entry["defender"]["forceDisposition"]])))
        layout = by_key[(matchup, entry["layout"])]
        page = entry["pdfPage"]
        map_path = MAPS / f"layout-{page:02d}.jpg"
        preview_path = LAYOUTS / f"layout-{page:02d}.jpg"
        render_map(layout, map_path)
        render_preview(layout, map_path, preview_path)
        ordered_geometry.append({**layout, "plannerLayoutId": entry["id"], "pdfPage": page})
        previews.append(preview_path)

    GEOMETRY.write_text(json.dumps({
        "schemaVersion": 1,
        "edition": 11,
        "revision": "2026-08-26",
        "source": RAPID_DATA_URL,
        "deploymentZonesMateriallyChanged": False,
        "deploymentZoneNote": "Current/previous source vectors differ only by sub-pixel normalization; Force Disposition shapes are unchanged.",
        "layouts": ordered_geometry,
    }, separators=(",", ":")) + "\n")
    build_pdf(index["layouts"], previews)


if __name__ == "__main__":
    main()
