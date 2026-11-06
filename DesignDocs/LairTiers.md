# Lair tiers (part of LairWars)

Lairs that change what they spawn as the player ranks up, built from cfgs only: no quest nodes, no lair copies.
Part of LairWars (since 2026-10-29), and shipped alone as LairTiers ("Decoupled Ranks Lair Extension"): its
`meta.mts` reuses LairWars' tier code and emits only the tiers (`tierPatch`, `variantPrototype`), without LairWars'
sizes, open factions and capturing. Use one or the other.
Code: `Mods/LairWars/lairTiers.mts` (data and builders), `openLairs.mts`, `hubLairs.mts`,
`transformGenericLairPrototypes.mts`, `transformSpawnActorPrototypes.mts`, `transformEnemyObjPrototypes.mts`,
`transformAbilityPrototypes.mts`, `transformItemGenerators.mts`.
Hard dependency on DecoupledRanks: it sets the player's rank from its level, and its faction-patch drop (the XP
source) is copied onto the gear clones.

## Source cfgs

- `SpawnActorPrototypes/WorldMap_WP/<GUID>.cfg`: one lair per file (`ESpawnType::LairSpawner`). The
  struct key and `SID` are the GUID that `ToggleLairActivity.TargetQuestGuid` targets. Position, volumes
  (`LairCoreVolumes` / `LairTerritoryVolumes` / `NavModifierVolumes`, all GUID refs into the map),
  `ActiveLair`, `SpawnOnStart`, `MinSpawnRank`/`MaxSpawnRank` (player-rank band the lair exists in).
  381 lairs on the world map; the other 896 world-map entries next to them are their trigger volumes.
- `LairPrototypes/GenericLairPrototypes.cfg`: lair prototypes, no inheritance between them. Per inhabitant
  faction, one block per **player** rank (`SpawnSettingsPerPlayerRanks.Newbie..Master`) with quantity and
  respawn timers and `SpawnSettingsPerArchetypes`, keyed by ObjPrototype key
  (`MinQuantityPerArchetype`, `SpawnWeight`).
- `ObjPrototypes/*.cfg`: archetypes. A child that restates only `VitalParams.MaxHP` keeps the parent's
  other vital params (vanilla zombies do this), so nested structs merge through `refkey`.
- `ItemGeneratorPrototypes/DynamicItemGenerator.cfg` (+ `ItemGeneratorPrototypes.cfg`): NPC gear. Entries
  are gated by `PlayerRank` (the player's rank, not the NPC's) and `Diff`; armor, pistol, NVG and
  consumables come from sub-generators gated the same way. An entry without `PlayerRank` applies to all.
- `QuestNodePrototypes/*`: `ToggleLairActivity` (`Activate`, `ForceDespawn`) is the only lair node in use
  (484 in base quests, 230 lairs). `SpawnLair` appears once. No lair events or conditions exist.
- DLC1 has 64 lairs and 500 toggles in `DLCGameData/DLC1/`; DLC1 and Deluxe quests also toggle 26
  base-game lairs.

## Mechanism

- The game spawns a lair from the `SpawnSettingsPerPlayerRanks` block of the player's rank, and DecoupledRanks
  sets that rank from the level: Newbie 1-9, Experienced 10-19, Veteran 20-29, Master 30. So a tier is a rank
  block: tier n = `RANKS[n]`, at that rank's first level `L` (1, 10, 20, 30). The vanilla lair prototypes are
  patched in place: each rank block's `SpawnSettingsPerArchetypes` is replaced whole (a non-bpatch struct inside
  the bpatch) by the tier's mix; quantities and timers stay per block (scaled by LAIR_GROUPS).
- Scaling follows `L`: human HP ×(1 + (L-1)/9): 1x Newbie, 2x Experienced, 3.1x Veteran, 4.2x Master.
- Zombies (`IsZombie = true`, GeneralZombie_*) are humans for HP and gear.
- Mutants (every archetype outside GeneralNPCObjPrototypes) scale by rank through attack cooldowns,
  divided by 1, 4/3, 5/3, 2 (Newbie..Master). Only mutants under 200 vanilla `MaxHP` (blind dogs, tushkans,
  rats, ...) also get the tier HP multiplier; the rest keep vanilla HP.
