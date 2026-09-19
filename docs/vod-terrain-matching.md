# Matching the VOD diagrams to terrain artwork

The homepage and every game checkpoint now use a terrain PNG beneath the existing observed unit markers. The old hand-traced rectangles remain in the JSON as review history/fallback, but are not drawn for these games.

| Game | Likely layout | Reference page | Orientation of portrait artwork |
| --- | --- | --- | --- |
| Fowler–Parry | Disruption / Priority Assets A | 42 | 90° counterclockwise |
| Fowler–Power | Priority Assets / Priority Assets B | 52 | Unrotated |
| van der Most–Fritschen | Priority Assets / Priority Assets C | 53 | 90° counterclockwise |
| Terroxer–Allot | Purge the Foe / Priority Assets B | 34 | 90° counterclockwise |
| Yarin–Iyer | Take and Hold / Priority Assets A | 21 | 90° counterclockwise |

These are visual matches, not confirmed layout declarations. Compare the screenshot beside each diagram, especially the central ruins, outer large ruins and staggered diagonal walls. The mission pairing constrains the candidates to A/B/C. Comparing the existing traced terrain centres with candidate geometry helped rank candidates; the screenshots provide the visual cross-check. Some physical event pieces differ from the illustrated footprints.

## Historical artwork and reproducibility

All games predate the planner’s 26 August update. The PNGs come from the clean map images committed on **15 August 2026**, commit [`6d48cdecabfc8dfe168ab9b5200e35f01e985fd8`](https://github.com/kaashif/40k-planner/tree/6d48cdecabfc8dfe168ab9b5200e35f01e985fd8/public/reference/11th-edition/maps). That is an archived planner snapshot, **not proof of the exact revision used by each event**, particularly games played before 15 August. It avoids silently applying the later 26 August changes.

Each game’s `terrainLayout` object records the archived source link, page, source commit, input/output SHA-256 hashes, orientation, dimensions and matching evidence. `terrain-layout.png` is a conversion/rotation of that artwork, without invented replacement terrain. Rebuild with:

```sh
uv run --with pillow python scripts/render-vod-layouts.py
```

The PNG retains its native aspect ratio in the diagram. Fowler–Power uses a portrait board because its existing normalised observations use that orientation; other games use a landscape board. The broadcast sometimes changes ends: the study keeps a consistent diagram orientation rather than rotating between cameras.

## Reading the overlays

Teal markers identify Thousand Sons; pink markers identify the opponent. Red/blue deployment shading belongs to the reference layout and is not a player-colour key. Marker coordinates remain approximate observations from the earlier review, not measured model bases. Movement arrows join sampled observations and do not prove a legal or uninterrupted movement route. These diagrams cannot establish charge distances or whether a model was wholly inside terrain.

Every displayed diagram links to its PNG and archived source. Game pages explain the match and its uncertainty without collapsed panels. The current deployment planner retains its current layout revision.
