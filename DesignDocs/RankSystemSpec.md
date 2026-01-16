# Player Rank System Spec (GameLite)

This document describes where player Rank is defined, set, and consumed in the GameLite data. It is intended as a spec/reference for future work and design decisions.

## Rank model

- Rank values are `ERank::Newbie`, `ERank::Experienced`, `ERank::Veteran`, `ERank::Master`.
- `ERank::GetCount` appears as a sentinel value in scenario definitions (example in `GameLite/GameData/ALifePrototypes/ALifeDirectorScenarioPrototypes.cfg:371`).

## How Rank is set or switched

### Quest node rank setters (authoritative progression)

These nodes explicitly set `EModifiedCharacterParam::Rank` and appear to drive progression in shipped content.

| File (node)                                                        | SID                                                     | Rank                 |
|--------------------------------------------------------------------|---------------------------------------------------------|----------------------|
| `GameLite/GameData/QuestNodePrototypes/Arch_L.cfg:2131`            | `Arch_L_BridgeEvent_SetUp_DugaSniperMonolith`           | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/Arch_L_Assault_E08.cfg:201` | `Arch_L_Assault_E08_SetCharacterParam_PlayerRankMaster` | `ERank::Master`      |
| `GameLite/GameData/QuestNodePrototypes/E02_MQ03.cfg:2268`          | `E02_MQ03_Container_Sphere`                             | `ERank::Experienced` |
| `GameLite/GameData/QuestNodePrototypes/E03_MQ01.cfg:22550`         | `E03_MQ01_SetCharacterParam_Player_Rank_Experienced`    | `ERank::Experienced` |
| `GameLite/GameData/QuestNodePrototypes/E03_MQ05.cfg:4819`          | `E03_MQ05_SetCharacterParam_Player_Rank_Experienced`    | `ERank::Experienced` |
| `GameLite/GameData/QuestNodePrototypes/E03_MQ06.cfg:8792`          | `E03_MQ06_SetCharacterParam_Player_Rank_Experienced`    | `ERank::Experienced` |
| `GameLite/GameData/QuestNodePrototypes/E05_MQ01.cfg:10399`         | `E05_MQ01_Technical_SparkStart`                         | `ERank::Experienced` |
| `GameLite/GameData/QuestNodePrototypes/E05_MQ02.cfg:4754`          | `E05_MQ02_SetCharacterParam_Player_Rank`                | `ERank::Experienced` |
| `GameLite/GameData/QuestNodePrototypes/E05_MQ03.cfg:4095`          | `E05_MQ03_SetCharacterParam_Player_Rank`                | `ERank::Experienced` |
| `GameLite/GameData/QuestNodePrototypes/E05_MQ04.cfg:5631`          | `E05_MQ04_SetCharacterParam_Player_Rank`                | `ERank::Experienced` |
| `GameLite/GameData/QuestNodePrototypes/E06_MQ03_C01.cfg:4455`      | `E06_MQ03_C01_SetCharacterParam_PlayerVeteran`          | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/E07_MQ05.cfg:8600`          | `E07_MQ05_SetCharacterParam_PlayerVeteran`              | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/E08_MQ01.cfg:7532`          | `E08_MQ01_SetCharacterParam_Skif_Veteran`               | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/E12_MQ01.cfg:9059`          | `E12_MQ01_SetCharacterParam_Player_Rank_Master`         | `ERank::Master`      |
| `GameLite/GameData/QuestNodePrototypes/E12_MQ01.cfg:13773`         | `E12_MQ01_SetCharacterParam_Player_Rank_Master_1`       | `ERank::Master`      |
| `GameLite/GameData/QuestNodePrototypes/E14_MQ01.cfg:4583`          | `E14_MQ01_SetCharacterParam_Player_Rank_Master`         | `ERank::Master`      |
| `GameLite/GameData/QuestNodePrototypes/E16_MQ01.cfg:6801`          | `E16_MQ01_SetCharacterParam_PlayerMaster`               | `ERank::Master`      |
| `GameLite/GameData/QuestNodePrototypes/E16_MQ03.cfg:4024`          | `E16_MQ03_Technical_Strelok`                            | `ERank::Master`      |
| `GameLite/GameData/QuestNodePrototypes/EQ04.cfg:2731`              | `EQ04_SetCharacterParam_Player`                         | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/EQ04_P.cfg:260`             | `EQ04_P_SetCharacterParam_PlayerVeteran`                | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/EQ05.cfg:994`               | `EQ05_BridgeEvent_EndLooting`                           | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/EQ05_P.cfg:165`             | `EQ05_P_SetCharacterParam_Player`                       | `ERank::Newbie`      |
| `GameLite/GameData/QuestNodePrototypes/EQ05_P.cfg:229`             | `EQ05_P_SetCharacterParam_Player_1`                     | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/EQ71.cfg:45`                | `EQ71_SetCharacterParam_BP_NPCPlaceholder_BloodSucker`  | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/QTC.cfg:7834`               | `QTC_SetCharacterParam_Player_3`                        | `ERank::Experienced` |
| `GameLite/GameData/QuestNodePrototypes/QTC.cfg:7859`               | `QTC_SetCharacterParam_Player_4`                        | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/QTC.cfg:7884`               | `QTC_SetCharacterParam_Player_2`                        | `ERank::Master`      |
| `GameLite/GameData/QuestNodePrototypes/SQ102_P.cfg:277`            | `SQ102_P_SetCharacterParam_PlayerExp`                   | `ERank::Experienced` |
| `GameLite/GameData/QuestNodePrototypes/SQ102_P.cfg:303`            | `SQ102_P_SetCharacterParam_PlayerVeteran`               | `ERank::Veteran`     |
| `GameLite/GameData/QuestNodePrototypes/SQ102_P.cfg:329`            | `SQ102_P_SetCharacterParam_PlayerMaster`                | `ERank::Master`      |

