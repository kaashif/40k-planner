# Layout geometry regeneration

This document is the maintenance procedure for the planner's 45 battlefield maps, full-card previews, terrain geometry masks, deployment-zone interpretation, and combined reference PDF.

## Current source of truth

The June 2026 Games Workshop Event Companion PDF is still useful for the matchup order and rules text, but its map pages are stale: they show five objectives on Purge the Foe matchups. Games Workshop's 22 July 2026 update says every Purge the Foe layout has six objectives, made by splitting the former centre objective into two.

Current layout artwork is synchronized from [GDM's 11th-edition layouts](https://gdmissions.app/11th/layouts). GDM states that the layouts are backed by Battlemaster. Keep the old Event Companion PDF only as an archived rules/index source; do not use its map pages as current geometry.

Relevant sources:

- Games Workshop July update: <https://www.warhammer-community.com/en-gb/articles/rgqanids/warhammer-40000-july-update-what-you-need-to-know/>
- GDM layout browser: <https://gdmissions.app/11th/layouts>
- GDM image root used by the script: <https://gdmissions.app/assets/11th/layouts>

## Required tools

- Node.js and npm, matching the application toolchain.
- `uv`, used to install isolated Python dependencies without creating a project virtual environment.
- Python dependencies are declared inline by the npm commands:
  - Pillow and ReportLab for downloads, image crops, previews, and PDF creation.
  - OpenCV (`opencv-python`) for terrain-footprint extraction.
- Poppler (`pdftoppm` and `pdfinfo`) is recommended for visually checking the generated PDF.
- ImageMagick is optional and useful for composing mask audit images. On macOS: `brew install imagemagick`.

No global Python packages are required. `npm run layouts:sync` lets `uv` cache and run the necessary packages.

## One-command regeneration

From the repository root:

```sh
npm run layouts:sync
```

This runs the following deterministic pipeline:

1. Read the canonical 45-layout order from `public/reference/11th-edition/data/event-layouts.json`.
2. Convert each unordered force-disposition pairing to GDM's canonical slug order.
3. Apply the GDM portrait-card exception table for the one portrait card in each pairing.
4. Download both `no-measurements` and `with-measurements` PNGs.
5. Crop the battlefield rectangle from each no-measurement card and normalize it to 522×708 pixels. These files go to `public/reference/11th-edition/maps/layout-NN.jpg` and are what the interactive planner reads.
6. Resize each complete measured card for the mission matrix at `public/reference/11th-edition/layouts/layout-NN.jpg`.
7. Build `public/reference/11th-edition/current-layout-reference.pdf`: a cover plus all 45 measured cards.
8. Regenerate all binary sight-blocking masks in `public/reference/11th-edition/terrain-masks/` from the new map crops.

The downloader uses a project-local temporary directory and removes it even if generation fails.

Individual stages are also available:

```sh
npm run layouts:download
npm run layouts:masks
```

To regenerate or debug selected terrain masks only:

```sh
uv run --with opencv-python python scripts/generate_terrain_masks.py 12 13 14
```

## How the planner understands geometry

The GDM battlefield crop is the common 44×60in coordinate surface. The browser scales model coordinates to that surface; it does not infer measurements from CSS display size.

Deployment zones are read from the map pixels by `MapAuditOverlay.tsx`. A pixel is treated as red or blue only when its colour strongly dominates the other channels. This deliberately excludes neutral terrain, grid lines, objective icons, and measurement art. The audit overlay shows the exact pixels accepted by these thresholds.

Sight-blocking geometry is read from a separate 522×708 monochrome mask. `generate_terrain_masks.py` uses two visual invariants of GDM artwork:

- sight-blocking baseplates have a nearly black closed outline;
- each terrain piece contains a green ruin-wall or orange obstacle marker.

The generator finds coloured terrain seeds, chooses the smallest enclosing black baseplate contour, fills it, and erodes one pixel so the calculated boundary remains on the printed edge. Very narrow pieces whose wall interrupts the outer outline use a small expansion of the printed wall rather than being omitted. White pixels block sight; black pixels do not.

`TerrainVisibility.tsx` ray-casts against this same mask, and the “Sight lines & zones” audit view paints it green. This shared input is important: the diagnostic view displays the geometry actually used by the planner rather than a second hand-maintained approximation.

Objectives are not inferred separately. They are part of the current GDM map raster, so refreshing the maps refreshes objective number and position everywhere the planner displays a battlefield.

## Verification checklist

Run the normal checks:

```sh
node --test app/planner/planner-utils.test.ts
npm run test:cli
npm run lint
npm run build
git diff --check
```

Then visually verify at least these cases in Firefox:

1. Take and Hold vs Purge the Foe, layouts A, B, and C: each must say six objectives and show two centre objectives.
2. One horizontal/lengthways and one vertical deployment: red and blue audit colours must follow the printed zones.
3. “Sight lines & zones”: green masks must sit on terrain footprints, including the narrow ruin strips.
4. Change the first objective, second objective, and A/B/C selectors independently and confirm the URL and map all update together.
5. Open the current reference PDF and compare the same layout to the browser crop.

For a PDF render check:

```sh
mkdir -p tmp/layout-pdf-check
pdftoppm -png -f 1 -l 7 -r 100 \
  public/reference/11th-edition/current-layout-reference.pdf \
  tmp/layout-pdf-check/page
pdfinfo public/reference/11th-edition/current-layout-reference.pdf
```

Delete `tmp/layout-pdf-check` after inspection; generated QA artifacts should not be committed.

## When upstream changes again

First compare GDM and the official Warhammer 40,000 app or a Games Workshop announcement. If only objective positions change, the existing pipeline should need no code change. If GDM changes card dimensions, colours, filename conventions, or its portrait exceptions, update the constants and crop bounds in `scripts/sync_gdm_layouts.py`, then rerun the entire pipeline and perform the visual checklist. Never update only the browser maps: full previews, PDF, and terrain masks must be regenerated together.
