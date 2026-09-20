# Thousand Sons planner roster

The editable planner now defaults to **Somehow...Magnus returned**, the supplied Grand Coven / Priority Assets army. The roster retains the user’s 2,000-point header and both listed three-model bow Enlightened entries. The app-export points and enhancements are preserved; this is not a new points-validation pass.

| Models | Base diameter | Movement |
| --- | --- | --- |
| Magnus | 100mm | 14″ |
| Winged Daemon Prince | 60mm | 13″ |
| Chaos Spawn | 50mm | 8″ |
| Exalted Sorcerer on Disc | 40mm | 10″ |
| Spear and bow Enlightened | 40mm | 10″ |
| Scarab Occult Terminators and Terminator Sorcerer | 40mm | 5″ |
| Sekhetar Robots | 40mm | 8″ |
| Sorcerers, Rubric Marines, Tzaangors | 32mm | 6″ |

Sizes and Movement were checked on 20 September 2026 against the individual linked 11th-edition datasheets. Each entry in [the roster](../armies/thousand-sons-2000.json) records its source; the sidebar links to it. In particular the Thousand Sons Sorcerer entry specifies 32mm, and Sekhetar Robots specify 40mm. These are the defaults for the named datasheets, not a measurement of a user’s conversion or alternative model.

On a fresh Thousand Sons board, all **49 supplied models** are accounted for: 37 in a spaced staging tray and 12 in deep strike (ten Scarabs, the Crystal Terminator Sorcerer and the winged Prince). **Staging is not a suggested legal deployment**; it gives the user correctly sized models to move onto the selected layout. Load army staging restores this complete roster. Return DS puts reserve models back into their staging positions.

Sorcerers share movement/selection/coherency groups with their respective Rubrics. The Terminator Sorcerer shares the Scarab group. As assumed in the analysed plan, the Exalted Disc Sorcerer joins bow Enlightened unit 1. Roster identity is stored separately from group identity, so placing a leader does not consume a bodyguard slot and moving an attached unit into deep strike carries its leader with it. Add restores only missing models from an entry.

The army selector keeps the Necron roster available. Thousand Sons saves use a separate army-and-layout key; existing Necron layout saves retain their original keys. Restoring a board includes reserve IDs when allocating new marker IDs, preventing collisions when adding models after reload.

Validation covers sizes, all model counts, attached-unit movement to reserves, coherent/non-overlapping staging, base-edge containment within the board, legacy Necron unit IDs, browser reload persistence and separation of the two armies’ saves.
