# LairWars design

The current state of the mod, as built on 2026-11-14. The code holds the details. Each section names its file.

## Expansion

`transformNPCNeedsPresetPrototypes.mts`, `transformALifePopulationManagerFactionPrototypes.mts`, `openLairs.mts`

- Humans, zombies and every mutant species have the Expansion need. Presets that lack it in vanilla get it added (Militaries, Noon, Spark, Corpus, and the big loners on `MutantGenericNeedsNoExpansionPreset`).
- The need starts at 0 and rises at a random 5–35 per minute for each inhabitant. Squads leave a few at a time while the lair refills.
- Expansion squads can be a single member. The maximums stay vanilla: 4 (zombies 5, loners 3).
- Bayun and Pseudodog use the generic mutant preset, so they expand in packs.
- Open lairs: every lair outside the hubs lists every expanding faction, so anyone can move in anywhere. Expansion never depends on region.
  - Each added faction block is a full copy of a donor block, with the donor's tier mixes and the lair's own size.
- Every lair outside the hubs can be captured. Hub lairs keep vanilla's flag.

## Tiers

`lairTiers.mts`, `regionTiers.mts`

- **Rank tiers:** the four player-rank blocks of a lair prototype are tiers 0–3 (Newbie, Experienced, Veteran, Master). Decoupled Ranks ties rank to level: 1, 10, 20, 30.
  - Each tier is a Gaussian mix of enemy ranks.
  - Humans get rank gear and HP ×1 / ×2 / ×3.1 / ×4.2.
  - Mutants get shorter attack cooldowns (÷1 / ÷4/3 / ÷5/3 / ÷2). Weak mutants (vanilla HP under 200) also get the HP multiplier.
- **Region tiers:** a lair's tier is max(player rank tier, region tier). A lair belongs to the nearest of the 22 region centres in Living Zone Tracker `places.json`.

| Region tier | Regions | Minimum rank block |
|---|---|---|
| R1 | Lesser Zone, Cordon, Garbage | none (follows rank) |
| R2 | Chemical Plant, Rostok, Cement Factory | Experienced |
| R3 | Wild Island, Burnt Forest, Zaton, SIRCAA, Cooling Towers, Yantar, Iron Forest, Malachite | Veteran |
| R4 | Swamps, Duga, Yaniv, Red Forest, Jupiter, Pripyat, Chornobyl NPP, Generators | Master |

- A lair outside R1 uses `<prototype>_R2/_R3/_R4`, which inherits its prototype through a root refkey.
  - The rank blocks below the region rank restate that rank's block: size and enemy mix.
  - Archetypes that are only in the lower block are restated at weight 0, because nested structs inherit field by field.
  - Every faction block is restated, own and open-lair alike, so whoever holds a far lair spawns at the region tier.
- Hub lairs and guard posts never get a region variant.
- Lairs per region tier, excluding hubs and guards:

| Lairs | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| Vanilla | 63 | 43 | 106 | 100 |
| Wild (new) | 160 | 124 | 318 | 281 |

## Lair sizes

`transformGenericLairPrototypes.mts`, `LAIR_GROUPS`

Final `MaxSpawnQuantity`, Newbie / Experienced / Veteran / Master. Region variants take the size of their region's rank.

| Lair | Size |
|---|---|
| Tushkan | 30–45 (vanilla spread) |
| Blind dog, moldy blind dog | 15 |
| Flesh, boar | 12 |
| Snork | 15 / 15 / 21 / 21 |
| Bayun, pseudodog | 3 / 4 / 4 / 5 |
| Bloodsucker | 4 / 4 / 6 / 6 |
| Burer | 3 / 3 / 3 / 5 |
| Poltergeist (all kinds) | 2 / 3 / 3 / 4 |
| Controller | 2 / 4 / 6 / 8 |
| Deer | 3 / 4 / 5 / 6 |
| Pseudogiant, chimera | 2 / 3 / 5 / 6 |
| Rat | 2 / 2 / 3 / 3 |
| Humans and zombie camps | 15–21 |
| Mixed lairs and living spaces | 6–45 |
| Guards, rat swarms | vanilla |

- `range` groups are scaled ×1.5 (`CAPACITY_FACTOR`). `capacity` groups give the final size directly.
- `byRank` groups spread their size evenly by rank, whatever vanilla's sizes.

## Refill and population

`transformALifePolicyPrototypes.mts`, `transformGenericLairPrototypes.mts`

- Lair refill timers are vanilla: 180 s to the start count, 480 s to full, 480 s after a wipe.
- Wiped lairs come back after 30 min (full wipe) or 10 min (partial). Vanilla is 6 min and 2 min.
- `MinRefillDistance` is 25 m, so lairs refill while the player is close, but not within 25 m.
- Culling (extinction) starts at 15,000 living units and stops at 14,900. Vanilla is 2,000. One session had 8,800 alive, and a 4,000 cap culled them all session.

## Wild lairs

`mutantLairs.mts`, `mutantLairs.json`

- 883 single-species mutant lairs, based on GAMMA's non-human lairs. Placement rules are listed in the JSDoc of `mutantLairs.mts`: spots, distances to humans, hubs, anomalies and bases, no water, underground or closed-off ground, boss lairs 300 m apart, habitat fit, and hand edits.
- Species follow the region tier. Species tiers come from BetterQuestRewards' reward per enemy:
  - S1: tushkan, flesh, blind dog, boar, zombie
  - S2: snork, bayun, pseudodog
  - S3: burer, poltergeist, bloodsucker, controller
  - S4: deer, pseudogiant, chimera