### Launch-time/debug scripts (forced rank switches)

`XSwitchPlayerRank` appears in OnGameLaunch scripts and sets Rank on boot for debug/test setups. Example uses rank keywords without enum prefix: `XSwitchPlayerRank Veteran` (`GameLite/GameData/Scripts/OnGameLaunch/OnGameLaunchScripts_E08_MQ03_Spark.cfg:4`).
`XSwitchPlayerRank` also appears as `EQuestNodeType::ConsoleCommand` nodes in a small set of quests (bossfight scripts), e.g. `GameLite/GameData/QuestNodePrototypes/Arch_Bossfight_Faust.cfg:2802`.

## Rank gates and effects (progression impacts)

### World/AI population and scenario gating

- Region rank bounds per region define min/max player rank for a region (`GameLite/GameData/AIGlobals.cfg:607`).
- Mutant corpse processing allowed by faction with rank masks (`GameLite/GameData/AIGlobals.cfg:724`).
- ALife scenario archetype limits scale by player rank (`GameLite/GameData/ALifePrototypes/ALifeDirectorScenarioPrototypes.cfg:19`).
- ALife scenarios also require a minimum player rank (`GameLite/GameData/ALifePrototypes/ALifeDirectorScenarioPrototypes.cfg:390`).

### Lair and encounter spawns

Lair definitions include `SpawnSettingsPerPlayerRanks`, which scales spawn quantity, respawn timing, and archetype weights by rank.

- `GameLite/GameData/LairPrototypes.cfg:10`
- `GameLite/GameData/LairPrototypes/GenericLairPrototypes.cfg:10`

### Spawned NPCs and item containers

Spawn actors can override NPC rank and use rank-aware item generation.

- NPC rank override (example):
  `GameLite/GameData/SpawnActorPrototypes/Depo_Camp_LogicLevel_WP/25730FC14C83AA2166610788E5B381E2.cfg:21`.
- Item containers select generators by `PlayerRank`:
  `GameLite/GameData/SpawnActorPrototypes/TestMap_Balance/F3698FA54B603CEA9D3D0C968AAFDA48.cfg:24`.

### Dialog/quest gating

Dialogs use rank conditions with `EQuestConditionType::Rank` and comparison operators (example uses `GreaterOrEqual`):
`GameLite/GameData/DialogPrototypes/QA_key_UITest_DialogActions1.cfg:556`.

### Contextual actions

Contextual action nodes gate animation/behavior by minimum rank:
`GameLite/GameData/ContextualActionNodePrototypes/CA_sit_chair.cfg:3115`.