- Movement speed is not scaled. On-screen NPC movement follows the locomotion animation: faster
  `MovementParams` Walk/Run/Sprint (and `MovementSpeedCoef`) only sped up off-screen movement, so a
  Master zombie looked slow when watched and jumped closer whenever the player looked away (2026-10-23
  test). A `VelocityChange` effect (vanilla `ZombificationVelocityChange`, +90%) does work but only
  takes hold when movement is recalculated (the player had to re-equip armor), and cfgs cannot put a
  permanent effect on a spawned NPC.
- Mutant cooldowns: `MutantAttackParams.<Attack>.Cooldown` on the prototype, and combat abilities
  (`AbilityPrototypes/<Mutant>Abilities.cfg`, AbilityType Attack/Charge/LongJump/PSYStrike/Throw/Summon/
  Shield/...): `TriggeredCooldowns[*].Duration` and `Min/MaxCooldown`, `CooldownMin/Max`. Clones
  `<Ability>_LT<Rank>` restate TriggeredCooldowns by index; the mutant clone repoints `Abilities.<key>.SID`.
  Roar, Berserk, Empty and TrickSound abilities keep vanilla timings.
- Enemy rank shares per tier: Gaussian around rank index `(L-1)/9`, sigma 1 (Master 0.6% as Newbie, about
  60% as Master). Each enemy rank R contributes the vanilla archetypes of block R at
  `SpawnWeight / blockTotal × share(R)`; minimum quantities move to the tier's dominant rank.
- Enemies: `<Archetype>_LT<Rank>T<n>` (`refkey` the archetype) use `<Gen>_LT<Rank>`, a generator clone
  with only that rank's entries and `PlayerRank` dropped, so a Master enemy carries Master gear at any
  player rank. Mutants are `<Archetype>_LT<Rank>` (`_LT<Rank>T<n>` for weak ones).
- Every vanilla prototype that spawns archetypes is tiered (guards excepted), so quest-spawned and DLC lairs that
  use a base-game prototype get tiers too. DLC1's own prototypes (`DLCGameData/DLC1`) are not patched.
- Old squads keep their makeup until they die; a new spawn after a rank-up uses the new block.
- History: 2026-10-23 to 10-31 tiers were stacked lair copies (`<Proto>_LT<n>` prototypes, MD5-GUID spawn actor
  copies) switched near the player by quest graphs: 45,000 nodes, then 17,000, then ~8,000 in batches. Quest
  nodes lagged the game thread and filled the save's quest-node name table (DesignDocs/SaveNameTableLimit.md).
  Saves from those builds still hold `LairTiers*` quests and variables; the cfgs no longer define them.
  Quest lessons from that work:
    - `XResetQuestBySID` alone restarts a quest; adding `XStartQuestBySID` started it twice, and the
      scan chain multiplied without end.
    - A `ConsoleCommand` `XEndQuestBySID` from inside the quest did not end it; vanilla's `End` node does.
    - Conditions that must all hold go in separate groups (`[0] { [0] = A } [1] { [0] = B }`, `And`);
      conditions sharing a group are not ANDed. With them in one group the applied tier flipped 0 <-> 9.
    - `LAIRTIERS_DEBUG=1` at prepare-configs time shows "LairTiers switch <guid6> <proto> to T" on screen
      for every lair switch. Publish without it.

## Spawn changes beyond scaling

- Zero-weight archetypes (vanilla `SpawnWeight = 0`, e.g. Bandit Heavy at every rank) spawn at the weight of
  the rarest enabled archetype in their block (`effectiveWeights`).
