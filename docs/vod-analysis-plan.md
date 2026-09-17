# VOD analysis pilot and homepage plan

Requested 17 September 2026. Scope: make evidence-backed Thousand Sons Grand Coven VOD analysis the GitHub Pages homepage, retaining the mission matrix, deployment planner, plans and reviews as secondary tools.

## Implementation sequence

1. Commit this plan before implementation. Preserve the existing untracked `wh40k-10e/` directory and all unrelated files.
2. Verify a Grand Coven game and its linked broadcast through 40kVODIndex. Record player names, broadcaster, event, edition, start/end boundaries and roster sources. Resolve contradictory metadata from the broadcast itself; do not present a wrong-game analysis.
3. Test publicly accessible frame extraction. Do not use private cookies, bypass access gates, or fabricate screenshots. Keep full video, temporary frames and signed media URLs out of Git. Publish only a small attributed set of frames needed for commentary.
4. Use adaptive sampling: an initial coarse contact sheet to locate the actual match and major board changes; inspect more densely around deployment, turn transitions, movements, arrivals and casualties. Prefer comparable overhead views at phase/turn boundaries over arbitrary five-minute snapshots. Inspect captions where available. Distinguish a sampled sequence from a complete action-by-action reconstruction.
5. For each published checkpoint, record broadcast timestamp, directly visible observations, inferred changes, unresolved identity/causality, and confidence. Track board regions, objective presence, visible pieces and score overlays without inventing exact measurements, hidden units, dice results or the cause of a disappearance.
6. Build the front page around the one-game pilot: prominent frame viewer, timestamp links, before/after comparisons, evidence notes and practical takeaways. Add a source-verified queue of other Grand Coven VODs, clearly marked unanalysed.
7. Move the current mission homepage to `/missions/`; retain `/planner/`, `/plans/` and `/reviews/` and update navigation and metadata. Support the `/40k-planner` GitHub Pages base path, keyboard navigation and mobile layouts.
8. Validate evidence records and assets, build the static export, run relevant tests/lint, visually inspect desktop/mobile, and check navigation and interactions. Commit and push the implementation, monitor GitHub Pages deployment, and open the live site in Firefox.

## Acceptance criteria

- Homepage is VOD-first, with real extracted screenshots from a verified pilot, not promotional thumbnails presented as game evidence.
- Screenshots and notes link to the exact source moment; broadcaster and index receive attribution.
- Observations, interpretations and unknowns are visibly separate. A sparse frame does not prove a unit died or used a particular rule.
- The analysis explains recoverable board-state changes and explicitly identifies gaps.
- Other VODs have validated source links and review status; old tools remain reachable.
- No credentials, downloaded full broadcasts, private cookies or temporary media URLs are published.

## Fallback

If public extraction is blocked, try another verified public Grand Coven broadcast or public playback screenshot capture. If no frames can be obtained, report the exact limitation and deliver an honestly labelled source/review workspace rather than claiming the analysis is complete. Do not disguise placeholders as evidence.

## Progress

- Starting-reserve review: published a turn-one Terminator close-up at Parry2700 and compact per-game evidence notes. Parry Terminators on-board; Power Terminators declared in reserve. Both games use the same player, so no general usage-rate claim. Prince and one Enlightened unit reported in reserve in both; Rhino passengers kept separate. Terroxer event roster recovered via Listhammer list ec45dda1fb8f88261f: no Terminators, excluded from tally; other reserve starts remain unknown. Current totals: 145 inspected frame timestamps, 34 chronological screenshots, 28 diagrams and two additional roster cards.
- Intervening-frame / roster refinement completed: 144 recorded inspected timestamps, 33 chronological screenshots, 28 diagrams and two extra Power-game roster cards. New positions capture Terroxer’s Magnus left-flank detour, intermediate Mutalith stops, Power-game turn-one coverage and Magnus’s final advance. Corrected camera-angle position drift, identified Fowler’s winged Daemon Prince, and made Parry-game Magnus removal explicit (present at9060, absent9090; commentary9231). Added timestamped trail sightings where visible; no continuous movement path claimed.
- Exact Fowler roster cards found in both broadcasts; improved Rhino, Spawn, Daemon Prince and Enlightened identifications, leaving probable Rubric/Scarab matches marked. Terroxer pregame samples showed no roster card and the linked BCP page was unreadable; no invented list. All games now use the same static chronological renderer and game.json schema. Earlier progress entries below describe superseded pilot stages.

- Final requested scope: exactly two additional Magnus / Grand Coven wins, then stop. Added Fowler–Power (94–78, seven frames, five diagrams) and Terroxer–Allot (92–73, six frames, six diagrams), both 12 August Warmaster. Twenty screenshots and sixteen maps total across three games. Power final score is visible in the broadcast; Terroxer final result is index-confirmed and kept distinct from the closing live overlay. No further VOD reviews are scheduled.

- Latest presentation revision: plain, click-free chronological scroll. All seven frames are visible, with five matching overhead maps and stronger arrows between identified sampled positions. Removed hero copy, takeaway cards, interpretation panels, screenshot number overlays and repeated explanatory text. Kept only short timestamped caption excerpts, compact labels and essential sampling caveats. SVG IDs are unique across maps. Both queued games have Magnus visually confirmed at broadcast timestamps 20400 (Fowler/Power) and 15000 (Terroxer/Allot).

- Plan committed and pushed before implementation (`6ea970a`).
- Pilot verified: Fowler/Parry, WarGames Live `WOpiPuYL0YA`, 12 August Warmaster. The index start is a countdown; reviewed opening begins at 00:40:00. Closing score 78–45 includes turn-five scoring entered after the reported elimination.
- Public frame extraction succeeded. Seven stills selected from 33 captures; caption-assisted reports stay separate from visible evidence. Full list not independently readable from BCP.
- VOD-first homepage implemented, with checkpoint navigation, overhead comparison, annotation toggles, provenance, and source-linked queue. Mission matrix moved to `/missions/`; existing tools retained.
- User requested diagrammatic analysis: hand-traced terrain and unit/group markers added for the five overhead checkpoints. Unknown identities stay labelled; non-overhead checkpoints explicitly show the earlier map timestamp. No invented exact model counts, objective control or movement paths.
- User requested three TS wins plus a Knights match if available. Queue selected: Fowler/Power (94–78, Priority Assets mirror), Terroxer El Rojo/Allot (92–73). Fowler/Pyles excluded from win selection: Fowler lost 78–100. Further footage analysis remains separate from this published pilot.
- Parallel research found a Hexwarp/Sekhetar versus Imperial Knights candidate, but the user subsequently restricted the scope to Grand Coven with Magnus. The alternate-detachment candidate is excluded. Queued Grand Coven rosters must confirm Magnus before further analysis; no qualifying Knights game is yet verified.
- Static build, eight existing CLI tests and three evidence/provenance tests pass. Lint has no errors (existing and new static-image advisories). Desktop/mobile browser checks pass for checkpoints, comparison, markers, diagram fallback, images and base-path navigation. An SVG title hydration mismatch found by the browser test was fixed. Desktop/mobile screenshots visually inspected. Live deployment follows the implementation push.
