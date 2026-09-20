# Opponent lists and movement rules

Checked 20 September 2026, **11th edition**. Data: [Joe](../armies/joe-opponents.json), [Zak](../armies/zak-opponents.json). These preserve the supplied model counts and points. Joe has 59 models; Zak has 38. Joe's supplied attachments are groups; Zak's attachments and enhancement names were unspecified, so they remain separate. Select every member and use **Group selected** when assigning a Datasmith, for example. This is a planning tool, not an army-legality validator.

## Source audit

Bases were cross-checked against the [official Event Companion](https://assets.warhammer-community.com/eng_12-06_warhammer40000_event_companion-s3bfb5f9s1-ivswuij3fo.pdf) base tables and individual linked datasheets. Notable mixed units: Jakhals have nine 28.5 mm models plus one 40 mm Dishonoured; Servitor Battleclade has six 25 mm Combat Servitors and three 32 mm Underseer/Gun Servitors. Rangers default to ten 25 mm bases because weapons were unspecified; the arquebus option substitutes one 60 × 35.5 mm oval.

Hull defaults come from owner measurements, not official fixed base specifications:

- Rhino: 120 mm long × 80 mm wide, [owner report, April 2022](https://www.reddit.com/r/Warhammer40k/comments/u9gugi/).
- Skorpius Disintegrator: 155 mm long × 90 mm wide, [owner report, 23 January 2021](https://www.reddit.com/r/AdeptusMechanicus/comments/l3ag6s/).

They are rectangular envelopes, editable before adding. Protrusions and individual builds can differ. The ruler/coherency helper estimates non-circular gaps along the line of centres; do not treat it as exact hull-to-hull closest distance.

## Joe: Berzerker Warband

[Current faction rules](https://wahapedia.ru/wh40k11ed/factions/world-eaters/) and [official August v1.2 update](https://assets.warhammer-community.com/eng_wh40k_faction_pack_world_eaters-5cgvc5tjcb-nipfvwkpo5.pdf).

| Rule | Applies to this list | Calculator handling |
|---|---|---|
| Unbridled Bloodlust | Eligible units, when blessing activated; +1 charge | Optional named toggle, not an army-wide reroll |
| Battle-lust | First Slaughterbound + three Exalted: reroll charge; another +1 with Bloodlust | Automatic reroll; blessing toggle gives total +2 |
| Apoplectic Frenzy, 1CP | Khârn/Berzerkers; Advance and Charge | Named permission toggle; include Advance to average its D6 |
| To Slake its Rage | Chaos Spawn: Advance and Charge | Automatic permission; Scouts 8″, M10″ |
| Scouts | Regular Eightbound 6″; Spawn 8″ | Pre-battle distance toggle, only before moving the models |
| Slaughterbound's own Scouts | Does not give Scouts to Exalted bodyguards | Attached Exalted groups have Scout 0 |
| Angron | M14″; no Advance and Charge in supplied build | No automatic Advance and Charge; selected aura can ignore modifiers, not add moves |
| Khârn / Forgefiend rerolls | Hit/wound or shooting rerolls | Not charge rerolls |

A Command Re-roll can be enabled manually; it does not stack with Battle-lust. Conditional buffs assume the rule was activated and CP available; the app does not roll blessings or enforce army-wide CP use.

**Do not overlook the Spawn:** maximum pre-battle reach is 8 + 10 + 6 + 12 = **36″**, before terrain and other restrictions. Angron's 26″ and regular Eightbound's 28″ are not whole-army safety limits. Blood Surge (Berzerkers, D6+2″ after qualifying casualties), Goremongers' reactive D6″ move, and the Rhino's reactive disembarkation are not added to a normal-turn envelope. Move those models to their actual new positions first. No passenger is assumed embarked automatically.

## Zak: Cohort Cybernetica + Lords of the Forge

[Current faction rules](https://wahapedia.ru/wh40k11ed/factions/adeptus-mechanicus/) and [official August update](https://assets.warhammer-community.com/eng_wh40k_faction_pack_adeptus_mechanicus-nnsofctxvp-ed7amkvryu.pdf).

- **Cyber-Psalm Programming:** +2″ Move for Legio Cybernetica, already included in the Kastelan/Datasmith M8 presets.
- **Motive Imperative, 1CP:** select one eligible vehicle unit in your Command phase; +3″ Move and +1 Advance/charge until your next Command phase. Named toggle. Does not itself permit Advance and Charge.
- **Thulia's Fanatical Devotion:** select this Icon of War option and one SKITARII or THULIA GHULD unit within 6″ in the Command phase. Grants Advance and Charge. Available here for Thulia, Rangers, Ironstriders and Skorpius; not Kastelans. Range and timing must be checked manually.
- **Lords of the Forge / Overloaded Safeguards:** allows eligible Tech-Priest units to shoot/charge after falling back, not after advancing. No automatic extra distance. Datasmith protocols improve attacks/toughness, not charges. Doctrina's Assault rule is shooting permission, not charge permission.
- No inherent Advance/charge reroll found in the supplied models and detachments. Command Re-roll remains a manual option. Enhancement names were omitted; do not infer Vingh's Wafers or Necromechanic solely from their points. MOBILE affects routes rather than a universal extra range.
- Cawl's hit rerolls, Thulia's shooting rules, and Ironstrider Desperate Escape rerolls are not charge rerolls. Technoarcheologist's 12″ reinforcement exclusion is separate from threat rings and the existing generic 8″ screen overlay.

All listed datasheets were checked, including the support characters, transports and utility units. Each roster row links its datasheet. Rules from other detachments and Crusade/Boarding Actions sections are not enabled.

### Reroll controls and mean rolls

Rechecked 20 September 2026 against the linked 11th-edition rules: Joe's first Slaughterbound/Exalted group has Battle-lust charge rerolls. Unbridled Bloodlust gives that group +2 charge in total, and other eligible units +1. Neither is an army-wide Advance or charge reroll. No inherent Advance reroll was found in Joe's supplied roster.

The left percentile box exposes **Advance reroll** and **Charge reroll**. Battle-lust automatically checks and locks the latter; manual Command Re-roll never stacks another reroll. Mean raw dice are 3.50″ / 7.00″ without rerolls, or 4.25″ / 7.97″ when rerolling a below-average result once. These mean values exclude modifiers and movement, and use a mean-maximising policy. Percentile bands use a target-success-maximising policy instead. Optional checkboxes represent an available ability or CP expenditure; they do not grant permission or spend CP.
