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

- Plan written; implementation and extraction checks pending.
