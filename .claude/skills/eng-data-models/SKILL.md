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

## Quest conditions: one condition per group
A `Conditions` struct holds groups `[0]`, `[1]`, … with one condition each, joined by
`ConditionCheckType = EConditionCheckType::And` (vanilla `SQ18_SetDialog_SQ18_Comment_Gnutyj_Sum_Coming_Pin_2`).
Two conditions inside one group behaved as "either" (inferred from WolfArmorFetch 2026-10-16: a "near the NPC
and NPC spawned" gate fired on spawn). `Mods/WolfArmorFetch/conditions.mts` `allOf()` emits the vanilla layout.

## Walk-in triggers
- Gate: a `Condition` node holding the check, and the consumer launched by a group of `[event, pin]`
  where the pin connection has no `Name` (vanilla SQ18 pins). An `OnTickEvent` works as the event.
- Prefer `DistanceToPoint` (`TargetPoint` X/Y/Z, `NumericValue` in cm) on the NPC's stand point.
  It's vanilla's most used distance check and doesn't depend on the NPC being loaded.
- A forced `SetDialog` (`StartForcedDialog = true`, `OverrideDialogTopic = Forced`) starts the moment
  it is launched, at any distance, with lines shown as subtitles. Gate it before launching.
- Checkpoint save: `NodeType = EQuestNodeType::SaveGame` with only launchers (vanilla `EQ50_SaveGame_StartEQ`).

## SetDialog endings and dialog flow
- Launch from a SetDialog's ending by `Name = <last phrase SID>`, plus `Interrupt` (vanilla SQ92 AfterFight).
  `OutputPinNames` (`End`, `End_1`, …) are labels only: launchers on them never fire.
  For a backup, an `OnInfotopicFinishEvent` node with `InfotopicLastPhrases` also hears it.
- A last line with `NextDialogOptions [0] { NextDialogSID = , Terminate = true }` closes the dialog
  (vanilla attack lines). With `Terminate = false` the dialog stays open until Esc, and its end pins wait for it.
- `EDialogAction::Attack` on a line does not make a neutral NPC hostile on its own. Turn hostile with
  `ChangeRelationships` (player first, `UsePreset`, value 0 = Enemy) plus `ResetAI` when the dialog ends.
- A line has no on-screen time of its own; `SpeechDuration` sits on reply pickers only (always 0).
  To give a line reading time before a terminate, split it in two lines.
- Comment (said aloud, no dialog window, no player): the chain has `DialogOnTheGo = true`,
  `CanInterruptByCombat/Emission = true`, `ContinueAfterInterrupt = false`, `IsPCDialogMember = false`.
  Its phrases have `Unskippable = true`, `MainReply = false`. The SetDialog has `IsComment = true`,
  `StartForcedDialog = true` and `OverrideDialogTopic = Forced` (vanilla `SQ18_Comment_Gnutyj_Sum_Coming`;
  not yet verified in-game for a mod-added chain).
- Branch on a global variable with a dialog `If` node (`DialogMemberIndex = -1`, `NextDialogOptions { True { Conditions, NextDialogSID }, False { NextDialogSID } }`,
  vanilla `RSQ05_Dialog_Sich_C11_Finish_If_1`). GlobalVariable conditions on reply options showed every variant.
- `EDialogAction::GetItem` (`DialogActionParam` String item SID, `ItemsCount` Int) gives the player an item from a line.

## Quest-spawned NPCs and bodies
- Name: an NPC's name comes from its `NPCPrototypes.cfg` entry's `NameTextKey` (vanilla `Sultan`).
  For a named NPC, add an NPCPrototype (refkey a generic one) with `NameTextKey = sid_character_<X>`,
  an ObjPrototype with `NPCPrototypeSID = <X>`, and use `<X>` as the dialog member name.
- Dead body: a spawn actor with `SpawnType = ESpawnType::DeadBody`, `MeshPath`, `SpawnedPrototypeSID`,
  `CorpsePrototypeSID`, `DecalsMaterialSID`, `DeadPose` (vanilla `BP_DeadBodyPlaceholder` actors).
  `SpawnOnStart = false` plus a quest `Spawn` node spawns it.
- A stay `SetAIBehavior` with `GoalPriority = HigherThanCombat` keeps the NPC from fighting back;
  `HigherThanALife` holds it in place but lets combat win.
