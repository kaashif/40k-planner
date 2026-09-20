# Thousand Sons planner roster

The editable planner now defaults to **Somehow...Magnus returned**, the supplied Grand Coven / Priority Assets army. The user-confirmed roster has one three-model bow Enlightened unit and a standalone Exalted Sorcerer on Disc. It totals 2,000 points.

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

A fresh Thousand Sons board starts empty: all **46 models** are available in the roster. Use **Add** to place a unit, or its **Deep strike** checkbox to account for the entire attached unit directly in reserve. Checking Scarabs or their Terminator Sorcerer reserves all eleven models; checking the Prince adds one more. Uncheck before adding arrivals. **Reset army off board** returns your army to the roster while retaining enemy models and drawings.

Sorcerers share movement/selection/coherency groups with their respective Rubrics. The Terminator Sorcerer shares the Scarab group. The Exalted Disc Sorcerer has his own standalone group; moving him into reserves does not move the bow Enlightened. Roster identity is stored separately from group identity, so placing a leader does not consume a bodyguard slot and moving an attached unit into deep strike carries its leader with it. Add restores only missing models from an entry.

The army selector keeps the Necron roster available. Thousand Sons saves use a separate army-and-layout key; existing Necron layout saves retain their original keys. Restoring a board includes reserve IDs when allocating new marker IDs, preventing collisions when adding models after reload.

Validation covers sizes, all model counts, attached-unit movement to reserves, coherent/non-overlapping staging, base-edge containment within the board, legacy Necron unit IDs, browser reload persistence and separation of the two armies’ saves.

Roster revision 2 corrects old drafts and named/imported plans on load: removes the duplicate bow entry and separates the Disc Sorcerer, preserving other units, positions, enemies and drawings. If only the former bow-unit-1 models remain, their positions are retained as the single bow unit.