- Lairs that are `ActiveLair = false` and that no quest switches on start switched on (DLC quests count as quests).
- Every tiered lair spawns for every player rank (`MinSpawnRank` Newbie, `MaxSpawnRank` Master).
- A placed lair spawns only its starting faction's list (`InitialInhabitantFaction`), even when its lair
  type allows several factions. Per-lair pool additions therefore go through a variant lair prototype:
  `LAIR_POOL_ADDITIONS` (`<Proto>_<name>`, a new prototype the two lairs are pointed at, inheriting the vanilla one and restating only the tiered archetype lists of that faction).
  The two Zaton Blinddog lairs (nearest `MarkerPrototypes` region marker: zaton) add MoldyBlinddog at
  the Blinddog weight.
- Guards are not scaled: `Guard*` lairs are left untouched, `GuardNPC_*` archetypes stay vanilla anywhere.
- `VANILLA_COOLDOWNS` keeps chosen cooldowns at vanilla: whole abilities (poltergeist passive AOE,
  anomaly activation and throw; Cat BlinkTeleport; Burer Throw) or single TriggeredCooldowns tags inside
  scaled abilities (Cat Growl, Bloodsucker Roar).

## Open lairs and hubs (LairWars)

- A squad sets out when its NPCs' `AI.Need.Expansion` (NPCNeedsPresetPrototypes GoalNeeds) fills, resolved by
  `ExpansionResolverFactory` (NeedsResolvers). Vanilla gives it to the generic human preset (and its refkey
  children), zombies and MutantGenericNeedsPreset only. `transformNPCNeedsPresetPrototypes` speeds it up to
  100/min and adds need and resolver at the next index to Militaries, Noon, Spark, Corpus and
  MutantGenericNeedsNoExpansionPreset (Controller, Pseudodog, Poltergeist, Pseudogiant, Burer, rat swarms, Cat,
  Deer, Chimera). `_Guard` presets restate both lists and stay without; Scientists are no A-Life faction.
- Expansion only moves a faction into a lair whose prototype lists it in `PossibleInhabitantFactions`, and
  vanilla lists only the lair's own faction in most prototypes. `openLairs.mts` adds every faction of
  `ALifePopulationManagerFactionPrototypes` Default.Factions (29: humans, zombies, mutants; Scientists,
  IkarVarta, NeutralMSOP and the like are not there and never expand) to every prototype except `Guard*`,
  SIRCAA/MALACHITE scientists and `ELairType::RestingLair`.
- An added block inherits the donor's own block (the prototype named after the faction; Zombie:
  NeutralZombies) by nested refkey (`{refkey=Bandits.Preset.PossibleInhabitantFactions.Bandits}`): the donor as
  patched in the same file, tiers included. It restates only the per-rank `MaxSpawnQuantity` of the lair's own
  faction. Any nested struct can inherit a root struct or a
  sub-struct of one by a dotted path (vanilla: `BoneDamageMap {refurl=../ref/refs.cfg; refkey=FleshBoneDamageMap}`).
- Hub lairs (`hubLairs.mts`): guard lairs, plus lairs vanilla marks `CanBeCaptured = false` within 100 m of a
  guard lair (65 lairs; residents' camps sit 20-85 m from their guards, the nearest field camp 135 m). They
  keep vanilla's flag; every other lair and tier copy gets `CanBeCaptured = true`.

## Sizes (2026-11-01)

- LairWars cfgs: 4.7 MB (29 MB with copies and quests, 92 MB before inheritance); LairTiers 3.8 MB. Zero
  quest nodes in both. Nothing copies a vanilla struct: patches are bpatches, new structs (variants, enemy and
  ability clones) inherit by refkey and restate only what changes (ability TriggeredCooldowns by index). The
  rank item generators are full copies: they drop the other ranks' entries.

## Unverified

- That a lair already on the map takes its next spawn from the new rank block after a rank-up.
- That a faction actually moves into a single-faction lair once listed there.
- That a nested refkey inside a bpatch struct (the added-faction stubs) resolves, and to the donor as patched
  (tiers) rather than vanilla. Same question for the Zaton variant's `refkey=Blinddog`.
- Saves from the copy/quest builds: their spawned tier copies and `LairTiers*` quests have no cfg any more.
