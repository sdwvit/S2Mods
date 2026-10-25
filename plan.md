# Plan: LairTiers mod (tougher lairs as Skif levels up)

Goal (own mod `Mods/LairTiers`, needs DecoupledRanks for levels): every 3 DecoupledRanks levels, each lair switches to its next tier. A tier lair spawns a weighted
spread of Newbie/Experienced/Veteran/Master enemies (vanilla per-rank archetypes and gear), with HP
scaled by the tier.

## Findings this rests on

- A lair is `SpawnActorPrototypes/WorldMap_WP/<GUID>.cfg` (one struct per file, SID = GUID that
  `ToggleLairActivity` targets). Volumes are GUID refs, so a copy at the same position reuses them.
- Lair prototypes (`LairPrototypes/GenericLairPrototypes.cfg`) have one block per **player** rank,
  each with `SpawnSettingsPerArchetypes` keyed by ObjPrototype SID. LairWarTest used ObjPrototype
  clones there.
- Enemy gear comes from the archetype's item generator, whose entries are keyed by **player** rank
  (`PlayerRank`), and sub-generators (armor, pistol, NVG) are keyed the same way.
- No lair events exist. Quest nodes can only `ToggleLairActivity` (`Activate`, `ForceDespawn`).
- 381 WorldMap lairs; 203 are toggled by 484 vanilla quest nodes.

## Decisions (agreed)

- [x] All lairs eligible (lairs whose prototype spawns no archetypes, e.g. resting lairs, have nothing
      to scale and are skipped).
- [x] 10 lair tiers, one per 3 levels: T0 = 1–3 (the vanilla lair, repointed), T1..T9 = stacked copies.
- [x] Rank spread per tier (Gaussian around rank index n/3, σ = 1); Master is possible from level 1:

      | Tier | Levels | HP   | Newbie | Experienced | Veteran | Master |
      |------|--------|------|--------|-------------|---------|--------|
      | T0   | 1–3    | ×1.00 | 57.0% | 34.6% |  7.7% |  0.6% |
      | T1   | 4–6    | ×1.33 | 46.7% | 39.6% | 12.3% |  1.4% |
      | T2   | 7–9    | ×1.67 | 36.0% | 42.5% | 18.5% |  3.0% |
      | T3   | 10–12  | ×2.00 | 25.8% | 42.6% | 25.8% |  5.8% |
      | T4   | 13–15  | ×2.33 | 17.1% | 39.3% | 33.3% | 10.4% |
      | T5   | 16–18  | ×2.67 | 10.4% | 33.3% | 39.3% | 17.1% |
      | T6   | 19–21  | ×3.00 |  5.8% | 25.8% | 42.6% | 25.8% |
      | T7   | 22–24  | ×3.33 |  3.0% | 18.5% | 42.5% | 36.0% |
      | T8   | 25–27  | ×3.67 |  1.4% | 12.3% | 39.6% | 46.7% |
      | T9   | 28–30  | ×4.00 |  0.6% |  7.7% | 34.6% | 57.0% |

- [x] Stats scale ×(1 + n/3): 1× at level 1, 2× at 10, 3× at 19–21, 4× at 28–30. Starting with
      `MaxHP`; other stats get their own coefficient later (a 4× run speed would break movement).
- [x] Better armor/weapons come from vanilla rank gear: a rank-R enemy uses rank-R generator entries
      regardless of Skif's rank.
- [x] A switched-off lair's living NPCs stay (`ForceDespawn = false`).

## Consequences of "all lairs"

- Vanilla quests switch lairs off to clear an area for a scene, and back on afterwards. They only know
  the vanilla GUID, so every vanilla `ToggleLairActivity` must be mirrored onto the tier copies:
  - off → switch off every tier copy of that lair and set a per-lair "held off" flag;
  - on → clear the flag and re-apply the current tier (vanilla off again if tier > 0).
- Tier changes and world-load sync skip lairs whose flag says "held off". Lairs that start inactive
  in vanilla (`ActiveLair = false`) start with the flag set.

## Steps

- [x] Rank item generators: for every generator reachable from a lair archetype, a clone
      `<Gen>_DR<Rank>` keeping only entries for that rank (or rank-less), `PlayerRank` dropped,
      sub-generator refs pointing at their `_DR<Rank>` clones. Faction-patch drop included (XP source).
      Emitted next to the original generator, folded into the existing generator transformers.
- [x] Enemy prototypes: `<Archetype>_DR<Rank>T<n>` with `refkey=<Archetype>`: rank generator, `MaxHP` ×
      tier multiplier. Mutants have no gear, so only `_DRT<n>`. Emitted in the archetype's own file.
- [x] Lair prototypes `<LairProto>_DRT<n>`: every player-rank block gets the same mix; each enemy rank R
      contributes its vanilla block-R archetypes at `SpawnWeight × share(R)`. Quantities/timers from the
      block whose rank is the tier's centre.
- [x] Lairs: vanilla lair forked to `<LairProto>_DRT0`; copies T1..T9 in the same file,
      `refkey=<vanilla key>`, deterministic 32-hex SID, `ActiveLair = false`.
- [x] Global variables: `DecoupledRanksLairTier` (applied tier), one held-off flag per quest-toggled lair.
- [x] Quest nodes: tier step chain (applied < target → step to next tier: previous off, next on unless
      held off), launched by level changes and `ON_WORLD_LOAD`; vanilla-toggle mirrors.
