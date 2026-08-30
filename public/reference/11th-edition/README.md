# Warhammer 40,000 11th-edition reference corpus

Raw source material and normalized indexes for implementing 11th-edition mission planning.

## Contents

- `official/`: complete documents downloaded from Games Workshop's public Warhammer Community asset host.
- `extracted/`: searchable plain-text extraction of the official PDFs. The footprint PDF is primarily vector artwork and therefore has almost no extractable text.
- `data/sources.json`: source URLs, retrieval date, sizes, and SHA-256 checksums.
- `data/missions.json`: the five Force Dispositions, directed 5×5 primary-mission matrix, and 18 secondary-card names.
- `data/event-layouts.json`: generated index of all 45 A/B/C layout slots, including the August 2026 map revision and its 27 changed layout IDs.
- `data/layout-geometry.json`: current vector terrain, deployment-zone, and objective geometry.
- `maps/` and `layouts/`: current rendered battlefield maps and reference-card previews.
- `terrain-masks/`: exact vector-derived sight-blocking geometry used by both visibility calculations and the audit overlay.
- `current-layout-reference.pdf`: the current 45-layout reference generated from the same vectors.
- `scripts/extract-11e-layouts.mjs`: regenerates `event-layouts.json` from the extracted Event Companion text.

## Authority and limitations

Official Games Workshop documents remain the authority for rules. The June 2026 Event Companion map pages are archived: the 22 July update changed every Purge the Foe matchup, and the 26 August update changed terrain or objectives in 27 of the 45 layouts. Current map geometry, objective positions, terrain footprints, and deployment-zone polygons are synchronized from Rapid Ingress's current vector data; see `docs/layout-regeneration.md` at the repository root.

The Chapter Approved Mission Deck 2026–27 is a separately sold 88-card product and is also available through the official Warhammer 40,000 app. `missions.json` records the primary mission names and matchup relationships used by the grid.

## Regeneration

From the repository root:

```sh
npm run layouts:sync
```

The archived Event Companion text/index can still be rebuilt separately with `pdftotext` followed by `node scripts/extract-11e-layouts.mjs`, but that does not refresh current map artwork.