- Target mix: R1 S1 70% / S2 30%. R2 S1 50% / S2 38% / S3 12%. R3 S2 60% / S3 30% / S4 10%. R4 S2 45% / S3 30% / S4 25%.
- Boss spacing caps S3 and S4. Half of the pseudodog and bayun lairs then became S1 (R1/R2) or snorks (R3/R4).
- Current counts:

| Species | Lairs |
|---|---|
| Snork | 341 |
| Bloodsucker | 99 |
| Pseudodog | 69 |
| Deer | 49 |
| Boar | 43 |
| Tushkan | 42 |
| Zombie | 42 |
| Flesh | 39 |
| Bayun | 39 |
| Blind dog | 32 |
| Burer | 22 |
| Controller | 22 |
| Poltergeist | 14 |
| Chimera | 12 |
| Pseudogiant | 12 |
| WildField (mixed) | 6 |

- Each lair is three cfg-only spawn actors: the spawner, a core volume and a territory volume.
- **IDs:** each SID comes from `seed`, which is the owner and position when the lair was first placed. A species change keeps the SID, so saves keep the same lairs.
- The placement scripts (`place.py`, `fill.py`, `overrides.py`, `zones.py`) ran in a session scratchpad and aren't in the repo. `mutantLairs.json` is their output.

## Saves

`transformSpawnActorPrototypes.mts`, `mutantLairs.mts`

- A spawned actor whose `NodePrototypeAppliedMods` version changed is deleted and spawned again from the new prototype, so there are no duplicates. Bump the version whenever a spawner changes.
  - Vanilla lair spawners: `APPLIED_MOD_VERSION` 4 (region variants).
  - Wild lairs: `ADDED_LAIR_VERSION` 2 (species by region, then the pseudodog/bayun cut).
- Changing a lair prototype (sizes, mixes) needs no bump. Prototypes are read live.

## Inheritance: no dotted refkeys

- The game doesn't resolve dotted sub-struct refkeys such as `refkey=Bayun_LTNewbie.VitalParams`. Bayuns above Newbie took headshots without losing HP.
- `inheritDuplicates` (the repo's cfg dedupe) writes those refkeys, so it's off in every LairWars transformer. Open-lair blocks are full copies.
- Root refkeys (`refkey=Bayun`) work and are still used.
- Cost: LairWars cfgs total 41 MB, 39 MB of it in the lair prototype patch. Vanilla GameData is 336 MB.
- Untested way to shrink it: move the shared archetype mixes into root structs of a ref file. Vanilla does this, e.g. `BoneDamageMap {refurl=../ref/refs.cfg; refkey=FleshBoneDamageMap}`.

## Simulation

`sim/` (usage and details in `sim/README.md`)

- A Node model of offline A-Life at lair level, run without the game: expansion squads, battles, captures, refills and culling, over game days. It reads the current build: lairs, owners, region tiers and the built lair sizes, plus the constants exported by the transformers.
- Run from the S2Mods root: `node Mods/LairWars/sim/run.mts --days 10 --rank 1 --seed 1 --runs 1` (`--help` lists the flags). A 10-day run takes about 10 s.
- Rules come in two kinds, both in `sim/rules.mts`:
  - `fromMod`: read from the build.
  - `assumed`: not known from the files or the binary. Each one says where its value comes from.
- **Calibration** (`sim/calibrate.mts`): eight Living Zone Tracker recordings of the 447-lair builds. They cover 7.75 h, about 2,600 alive, no culling.
  - Recorded: 16.8 captures per hour, 2 holders right after a capture, offline squads at 0.83 m/s.
  - The game sends far fewer squads than the need rates allow: every lair checking every 5 s would give 1,000+ captures per hour.
  - Fitted: each lair sends a squad with chance 0.0003 per check, which gives 16.4 per hour.
  - An alternative fits too: one lair checked for the whole Zone every 5 game minutes. The two disagree on the new build, which has 2.7× the lairs.
  - Not calibrated: the offline battle formula and target choice. Treat which species wins as a trend.
- **Findings for this build** (10 game days, Experienced):
  - The cap still binds. Lairs hold 17,340 at capacity against 15,000, so 24,000–46,000 units are culled.
  - A lair taken by another species keeps the lair's own size. A tushkan lair taken by chimeras holds 30–45, because open-lair blocks are sized for the lair, not the holder.
    - S4 lairs grow from about 80 to 250–300, and 24 end up in R1.
    - With `sizeByOccupant: true` in `rules.mts` (the holder gets its own species' size), 5 end up in R1.
  - 23–36 captures per real hour, at a median 140 m from the attacking lair.
  - Pseudodogs, bayuns, poltergeists and burers lose the most lairs.

## Open questions

- Nothing above is tested in game yet: the Bayun HP fix, region tiers, the open-lair full copies, and the new sizes.
- Should open-lair blocks be sized by the holder's species rather than the lair's? See Simulation.
- Raise the cap above the lairs' total capacity (17,340), or cut sizes?
- Each mutant's real `MaxSpawnQuantity` cap (the Living Zone Tracker panel shows it) should match the tables above after `./deploy.sh --restart` there.
