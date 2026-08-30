# Mission Control

A static GitHub Pages reference for Warhammer 40,000 11th-edition missions and the 26 August 2026 event layouts.

The site is a compact 5×5 primary mission matrix. Selecting a cell shows both players' complete primary cards and the three matching current layouts. It also contains all 18 secondary mission names and a local source library containing official public PDFs and normalized JSON.

Primary-card images and all 45 layout previews are stored locally with the static site.

## Deployment CLI

The dependency-free CLI validates a list's points, base footprints, board bounds, and model overlap. It emits a planner-import JSON, a standalone SVG diagram with the mirror deployment ghosted in red, and a Markdown tactical briefing.

The bundled preset is Kaashif's 2,000-point Brighton Take and Hold Necron list in `armies/necrons-2000.json`. Take and Hold mirror Layout A is the first current suggested deployment. It starts the Void Dragon in deep strike, infiltrates one Flayed One unit behind the centre ruin, pushes both Wraith bricks and the Destroyer package onto forward terrain, and hides the Nightbringer and Reanimator clear of the blue home ruin. The remaining matchups are intentionally left unbundled until that first plan is vetted.

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
