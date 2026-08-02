# Warhammer 40,000 11th-edition reference corpus

Raw source material and normalized indexes for implementing 11th-edition mission planning.

## Contents

- `official/`: complete documents downloaded from Games Workshop's public Warhammer Community asset host.
- `extracted/`: searchable plain-text extraction of the official PDFs. The footprint PDF is primarily vector artwork and therefore has almost no extractable text.
- `data/sources.json`: source URLs, retrieval date, sizes, and SHA-256 checksums.
- `data/missions.json`: the five Force Dispositions, directed 5×5 primary-mission matrix, and 18 secondary-card names.
- `data/event-layouts.json`: generated index of all 45 official A/B/C event layouts, including their PDF page, matchup, missions, measurement labels, and terrain feature groups.
- `scripts/extract-11e-layouts.mjs`: regenerates `event-layouts.json` from the extracted Event Companion text.

## Authority and limitations

The official PDFs are the authority for rules, exact map geometry, objective positions, terrain footprints, and measurements. The normalized JSON is an implementation index and should always retain its source-page link.

The Chapter Approved Mission Deck 2026–27 is a separately sold 88-card product and is also available through the official Warhammer 40,000 app. Its paid card artwork and complete card wording are not mirrored in this repository. `missions.json` records factual names and relationships and points to the community GDM reference for convenient cross-checking.

## Regeneration

From the repository root:

```sh
pdftotext -layout reference/11th-edition/official/event-companion.pdf reference/11th-edition/extracted/event-companion.txt
node scripts/extract-11e-layouts.mjs
```
