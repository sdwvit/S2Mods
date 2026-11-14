# LairWars simulation

Offline A-Life of the whole Zone at lair level, without the game: expansion squads, battles, captures, refills
and culling, over game days. It reads the current LairWars build, so it follows whatever the mod generates.

```sh
# from the S2Mods root
node Mods/LairWars/sim/run.mts --days 10 --rank 1 --runs 3        # rank: 0 Newbie .. 3 Master
node Mods/LairWars/sim/run.mts --set sizeByOccupant=true           # override an assumed rule (rules.mts)
node Mods/LairWars/sim/run.mts --json out.json                     # full results, events and timeline
node Mods/LairWars/sim/calibrate.mts --seeds 3                     # fit against tracker recordings
```

A 10-day run takes about 10 s (2.5 s of it is reading the built 39 MB lair cfg).

A run starts like a fresh game: every lair is empty and fills by its prototype's rank block,
`InitialSpawnQuantityPercent` of its size after `InitialSpawnQuantityRespawnTimeSeconds` (vanilla 50% at 180 s),
then rising to full by `MaxSpawnQuantityRespawnTimeSeconds` (480 s). The linear rise between the two is assumed.
Calibration replays start from the recorded populations.

Culling: above `TriggerExtinction`, units are removed one at a time down to `StopExtinction`, each picked uniformly
from every living unit, in lairs and in squads on the move. The game's real rule is unknown. The cfg has
`FarLairDistance` (1000 m) and `SeenLongAgoByPlayerSec` (15 min) next to the counts, possibly victim filters, and
the code that picks victims hasn't been found in the exe yet.

## Files

- `world.mts`: lairs and their starting owners (lairTiers.mts, hubLairs.mts, mutantLairs.json, spawn actors),
  region tiers (regionTiers.mts), lair sizes per prototype, faction and rank from the built
  `GenericLairPrototypes_patch_LairWars.cfg` (vanilla where the patch sets nothing), and faction hierarchy and
  `AttackLairRestrictions` from vanilla RelationPrototypes.cfg.
- `rules.mts`: `fromMod` (imported from the transformers: cap, refill cooldowns, expansion check, need rates, squad
  sizes) and `assumed` (not known from the files or the binary; each value says where it comes from).
- `simulate.mts`: the engine. `run.mts`: the report.
- `recording.mts` and `calibrate.mts`: replay the start of Living Zone Tracker recordings (`session_logs/*.zip`) and
  compare.

## Calibration (2026-11-14)

Eight recordings of the 447-lair builds (11-09..11-13, 7.75 h, about 2,600 alive, under the unit cap so no
culling): 130 captures = 16.8 per hour, median 2 holders right after a capture, refill gaps from 39 s (refill
cooldown 40 s). Capture trips: median start distance 481 m, effective offline speed 0.83 m/s.

- `travelSpeed` 0.85 m/s, `detour` 1: measured.
- Expansion rate: every lair checking every 5 s gives 1,000+ captures/h, so the game sends far fewer squads than
  the need rates alone suggest. Two fits match: each lair sends a squad with chance 0.0003 per 5 s check
  (16.4/h, the default), or one lair for the whole Zone every 5 game minutes (`checkUnit=gameMinutes
  expansionMode=global`, 29.8/h). They differ on the new build because it has 2.7x the lairs.
- Not calibrated: the offline battle formula (`battleExponent`, `lossScale`) and target choice. Power per unit is
  BetterQuestRewards' reward per enemy x rank; the battle outcome rule is a guess. Treat which species wins as a
  trend, not a forecast.

## What it shows for the 2026-11-14 build (10 game days, Experienced)

- The unit cap still binds: lairs hold 17,340 at capacity against a 15,000 cap, so 24,000-46,000 units are culled
  over 10 days.
- A lair taken by another species keeps the lair's size: a tushkan lair taken by chimeras holds 30-45 chimeras.
  Chimeras, pseudogiants and deer grow from about 80 lairs to 250-300, and 24 S4 lairs end up in R1. With
  `sizeByOccupant=true` (the holder gets its own species' size) R1 ends with 5.
- 23-36 captures per real hour, mostly won in battle, median 140 m from the attacking lair. Pseudodogs, bayuns,
  poltergeists and burers lose the most lairs.
