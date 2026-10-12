---
name: eng-data-models
description: Reference for this repository's configuration data models, generated collections, effect display types, identifier references, and node graph behavior. Use when editing data generators, effect definitions, or node graphs in this repository.
---

# Data models reference

## Trader inventories (ItemGenerator)
Items are added to trade inventories by patching `DynamicItemGenerator.cfg` under
`ItemGeneratorPrototypes/DynamicItemGenerator/`:

```cfg
ExistingGenerator_Name : struct.begin {bpatch}
   ItemGenerator : struct.begin {bpatch}
      [0] : struct.begin {bpatch}
         PossibleItems : struct.begin {bpatch}
            MyItemName : struct.begin
               ItemPrototypeSID = MyItemSID
               Chance = 1
               MinCount = 1
               MaxCount = 1
            struct.end
         struct.end
      struct.end
   struct.end
struct.end
```

Medic generators: `Medic_<Location>_Consumables_ItemGenerator` (e.g. `Medic_Zalesie_…`,
`Medic_Rostok_…`). Medic TradePrototype SIDs (see `consts.mts`): Medic_Zalesie,
Medic_ChemicalPlant, Medic_Terricon, Asylum_Medic, Ikar_Medic, Sultansk_Medic,
NewbieVillage_Medic, Malakhit_Medic, CementPlant_Medic, Rostok_Medic, Yanov_Medic
(all `…_TradePrototype`).

Spec: `DesignDocs/ItemGeneratorPrototypesSpec.md`. Reference mods: X16Scopes (simplest),
FactionPatches (named entries), MasterMod (consumables).

Trade generation category for consumables: `EItemGenerationCategory::Consumable`.

## Consumable effect display (number vs bar)
Controlled in the **consumable item**, not in `EffectPrototypes`:
`ItemPrototypes/ConsumablePrototypes.cfg` (and `QuestItemPrototypes.cfg` for quest
consumables like `DvupalovVodka`). Each consumable has an `EffectsDisplayTypes` array
parallel to `EffectPrototypeSIDs`:

- `EEffectDisplayType::EffectLevel` → Weak/Strong/Max **bar**
- `EEffectDisplayType::ValueAndTime` → numeric value + duration

`ShouldShowEffects` (bool array) controls whether each effect shows at all.
`EffectPrototypes.cfg`'s `ShowUpgradeEffect` / `ShowUpgradeEffectValue` are for the
armor/weapon **upgrade screen** and do NOT affect the consumable buff HUD.

## Pill effect SIDs
Hercules → `HerculesWeight`; Cinnamon → `CinnamonDegenBleeding`;
PSYBlock → `PSYBlockerIncreaseRegen` (from LongLastingBuffs' EffectPrototypes patch).
Item prototype SIDs live in base-game ItemPrototypes — verify before use.

## Disabling a quest node
Set `Launchers = new Struct() as any` (empty launchers). Do **not** convert `NodeType` to
`Technical` — a Technical node still executes and downstream nodes still react.
If other nodes launch from the disabled node, reroute them to its upstream trigger.

Also: do NOT set `LaunchOnQuestStart = true` on an `If` node — zero vanilla If nodes do
this and it crashes the game on load. Trigger guards via a connection from a real start
node instead.

## Adding a dialog topic to a hub NPC
Verified in-game 2026-10-08 with WolfArmorFetch (Wolf, Rookie Village). Three things had to be right:
- **Topic slot.** A quest topic uses `OverrideDialogTopic = EOverrideDialogTopic::None`, as Sidorovich's
  job offer (RSQ06) and E02_SQ01's quest dialog do. `Info` is the NPC's single info slot, and the hub
  refills it with the NPC's own topic, which replaces yours.
- **Owner quest.** A hub NPC belongs to its hub quest (`RookieVillage_Hub` spawns Wolf, once per story
  phase, and re-attaches his topics). A `SetDialog` from your own quest only survived a console
  `XStartQuestBySID` next to the NPC. What works: add your `SetDialog` nodes to the hub quest itself
  (`QuestSID = <Hub>`, patched into the hub's cfg), launched by the same nodes that attach the NPC's
  vanilla Info topics. Route each re-attach with `If` nodes holding Bridge conditions on your quest's
  nodes; vanilla points Bridge conditions across quests too. See `Mods/WolfArmorFetch/transformRookieVillageHub.mts`.
- **Hearing the result back.** Your quest reacts to a hub-owned dialog with an `OnInfotopicFinishEvent`
  node (`EventType = OnDialogFinished`, `InfotopicLastPhrases` = the ending's last phrase SID), as
  E16_MQ02 does. A `SetDialog`'s own output pins are named after each ending's last phrase SID.

A side-quest marker on the NPC is `EQuestNodeType::SetQuestGiver` (`TargetQuestGuid` = NPC,
`MainQuest = false`). An `Excluding` launcher removes it again (E02_SQ01).
