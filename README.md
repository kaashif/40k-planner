# Mission Control

A static GitHub Pages reference for Warhammer 40,000 11th-edition missions and current event layouts.

The site is a compact 5×5 primary mission matrix. Selecting a cell shows both players' complete primary cards and the three matching current GDM/Battlemaster layouts. It also contains all 18 secondary mission names and a local source library containing official public PDFs and normalized JSON.

Primary-card images and all 45 layout previews are stored locally with the static site.

## Deployment CLI

The dependency-free CLI validates a list's points, base footprints, board bounds, and model overlap. It emits a planner-import JSON, a standalone SVG diagram with the mirror deployment ghosted in red, and a Markdown tactical briefing.

The bundled preset is the 1,995-point Necron list in `armies/necrons-2000.json`. Eight legal blue-side deployments are included: all three Take/Take layouts, Take/Recon layouts A and B, and all three Take/Purge layouts. The Purge plans deliberately abandon home and mass the whole army toward centre.

```sh
npm run plan -- bases
npm run plan -- validate
npm run plan:example
```

Open a deployment planner or the `/plans/` library. Its compact top bar adds complete units without asking for base sizes and exposes movement, Movement-locked dragging with live measurement, coherency, sight-line/deployment-zone audit, opponent deployment-zone infiltrate exclusion, screening, visibility, deep strike, and markup overlays. It warns when army models are neither placed nor accounted for in deep strike. Drag a box, click a unit label, or Ctrl/Cmd-click models to multi-select; dragging any selected model moves the group. Every edit and view setting is saved to local browser storage with a rolling backup. Edit the plan files listed by `plans/take-take-mirror.json` and rebuild to iterate. Coordinates are model centres in inches from the board's top-left corner on the 44×60in portrait map.

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

This refreshes all 45 maps and measured previews from GDM, rebuilds the current reference PDF, and regenerates the planner's sight-blocking terrain masks. The complete source mapping, tool installation, geometry interpretation, and verification procedure is in [`docs/layout-regeneration.md`](docs/layout-regeneration.md).
