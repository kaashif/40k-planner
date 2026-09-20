# Planner tools

The homepage links to every tool and keeps the VOD game table. `/vod/` also provides the dedicated collection.

## Armies

The planner defaults to [the supplied Thousand Sons roster](thousand-sons-planner-roster.md), with an empty board and all units in a compact sidebar that fits the viewport without scrolling. The army selector is in the top bar. Add models when ready; a **DS** (Deep strike) checkbox in each row counts the unit as deployed in reserve without putting it on the board. Attached leaders/bodyguards are handled together. Uncheck before adding arrivals. **Reset army off board** clears your army’s board/reserve placement while preserving enemies and drawings.

**Enemy models** offers Joe's World Eaters and Zak's AdMech, by individual unit or whole list. Only missing models are added; attached WE groups and mixed bases are preserved. The opposing colour is selected automatically. Placement avoids other models but ignores terrain and deployment zones. [Rules and footprint audit](opponent-list-rules.md) documents sources, hull estimates, unspecified attachments and conditional buffs. Select every intended member then **Group selected** for a new attachment.

## Named plans

**Save new plan** stores a named snapshot; **Update selected save** replaces the selected snapshot. **Load saved plan** switches to its army/layout. Saved data includes both armies, reserves, group IDs, footprints, movement/Scout values, rule tags, markup, pivot lines and the current threat settings. Old Thousand Sons saves are corrected on load to one bow unit and a standalone Disc Sorcerer. Selecting a different model initialises a fresh threat scenario for that model.

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

## Measured arrows

Choose **Arrow**, select a bright colour using the colour swatch beside **Ruler**, then drag on the map. Each arrow displays its straight-line length in tabletop inches, updating during the drag. Arrows remain on the map and are included in autosave, named plans and JSON export/import. **Undo ink** removes the last arrow or freehand stroke; **Clear ink** removes both. Measurements are point-to-point and do not account for terrain or model bases.

## Rotating threat arrows

Threat ranges use thicker coloured rings and a matching chain of arrow segments for fixed Scout, fixed movement, and the selected overall reach probability. Drag the white handle around the selected model to rotate the entire chain; the focused handle also accepts arrow keys in 5° steps. Segments run along one direction in increasing distance order, each beginning where the previous segment ends. Arrow tips meet the appropriate ring, including oval bases and vehicle hulls. Coincident thresholds share a tip with both labels; labels are staggered to remain readable. Labels retain the base-edge threat distance, even though the arrows start at the model centre. Direction is included in saved plans and JSON.

Threat settings open in a separate right-hand sidebar that does not cover the board. **Hide threat settings** keeps the rings and arrows visible while freeing map space; **Show threat settings** brings the sidebar back.

## Percentile slider and fixed Scout

With threat ranges enabled, the left sidebar has an **Overall probability** slider (1–100%). It controls a single combined reach threshold; phase-specific maximum and 80% comparisons remain in the right-hand details. Percentages mean chance of reaching the displayed total: larger percentages give more conservative distances. At 50%, the midpoint median gives a normal D6 Advance of 3.5″ and a normal 2D6 charge of 7″, plus movement and any enabled Scout. Rerolls can separate median and arithmetic mean. “No eligible charge” at 100% means there is no guaranteed eligible charge.

Enabled Scout has its own white, fixed ring and first arrow segment. Moving the slider never changes Scout distance. Totals include Scout exactly once; switch it off after the pre-battle move. The slider value is saved with the plan.

The percentile box also has Advance/Charge reroll checkboxes and mean raw dice results. Its built-in charge checkbox is locked on for Battle-lust. Mean values exclude movement and modifiers and assume one reroll of below-average results; target-specific percentile calculations instead maximise the chance of reaching that target. See [Joe's reroll audit](opponent-list-rules.md#reroll-controls-and-mean-rolls).

## Overall probability control

The left **Overall probability** slider now chooses one probability for the complete charge-reaching sequence. The large **Total reach** value and purple arrow endpoint update together. With Advance and Charge enabled, this comes from the joint Advance/charge distribution, with both enabled rerolls accounted for; it does not add separate percentile distances or multiply two 50% targets. Scout and normal Move have fixed arrow segments. Phase-specific comparison values remain in the right-hand details.

For example, with Move 10″, Scout 8″ enabled, and unmodified Advance and Charge, the 50% total is 28.5″ (18″ fixed plus the 10.5″ median of D6 + 2D6). At 80% it is 26″. The 80% total differs from adding independently calculated 80% Advance and 80% charge results.

## Explicit phase segments

The arrow now reads **Scout → Move → Advance (D6) → Charge (2D6)**. Labels show each phase’s own distance; only the final endpoint label shows the cumulative total and selected probability. For the Spawn at 50% with no rerolls: Scout 8″, Move 10″, Advance 3.5″, Charge 7″; total 28.5″.

An overall percentile does not uniquely determine the individual dice. The illustrated split uses the conditional mean Advance among outcomes at the selected total, interpolating adjacent totals for midpoint medians. Reroll decisions match the target-success calculation. The Advance/Charge split is illustrative, not separate percentile guarantees; the final endpoint remains the actual joint-probability threshold. Right-hand scenario values now explicitly say **Advance +6″ (24″ total)** instead of suggesting a 24″ Advance roll.

## Select and delete drawings

Choose **Select** (hand-pointer icon), then click a measured arrow or freehand stroke. The selected mark gains a dashed highlight; **Delete** or **Backspace** removes only that mark. Click empty map space or press **Escape** to deselect. Keyboard users can tab to a mark and press Enter/Space to select it. Delete/Backspace in text fields continue to edit text. Drawing deletions persist in the automatic draft and can be saved/exported as usual. **Draw** now uses a thick 6 px stroke that remains visible at different map sizes.

## Draw arrows from the tip

Enable **Arrow**, then tick **Tip first**. Press at the desired arrowhead and drag back to the tail; the head stays at your initial click while the length updates. Untick to draw tail-to-tip again. Both modes save the same standard tail/head coordinates, so direction survives drafts, named saves and JSON import/export.
