# Lair tiers (LairTiers mod)

Lairs that change what they spawn as the player levels up, built from cfgs and quest nodes only.
Code: `Mods/LairTiers/lairTiers.mts` (data and builders), `lairTierQuestNodes.mts` (quest graph),
`transformLair*.mts`, `transformEnemyObjPrototypes.mts`, `transformItemGenerators.mts`.
Hard dependency on DecoupledRanks: it reads its `DecoupledRanksLevel` global variable and copies its
faction-patch drop (the XP source) onto the gear clones.

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

- Tier `n` = DecoupledRanks levels `3n+1 .. 3n+3` (10 tiers). Human HP ×(1 + n/3).
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
- Enemy rank shares per tier: Gaussian around rank index `n/3`, sigma 1 (Master 0.6% at tier 0, 57% at 9).
- `<LairProto>_LT<n>`: every player-rank block keeps its own quantities and timers; its archetype list
  is replaced by enemy rank R's vanilla archetypes at `SpawnWeight / blockTotal × share(R)`. Minimum
  quantities move to the tier's dominant rank.
- Enemies: `<Archetype>_LT<Rank>T<n>` (`refkey` the archetype) use `<Gen>_LT<Rank>`, a generator clone
  with only that rank's entries and `PlayerRank` dropped, so a Master enemy carries Master gear at any
  player rank. Mutants are `<Archetype>_LT<Rank>` (`_LT<Rank>T<n>` for weak ones).
- The vanilla lair is repointed at `_LT0`; tiers 1..9 are full copies in the same file
  (deterministic MD5 GUIDs, `ActiveLair = false`).
- Quest graph. Only lairs near the player switch, lazily, and every quest stays small: a running quest
  costs game-thread time per node (14,000 nodes always on, and a 4,100-node quest left running, each
  dropped the game to a few fps, 2026-10-23/24).
  - `LairTiers` (always on, ~65 nodes): a 30 s poll (`PollA`/`PollB`, started once by `Kick`) and
    `LairTiers_Sync` (also every world load) pick the tier the level calls for with one If chain from the
    top down (`Pick_9`..`Pick_1`, `DecoupledRanksLevel >= ` the tier's first level; `Pick_1` False is
    tier 0, the level is 0 on a new game), record it in `LairTiersApplied` (`Apply_<T>`) and restart
    batch 0 of that tier's scan. Per-tier range checks with `Less` picked every tier from 0 up to the
    right one: the scans cycled 0-1-2-3 and the Militaries camp stacked 30+ NPCs.
  - Scan: a chain of batch quests `LairTiers_Scan_<T>_<b>` (~10 lairs, <130 nodes each). A batch checks
    its lairs (`DistanceToPoint` player <= 1 km, `LairTiersLair_<GUID>` != T, held-off flag 0 for
    quest-toggled lairs), switches the matching ones (every other instance off, tier T on, tier recorded),
    restarts the next batch 0.5 s after its own start and ends with an `End` node. A batch first checks
    `LairTiersApplied == T` and ends (`_Stale`) otherwise: a scan of the old tier still running after a
    tier change switched lairs back to it (0-1-2-0-1-2), and every switch leaves a squad.
  - Old squads are not despawned on a tier switch (no `ForceDespawn`); they stay until killed.
  - Vanilla toggles are mirrored inside their quest. Off: `LairTiersHeldOff_<GUID>` = 1, the lair's tier
    = 0, and a restart of `LairTiers_Lair_<GUID>` (176 quests), which switches every copy off (with
    ForceDespawn when a vanilla node uses it) and ends. On: flag 0 and tier 0; the next nearby scan
    upgrades it.
- Quest mechanics learned here (2026-10-24):
  - `XResetQuestBySID` alone restarts a quest; adding `XStartQuestBySID` started it twice, and the
    scan chain multiplied without end.
  - A `ConsoleCommand` `XEndQuestBySID` from inside the quest did not end it; vanilla's `End` node does.
  - Conditions that must all hold go in separate groups (`[0] { [0] = A } [1] { [0] = B }`, `And`);
    conditions sharing a group are not ANDed. With them in one group the applied tier flipped 0 <-> 9.
  - `LAIRTIERS_DEBUG=1` at prepare-configs time shows "LairTiers switch <guid6> <proto> to T" on screen
    for every lair switch. Publish without it.
- Verified in game (2026-10-24, new game, level 10, Militaries camp lairs 282BB7C6 / AD113E58): a
  switched-on tier copy spawns its own squads (no map actor needed), but only after
  `InitialSpawnQuantityRespawnTimeSeconds` (180 s); the camp sat empty until then. It filled to the
  prototype cap (2 x 6) and stayed there over several polls, FPS normal.

## Spawn changes beyond scaling

- Zero-weight archetypes (vanilla `SpawnWeight = 0`, e.g. Bandit Heavy at every rank) spawn at the weight of
  the rarest enabled archetype in their block (`effectiveWeights`).
- Lairs that are `ActiveLair = false` and that no quest switches on start switched on (tier 0).
- Every modded lair and copy spawns for every player rank (`MinSpawnRank` Newbie, `MaxSpawnRank` Master).
- A placed lair spawns only its starting faction's list (`InitialInhabitantFaction`), even when its lair
  type allows several factions. Per-lair pool additions therefore go through a variant lair prototype:
  `LAIR_POOL_ADDITIONS` (`<Proto>_<name>`, emitted as `<Proto>_<name>_LT<n>` next to the vanilla one).
  The two Zaton Blinddog lairs (nearest `MarkerPrototypes` region marker: zaton) add MoldyBlinddog at
  the Blinddog weight.
- Guards are not scaled: `Guard*` lairs are left untouched, `GuardNPC_*` archetypes stay vanilla anywhere.
- `VANILLA_COOLDOWNS` keeps chosen cooldowns at vanilla: whole abilities (poltergeist passive AOE,
  anomaly activation and throw; Cat BlinkTeleport; Burer Throw) or single TriggeredCooldowns tags inside
  scaled abilities (Cat Growl, Bloodsucker Roar).

## Exclusions and quirks

- Skipped: lairs whose prototype spawns no archetypes (resting lairs), `SpawnOnStart = false` lairs
  (quest-spawned), lairs inactive in vanilla that no quest switches on.
- Lairs toggled by DLC quests get tier 0 only; mirroring DLC toggles needs a `dlc = true` companion.
- s2cfgtojson 9.1.0 renders a `refkey` that starts with digits as an index (`refkey=[38475]`), because
  `isNumber` uses `parseInt`. GUID-keyed copies are therefore full clones.

## Unverified

- That `ToggleLairActivity` reaches lairs that are offline / far away.
- Load time with ~3,300 lair copies and ~17,000 extra quest nodes.
- That a two-node `StartDelay` loop keeps polling for the whole session.
