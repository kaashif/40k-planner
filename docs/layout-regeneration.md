# Layout geometry regeneration

This document is the maintenance procedure for the planner's 45 battlefield maps, full-card previews, terrain geometry masks, deployment-zone interpretation, and combined reference PDF.

## Current source of truth

The June 2026 Games Workshop Event Companion PDF is still useful for the matchup order and rules text, but its map pages are stale. Games Workshop first changed every Purge the Foe matchup on 22 July, then published another map revision on 26 August. A current-versus-previous geometry comparison identifies changes to terrain or objectives in 27 of the 45 layouts. The August announcement specifically calls out more six-objective maps for Disruption and moved terrain areas around expansion objectives. It did not announce replacement Force Disposition deployment-zone shapes.

Current geometry is synchronized from [Rapid Ingress's 11th-edition vector data](https://rapidingress.com/terrain-data-11e.js). Its [current-versus-previous comparison](https://rapidingress.com/layout-updates) exposes the complete August change set and exact polygons. Keep the old Event Companion PDF only as an archived rules/index source; do not use its map pages as current geometry.

Relevant sources:

- Games Workshop July update: <https://www.warhammer-community.com/en-gb/articles/rgqanids/warhammer-40000-july-update-what-you-need-to-know/>
- Games Workshop August update: <https://www.warhammer-community.com/en-gb/articles/b4zj2o7u/the-warhammer-40000-august-update-everything-you-need-to-know/>
- Rapid Ingress current/previous geometry comparison: <https://rapidingress.com/layout-updates>
- Rapid Ingress current vector data: <https://rapidingress.com/terrain-data-11e.js>
- GDM layout browser, retained as a secondary visual reference: <https://gdmissions.app/11th/layouts>

`data/event-layouts.json` records the 26 August revision and the 27 affected layout IDs. GDM's files were hash-checked on 30 August after a full refresh and matched the planner's 15 August files byte-for-byte. A visual check then confirmed that those files were stale: Reconnaissance mirror A still had five objectives instead of the updated six. GDM is therefore not used as the August geometry source.

## Required tools

- Node.js and npm, matching the application toolchain.
- `uv`, used to install isolated Python dependencies without creating a project virtual environment.
- Python dependencies are declared inline by the npm commands:
  - Pillow and ReportLab for rendering maps, previews, masks, and the PDF.
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
2. Download and parse all 45 current Rapid Ingress vector layouts.
3. Match each unordered Force Disposition pairing and A/B/C variant to the canonical page order.
4. Write the complete source geometry to `public/reference/11th-edition/data/layout-geometry.json`.
5. Render each battlefield to 522x708 pixels in `public/reference/11th-edition/maps/layout-NN.jpg`; these are what the interactive planner reads.
6. Render full reference cards in `public/reference/11th-edition/layouts/layout-NN.jpg`.
7. Build `public/reference/11th-edition/current-layout-reference.pdf`: a cover plus all 45 current cards.
8. Rasterize exact sight-blocking base polygons into `public/reference/11th-edition/terrain-masks/`.

Individual stages are also available:

```sh
npm run layouts:download
npm run layouts:masks
```

To regenerate or debug selected terrain masks only:

```sh
uv run --with pillow python scripts/generate_terrain_masks.py 12 13 14
```

## How the planner understands geometry

The vector data uses a 60x44in landscape coordinate surface. Generation rotates that onto the planner's 44x60in portrait surface. The browser scales model coordinates to that surface; it does not infer measurements from CSS display size.

Deployment-zone polygons are retained in `layout-geometry.json` and rendered red and blue onto each map. `MapAuditOverlay.tsx` reads those colours from the map pixels, deliberately excluding neutral terrain, grid lines, objective icons, and measurement art. Comparing current and previous source vectors found only tiny coordinate normalization differences, not materially changed Force Disposition shapes.

Sight-blocking geometry is read from a separate 522x708 monochrome mask. `generate_terrain_masks.py` rasterizes every vector terrain area marked both `base` and `obscuring`. White pixels block sight; black pixels do not. This avoids lossy colour and contour inference from a rendered card.

`TerrainVisibility.tsx` ray-casts against this same mask, and the “Sight lines & zones” audit view paints it green. This shared input is important: the diagnostic view displays the geometry actually used by the planner rather than a second hand-maintained approximation.

Objective type, ownership, number, and position come from the same current vector layout records. Refreshing the source therefore updates objectives, terrain, previews, masks, and the PDF together. Unchanged generated files are expected when an upstream layout is unchanged.

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

1. Take and Hold mirror B and Disruption vs Reconnaissance B must show their August terrain rearrangements.
2. Reconnaissance mirror A, B, and C must each show six objectives.
3. One horizontal/lengthways and one vertical deployment: red and blue audit colours must follow the unchanged printed deployment zones.
4. “Sight lines & zones”: green masks must sit on the updated terrain footprints, including the narrow ruin strips.
5. Change the first objective, second objective, and A/B/C selectors independently and confirm the URL and map all update together.
6. Open the current reference PDF and compare the same layout to the browser crop.

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

First compare the official Warhammer 40,000 app or Games Workshop announcement with the current and previous Rapid Ingress vectors. If only objective positions change, the existing pipeline should need no code change. If the vector schema changes, update `scripts/sync_gdm_layouts.py`, then rerun the entire pipeline and perform the visual checklist. Never update only the browser maps: full previews, source geometry, PDF, and terrain masks must be regenerated together.