### Loot generation and rewards

Rank influences multiple loot systems:

- Global item generator entries gate by `PlayerRank` (`GameLite/GameData/ItemGeneratorPrototypes/DynamicItemGenerator.cfg:1329`).
- Gamepass generators include rank-specific entries (`GameLite/GameData/ItemGeneratorPrototypes/Gamepass_ItemGenerators.cfg:193`).
- Pack-of-items groups scale by rank (`GameLite/GameData/PackOfItemsGroupPrototypes.cfg:23`).
- Stash generators use rank-specific `SmartLootParams` (`GameLite/GameData/StashPrototypes.cfg:4`).
- Corpse clue stash weights are defined per rank (`GameLite/GameData/CorpseClueStashPrototypes.cfg:8`).

### Artifact spawn tuning and rank updates

- Artifact pity/bonus tuning changes by rank (`GameLite/GameData/CoreVariables.cfg:1258`):
  - Newbie: `AttemptsCount = 1`, Common luck +5 (`GameLite/GameData/CoreVariables.cfg:1260`).
  - Experienced: `AttemptsCount = 1`, Common +2, Uncommon +2, Rare +15 (`GameLite/GameData/CoreVariables.cfg:1270`).
  - Veteran: `AttemptsCount = 1`, Common +5, Uncommon +2, Rare +10 (`GameLite/GameData/CoreVariables.cfg:1288`).
  - Master: `AttemptsCount = 1`, Common +10, Uncommon +2, Rare +5 (`GameLite/GameData/CoreVariables.cfg:1306`).
- Rank updates trigger item regeneration with `RegenerateItemsOnRankUpdateRadius = 40000.f` and `RegenerateItemsOnRankUpdateTimer = 10.f` (`GameLite/GameData/CoreVariables.cfg:1357`).

### Trade modifiers

Trade prototypes apply buy/sell discounts per rank:
`GameLite/GameData/TradePrototypes.cfg:22`.
Rank conditions used there are defined as `EBoolProviderType::PlayerRank` providers:
`GameLite/GameData/BoolProviderPrototypes/TradeTestBoolProviderPrototypes.cfg:26`.

### NPC equipment/definitions

- Zombie allowed weapons are gated by rank (`GameLite/GameData/ObjPrototypes.cfg:566`).
- Some quest NPCs have explicit `Rank` fields (`GameLite/GameData/ObjPrototypes/QuestObjPrototypes.cfg:39`).

## NPC Rank and Faction Relationships

### NPC Rank sources

- NPC rank can be authored directly in NPC prototypes (example in quest NPCs):
  `GameLite/GameData/ObjPrototypes/QuestObjPrototypes.cfg:39`.
- Spawned NPCs can override rank per spawn actor:
  `GameLite/GameData/SpawnActorPrototypes/Depo_Camp_LogicLevel_WP/25730FC14C83AA2166610788E5B381E2.cfg:21`.
- Target/NPC rank can be queried via bool providers:
  `GameLite/GameData/BoolProviderPrototypes/TradeTestBoolProviderPrototypes.cfg:54`.

### Faction relationship model (player and faction-to-faction)

`GameLite/GameData/RelationPrototypes.cfg` defines the relationship system:

- Relation bands (numeric thresholds), min relation to trade, and rollback/cooldowns (`GameLite/GameData/RelationPrototypes.cfg:10`).
- Relationship deltas by event type (Damage/Kill/Heal/Wounded/etc.) for both character-level and faction-level reactions (`GameLite/GameData/RelationPrototypes.cfg:33`, `GameLite/GameData/RelationPrototypes.cfg:226`).
- Faction taxonomy/hierarchy (e.g., `Duty = Army`, `Freedom = FreeStalkers`)
  and special-case factions (`ArenaEnemy`, `ArenaFriend`, boss factions)
  (`GameLite/GameData/RelationPrototypes.cfg:375`).
- Initial/default relationships for `Faction<->Player` and between factions (`GameLite/GameData/RelationPrototypes.cfg:479`).

### Interconnections between Rank, NPCs, and Factions