- [x] `npm run prepare-configs` in Mods/DecoupledRanks; spot-check raw/ for one lair end to end.
- [ ] In-game check at one lair: tier copy spawns, vanilla stops, a quest-cleared area stays clear.
- [ ] Load-time check with all copies present.
- [x] Split out of DecoupledRanks into `Mods/LairTiers` (DecoupledRanks restored to its committed state).
- [x] DesignDocs/LairTiers.md; meta description and changenote.
- [x] Full `npm run prepare-configs` in Mods/LairTiers, then `cook-inject` (2026-10-23, 5m 48s, installed in `~mods/LairTiers`).
- [ ] Re-push DecoupledRanks to the SDK: the SDK copy of DecoupledRanksCfg still has the lair tiers from before the split.
- [ ] DLC companion (`dlc = true`): DLC1's 64 lairs and the 26 base lairs DLC quests toggle (tier 0 only for now).

# Plan: add `announce_mod_is_active` to every mod

Goal: every mod puts a `<Mod>Installed` flag effect on the player at world load, so any other mod
can detect it (DesignDocs/DetectInstalledModSpec.md).

## What a byte copy would get wrong

- The blueprint's package name is baked in: `/HeadlessArmors/announce_mod_is_active` (3 spellings
  in the name table/summary/asset registry). A plain copy into `/<Mod>/` loads under the wrong path.
- The console command is hard-coded: `XApplyEffectOnPlayer HeadlessArmorsInstalled` (2 occurrences:
  graph pin + compiled bytecode). Every copy would announce HeadlessArmors.
- The flag effect must exist per mod in `EffectPrototypes.cfg`, or `XApplyEffectOnPlayer` does nothing.
- Adding a `.uasset` to a cfg-only mod flips it to `both`: it splits into `<Mod>` (assets) +
  `<Mod>Cfg` (cfgs), needs `cook-inject` from then on (no more fast `pack-inject`), and every
  affected mod needs a re-cook and re-publish.

## Decisions for you

- [x] **Scope.** (exclusions applied: `NOT_ANNOUNCED` in src/announce-installed.mts) "Every mod" = 91 folders. Proposed exclusions: repacks (ShaysDistantHorizons150/170/250,
      Release_Render), test mods (AmokBodyDamageTest, LairWarTest), NodeBridge, HeadlessArmors itself.
      Or: only mods someone actually needs to detect.
- [x] **Blueprint approach.** A.
  - A (recommended): change the HeadlessArmors blueprint once in the Mod Editor so it builds the SID
    from its own package path (`GetPathName(self class)` → take the segment after the first `/` →
    `"XApplyEffectOnPlayer " + <segment> + "Installed"`). Then each copy only needs a package rename,
    which `renameLocalizationPackage` in `src/localization/uasset.mts` already does generically.
  - B: binary-patch the command string per copy (length changes shift export offsets; new writer code).
- [x] **Re-cook/re-publish cost.** No mass recook: mods pick it up when next built, on demand.
      First candidate: RareNPCDrops.

## Steps (assuming A + proposed scope)

- [x] You: edit `/HeadlessArmors/announce_mod_is_active` in the Mod Editor per approach A; save.
      Verified in bytecode 2026-10-14: `GetObjectClass(self)` → `Conv_ClassToSoftClassReference` →
      `Conv_SoftClassReferenceToString` → `GetPath` → `RightChop(1)` → command
      `XApplyEffectOnPlayer <SdkMod>Installed`. Delay 1.0 s.
- [x] You: flip the Branch back to `GetDisplayName(World) != "MainMenuMap"` (playable logic levels
      need the flag too; spec updated). Then I re-check the bytecode.
- [ ] Verify the edited blueprint still announces HeadlessArmors in-game (WolfArmorFetch branch).
- [x] Copy the edited asset into `src/localization/fixtures/announce-mod-is-active.uasset` as the
      template (also refreshed `Mods/HeadlessArmors/raw/`).
- [x] Add a shared step in `pullAssets()` (next to `writeModWorldSubsystemData`): if the mod is in
      scope, write `announce_mod_is_active.uasset` renamed to `/<SdkMod>/announce_mod_is_active` into
      `raw/` and the SDK mod's `Content/` (only rewrite when bytes change, like the subsystem data).
      Must target the **assets** SDK mod name, not `<Mod>Cfg`.
- [x] Add a shared `<Mod>Installed` FlagEffect helper (template from HeadlessArmors'
      `transformEffectPrototypes.mts`) and wire it into each in-scope mod's `EffectPrototypes.cfg`
      transformer; for mods that already patch that cfg, merge into the existing transformer (one
      transformer per cfg rule).
- [x] Move HeadlessArmors onto the shared helper so its flag and blueprint come from the same code.
- [x] Tests: rename produces correct package name + `_C` class path; `findWorldSubsystemClasses`
      finds the renamed copy; unchanged bytes are not rewritten.
- [ ] On demand, per mod (RareNPCDrops raw-only run done): `npm run prepare-configs`; check `raw/` gets the blueprint +
      `Autogenerated_<n>_WorldSubsystemData.uasset` + effect cfg.
- [ ] Full prepare-configs + cook-inject RareNPCDrops and confirm in-game that
      `RareNPCDropsInstalled` lands on the player.
- [x] Update `DetectInstalledModSpec.md` + AGENTS.md: every mod now provides `<Mod>Installed`.
- [ ] Changenote per mod as it ships (RareNPCDrops done).
- [ ] Re-cook + re-publish: only when you say so.

Note: steps that write into the SDK tree (`prepare-configs` pulls, cooks) run only after you approve.
