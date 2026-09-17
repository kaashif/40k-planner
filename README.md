# 40k Field Notes

A VOD-first GitHub Pages site for Thousand Sons game analysis, with 11th-edition mission and deployment tools kept as secondary routes.

The homepage reviews Alex Fowler vs Frasier Parry through seven real broadcast stills, timestamped observations, commentary reports, interpretations and explicit gaps. Overhead frames have hand-traced terrain diagrams with labelled unit/group markers; they are approximate visual aids, not measured maps or exact model inventories. Other Grand Coven wins are linked in an unreviewed queue.

The original mission matrix is now at `/missions/`; `/planner/`, `/plans/` and `/reviews/` remain available. Selecting a mission cell shows both players' primary cards and the three matching layouts.

## VOD analysis

The [implementation plan](docs/vod-analysis-plan.md) records scope, evidence standards and progress. Checkpoint data and frame provenance live in `public/vod/fowler-parry/`. Only selected commentary stills are committed; raw frames and captions stay in ignored `.cache/`. No complete videos, credentials or signed media URLs are published.

```sh
uv run --with yt-dlp --with imageio-ffmpeg --with pillow python scripts/sample-vod.py WOpiPuYL0YA --times 2400 4500 5700 7500 8700 10920 11040 --out .cache/vod/fowler-parry
uv run --with pillow python scripts/publish-vod-frames.py
node --test scripts/test-vod.mjs
NEXT_PUBLIC_BASE_PATH=/40k-planner npm run build
uv run --with playwright playwright install chromium
uv run --with playwright python scripts/check-vod-ui.py
```

The UI test starts its own local static server and writes desktop/mobile screenshots to `.cache/vod-ui/`. An existing compatible Chromium executable can be supplied with `VOD_TEST_BROWSER`. Source captions are fallible: never promote a commentary claim to a directly observed event without checking the footage.

Primary-card images and all 45 layout previews are stored locally with the static site.

## Deployment CLI

The dependency-free CLI validates a list's points, base footprints, board bounds, and model overlap. It emits a planner-import JSON, a standalone SVG diagram with the mirror deployment ghosted in red, and a Markdown tactical briefing.

The bundled preset is Kaashif's 2,000-point Brighton Take and Hold Necron list in `armies/necrons-2000.json`. Take and Hold mirror Layout A is the first current suggested deployment. It starts the Void Dragon in deep strike, infiltrates one Flayed One unit behind the centre ruin, fully screens the left Wraith brick behind the left objective, advances the Reanimator behind the adjacent square, and forms a compact missile from the Nightbringer, Skorpekhs, Skorpekh Lord, and Ammentar behind the separate right-hand ruin. The Nightbringer's full 90mm base is kept clear of terrain. The remaining matchups are intentionally left unbundled until that first plan is vetted.

The reusable unit-by-unit doctrine and acceptance checks are recorded in [`docs/kaashif-deployment-principles.md`](docs/kaashif-deployment-principles.md).

```sh
npm run plan -- bases
npm run plan -- validate
npm run plan:example
```

Open a deployment planner or the `/plans/` library. Its compact top bar adds complete units without asking for base sizes and exposes movement, Movement-locked dragging with live measurement, coherency, sight-line/deployment-zone audit, opponent deployment-zone infiltrate exclusion, screening, visibility, deep strike, and markup overlays. A suggested deployment loads automatically on a bundled layout; “Hide suggestion” removes its bases and labels from view without deleting it, and “Show suggestion” restores it. The planner warns when army models are neither placed nor accounted for in deep strike. Drag a box, click a unit label, or Ctrl/Cmd-click models to multi-select; dragging any selected model moves the group. Every edit and view setting is saved to local browser storage with a rolling backup. Edit the plan files listed by `plans/take-take-mirror.json` and rebuild to iterate. Coordinates are model centres in inches from the board's top-left corner on the 44×60in portrait map.

## Development

```sh
npm ci
npm run dev
```

## Static export

```sh
npm run build
npm start
```

GitHub Pages deployment is handled by `.github/workflows/deploy-pages.yml`. The workflow sets `NEXT_PUBLIC_BASE_PATH=/40k-planner` so assets work beneath the repository Pages path.

## Regenerating layout geometry

```sh
npm run layouts:sync
```

This refreshes all 45 maps and previews from current vector geometry, rebuilds the current reference PDF, and regenerates the planner's exact sight-blocking terrain masks. The August update changed terrain or objectives in 27 layouts; it did not materially change the Force Disposition deployment-zone shapes. The complete source mapping, tool installation, geometry interpretation, and verification procedure is in [`docs/layout-regeneration.md`](docs/layout-regeneration.md).