- Rank and faction relations combine in condition logic via bool providers;
  example combined provider uses `PlayerRankExperienced` and `DutyRelation500` (`GameLite/GameData/BoolProviderPrototypes/TradeTestBoolProviderPrototypes.cfg:90`).
- Trade access and pricing use these condition providers (rank + relation thresholds), linking Rank to faction-based economy behavior (`GameLite/GameData/TradePrototypes.cfg:22`).
- ALife and AI systems use faction rules plus rank gating in other contexts:
  `MutantCorpseProcessFactionPerRank` uses faction + rank masks (`GameLite/GameData/AIGlobals.cfg:724`).
- Quest scripting can override relationships directly via
  `EQuestNodeType::ChangeRelationships`, affecting faction/NPC reaction to the player (example in `GameLite/GameData/QuestNodePrototypes/EQ08.cfg:3431`).

### Relationship-change quests audit (ChangeRelationships nodes)

- Total nodes scanned: 1830 `EQuestNodeType::ChangeRelationships` in `GameLite/GameData/QuestNodePrototypes`.
- Many nodes use `UsePreset = true` with small `RelationshipValue` numbers (often `2` or `3`), but no preset mapping is defined in `GameLite/GameData/RelationPrototypes.cfg` (treat as unresolved until code or additional data clarifies semantics).
- Direct-value changes (`UsePreset = false`, `RelationshipValue != 0`) are 115 nodes; these are the highest-impact by faction target (max absolute delta).

| Faction target      | Max delta | Example node                                                             |
|---------------------|-----------|--------------------------------------------------------------------------|
| Zombie              | +14000    | `GameLite/GameData/QuestNodePrototypes/E16_Bossfight_Scar.cfg:4113`      |
| ShahBandits         | -599      | `GameLite/GameData/QuestNodePrototypes/Garbage_L_Svora_Camp.cfg:1170`    |
| RooseveltBandits    | -599      | `GameLite/GameData/QuestNodePrototypes/Garbage_L_Voentorg_Camp.cfg:1038` |
| Spark               | +120      | `GameLite/GameData/QuestNodePrototypes/TestQuest_UI_UX.cfg:16388`        |
| Neutrals            | +100      | `GameLite/GameData/QuestNodePrototypes/E02_MQ03_C05.cfg:1190`            |
| Varta               | +100      | `GameLite/GameData/QuestNodePrototypes/E02_MQ03_C05.cfg:368`             |
| Freedom             | +50       | `GameLite/GameData/QuestNodePrototypes/SQ02.cfg:4498`                    |
| SultanBandits       | +50       | `GameLite/GameData/QuestNodePrototypes/SQ81.cfg:14569`                   |
| MALACHITE_Scientist | -50       | `GameLite/GameData/QuestNodePrototypes/SQ93.cfg:9365`                    |
| Duty                | +35       | `GameLite/GameData/QuestNodePrototypes/RSQ07_C09_S_P.cfg:613`            |

Notes:
- Many of the largest absolute deltas target specific NPC GUIDs rather than faction names (example: `SQ03_ChangeRelationships_9thMastiff` in `GameLite/GameData/QuestNodePrototypes/SQ03.cfg:8941`).
- For any given faction, there are multiple low/medium changes spread across side quests and hub/radio nodes; audit per storyline is needed to identify the key beats.

### Baseline faction relations to player

Initial `Faction<->Player` baselines are defined in `GameLite/GameData/RelationPrototypes.cfg:479`. Examples:

- Hostile defaults: `Mutant`, `Bandits`, `Monolith`, `Militaries`, `Mercenaries` set to `-800` (`GameLite/GameData/RelationPrototypes.cfg:482`).
- Neutral defaults: `Duty`, `Freedom`, `Varta`, `Neutrals`, `Spark`, `Scientists`, `Corpus`, `Noon` set to `0` (`GameLite/GameData/RelationPrototypes.cfg:488`).
- Special case: `ArenaFriend` set to `800` (`GameLite/GameData/RelationPrototypes.cfg:540`).

### Storyline/faction mapping (snapshot from direct-value ChangeRelationships)

This snapshot maps direct-value (`UsePreset = false`) relationship changes to factions. It is not exhaustive and does not include preset-driven changes.

