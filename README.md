# 40k Field Notes

A VOD-first GitHub Pages site for Thousand Sons game analysis, with 11th-edition mission and deployment tools kept as secondary routes.

The homepage shows three Magnus / Grand Coven wins as a plain chronological scroll: Fowler–Parry (78–45), Fowler–Power (94–78, Priority Assets mirror), and Terroxer–Allot (92–73). Thirty-four chronological screenshots and twenty-eight matching maps show sampled board changes, with movement arrows and short source-caption excerpts. Two additional roster screenshots precede the Power game. There are no checkpoint controls, screenshot overlays or tactical takeaway cards. Diagrams are approximate visual aids, not measured maps or exact model inventories.

The original mission matrix is now at `/missions/`; `/planner/`, `/plans/` and `/reviews/` remain available. Selecting a mission cell shows both players' primary cards and the three matching layouts.

## VOD analysis

The [implementation plan](docs/vod-analysis-plan.md) records scope, evidence standards and progress. Checkpoint data and frame provenance live under `public/vod/`, with one directory per game. `game.json` records the published sequence, reviewed timestamps, roster sources and tracking limitations. Only selected commentary stills are committed; raw frames and captions stay in ignored `.cache/`. No complete videos, credentials or signed media URLs are published. Intervening-frame review recovered Fowler–Power turn-one coverage before the index timestamp; its changing camera angles are normalized to one map orientation. Terroxer’s final result comes from the match index, not the earlier live score on the last published frame.

The latest refinement records 145 inspected timestamps across the three games, including targeted shorter intervals around major moves. Trails may include additional timestamped sightings, but remain dashed because they do not establish a continuous movement route. Exact Fowler roster screens support unit identifications; Terroxer’s event list was subsequently recovered through Listhammer. Uncertain labels retain question marks. The Parry sequence now explicitly shows Magnus’s removal in turn three.

Starting reserves have separate evidence-linked notes. Fowler’s Terminators start on-board against Parry (turn-one close-up at 2700s, commentary at 2779s), but in reserve against Power (pregame declaration at 15928s). His Prince and one Enlightened unit are reported in reserve in both games; embarked Rubrics are counted separately. Terroxer’s [event list](https://listhammer.info/list/ec45dda1fb8f88261f) has no Terminators and is excluded. The 1-on / 1-off tally describes two games by one player, not a population rate. Reserve status does not establish the arrival method; Deep Strike guesses are labelled. Earlier Parry pregame dialogue conflicts with later turn-one evidence and is explicitly caveated.

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

### Fast melee study — 19 September 2026

[Army checklist, event lists and evidence-linked lessons](docs/fast-melee-vod-study.md): two additional Magnus / Grand Coven wins over Blood Angels (21 August, 11th edition) and Slaanesh Daemons (14 August, 11th edition), shown first on the homepage. Includes the existing Emperor's Children win, a comparison of three TS builds, and a [dated VOD search inventory](public/vod/search-2026-09-19.json). New stills distinguish observation from interpretation and unknowns; closing VP and team-point totals are labelled separately.

Validate with `node --test scripts/test-vod.mjs`, `npm run build` and `uv run --with playwright python scripts/check-vod-ui.py`. Publish reviewed stills with `uv run --with pillow python scripts/publish-vod-frames.py --game <game-id>` after sampling into `.cache/vod/<game-id>/`.

Each VOD now has a dedicated `/vod/<game-id>/` page with fully expanded evidence. [Personal matchup plan: Magnus vs World Eaters](docs/magnus-vs-world-eaters.md) covers the supplied lists, deployment and reserve choices.

[World Eaters deployment and charge examples](https://kaashif.github.io/40k-planner/matchups/world-eaters/) and [screening tactics](https://kaashif.github.io/40k-planner/tactics/screening/) provide three layout examples and three worked screening lessons. Run `node --test scripts/test-screening.mjs` to verify the numerical screening examples.
