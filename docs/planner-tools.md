# Planner tools

The homepage links to every tool and keeps the VOD game table. `/vod/` also provides the dedicated collection.

## Armies

The planner defaults to [the supplied Thousand Sons roster](thousand-sons-planner-roster.md), with 12 models in deep strike (Prince, Scarabs and Terminator Sorcerer). Starting positions are a roster tray, not a validated deployment.

**Enemy models** offers Joe's World Eaters and Zak's AdMech, by individual unit or whole list. Only missing models are added; attached WE groups and mixed bases are preserved. The opposing colour is selected automatically. Placement avoids other models but ignores terrain and deployment zones. [Rules and footprint audit](opponent-list-rules.md) documents sources, hull estimates, unspecified attachments and conditional buffs. Select every intended member then **Group selected** for a new attachment.

## Named plans

**Save new plan** stores a named snapshot; **Update selected save** replaces the selected snapshot. **Load saved plan** switches to its army/layout. Saved data includes both armies, reserves, group IDs, footprints, movement/Scout values, rule tags, markup, pivot lines and the current threat settings. Selecting a different model initialises a fresh threat scenario for that model.

Browser local storage holds named saves and separate army/layout drafts; legacy Necron drafts are preserved. **Export JSON** gives a portable backup; **Import JSON** validates it and creates a named copy. These saves are not automatically written to the repository or shared across browsers. The plans library lists named snapshots and per-layout drafts.

## Threat bands

Select a model, enable **Threat ranges**, and choose any applicable named buffs. Alternatively choose either opponent's unit on `/threat-ranges/`.

| Colour / stroke | Meaning |
|---|---|
| Pink solid | Maximum charge reach |
| Purple solid | At least 50% charge success |
| Cyan solid | At least 80% charge success |
| Amber dashed | Maximum Advance reach |
| Yellow dashed | At least 50% Advance reach |
| Green dashed | At least 80% Advance reach |

All distances include normal movement and optional pre-battle Scout. Charge bands only include the Advance D6 when both **Include Advance** and an applicable permission are enabled. Advance bands always show the alternative Advance move. Optional rerolls and modifiers affect probability bands; they are not fractions of maximum distance.

The calculator enumerates D6 and 2D6 outcomes. Charge rerolls reroll the full failed charge once. With an Advance reroll, it keeps an initial result if that gives at least as good a chance against the specified gap as rerolling. Probabilities condition on buffs being active, not on the odds of activating those buffs. The separate scenario readout uses the entered Advance/charge results; the pre-roll bands average over random dice. The 12″ charge-target cap is respected after movement, even with positive charge modifiers.

Ranges start at the selected model's footprint edge, not its centre or the whole unit. Oval/rectangular footprints get offset outlines. Open-ground bounds do not account for walls, route legality, flight costs, landing space, coherency, reactive moves or transport disembarkation. Do not count Scout again after moving a model.

## Pivot sight lines

Enable **Pivot sight line**. Press anywhere on the board (including a model), drag, and release: the line extends to both board edges through that pivot. Drag again to rotate around the same fixed point. **New pivot** allows another; the selector returns to an existing one; **Delete pivot** removes it. Uses the markup colour. Lines persist in drafts, named saves and JSON exports.

These are manual visual guides and do not certify visibility through terrain. The existing **Visibility** overlay and checked sight-line data are separate tools. Pivot, freehand drawing and ruler modes are mutually exclusive.

Validation: planner unit tests, CLI regression suite, production build/lint, and `scripts/check-army-planner.py` browser coverage (army switching, reserves, both opponents, mixed footprints, rule bands, pivots, saves/import/export, mobile layout).