- Neutrals: +100 in `GameLite/GameData/QuestNodePrototypes/E02_MQ03_C05.cfg:1191`, +100 in `GameLite/GameData/QuestNodePrototypes/SQ03.cfg:9300`, +75 in `GameLite/GameData/QuestNodePrototypes/SQ02.cfg:4475`.
- Varta: +100 in `GameLite/GameData/QuestNodePrototypes/E02_MQ03_C05.cfg:369`, +50/-50 in `GameLite/GameData/QuestNodePrototypes/SQ93.cfg:9318` and `GameLite/GameData/QuestNodePrototypes/SQ93.cfg:9430`.
- Freedom: +50 in `GameLite/GameData/QuestNodePrototypes/SQ02.cfg:4499`, +35 in `GameLite/GameData/QuestNodePrototypes/RSQ08_C09_S_P.cfg:597`, +30 in `GameLite/GameData/QuestNodePrototypes/RSQ08_C01_K_M.cfg:2467`.
- Duty: +35 in `GameLite/GameData/QuestNodePrototypes/RSQ07_C09_S_P.cfg:614`, +30 in `GameLite/GameData/QuestNodePrototypes/RSQ07_C06_B_A.cfg:546`, +30 in `GameLite/GameData/QuestNodePrototypes/RSQ07_C08_B_A.cfg:546`.
- Spark: +120 in `GameLite/GameData/QuestNodePrototypes/TestQuest_UI_UX.cfg:16389`, +50/-50 in `GameLite/GameData/QuestNodePrototypes/SQ93.cfg:9454` and `GameLite/GameData/QuestNodePrototypes/SQ93.cfg:9342`.
- Scientists: +35 in `GameLite/GameData/QuestNodePrototypes/RSQ09_C09_S_P.cfg:1048`, +30 in `GameLite/GameData/QuestNodePrototypes/RSQ09_C07_B_A.cfg:528`, +30 in `GameLite/GameData/QuestNodePrototypes/RSQ09_C01_K_M.cfg:2490`.
- MALACHITE_Scientist: +50/-50 in `GameLite/GameData/QuestNodePrototypes/SQ93.cfg:9478` and `GameLite/GameData/QuestNodePrototypes/SQ93.cfg:9366`.
- SultanBandits: +50 in `GameLite/GameData/QuestNodePrototypes/SQ81.cfg:14570`, +35 in `GameLite/GameData/QuestNodePrototypes/RSQ05_C10.cfg:990`, +30 in `GameLite/GameData/QuestNodePrototypes/RSQ05_C09.cfg:545`.
- ShahBandits: -599 in `GameLite/GameData/QuestNodePrototypes/Garbage_L_Svora_Camp.cfg:1171`.
- RooseveltBandits: -599 in `GameLite/GameData/QuestNodePrototypes/Garbage_L_Voentorg_Camp.cfg:1039`.
- Noon: +50 in `GameLite/GameData/QuestNodePrototypes/SQ10.cfg:5089`.
- Corpus: +35 in `GameLite/GameData/QuestNodePrototypes/RSQ10_C09_S_P.cfg:806`, +30 in `GameLite/GameData/QuestNodePrototypes/RSQ10_C08_B_A.cfg:546`, +30 in `GameLite/GameData/QuestNodePrototypes/RSQ10_C04_K_S.cfg:2619`.
- Diggers: +30 in `GameLite/GameData/QuestNodePrototypes/RSQ04_C08.cfg:577`, +30 in `GameLite/GameData/QuestNodePrototypes/RSQ04_C01.cfg:1149`, +30 in `GameLite/GameData/QuestNodePrototypes/RSQ04_C10.cfg:651`.
- NPC GUID targets: multiple large deltas target specific NPC GUIDs rather than factions (example `GameLite/GameData/QuestNodePrototypes/SQ03.cfg:8941`).


## Decisions needed for future work

1. Decide the authoritative source of rank progression (quest-driven vs. points/XP) and whether to expose thresholds in data.
2. Define whether `XSwitchPlayerRank` is allowed in non-debug builds or should be restricted to dev/test workflows.
3. Clarify if rank changes should always trigger item regeneration or if some ranks should opt out.
4. If extending the system, decide where new rank-based gates should live (lairs, loot, trade, dialogs) to keep balance consistent.
