# SDK cook speed-up: everything learned (2026-08-27)

Untracked scratch notes. Measured on this machine, this SDK, Wine/Proton, and mods:

- `AnomaliesHitAllMutants`
- `FasterLootAnimation2x/4x`
- `NPCAttachments`

## 1. Where the 40 minutes actually goes

A "cook" is **two** UAT passes:

- `GSCCookModOverrideContent`
- `GSCCookModNewContent`

Each launches a full `Stalker2ModEditor-Win64-Shipping-Cmd.exe`.

Per pass, from `Log.json` — the only UAT log with timestamps:

| Phase                                         |                      Cost |
|-----------------------------------------------|--------------------------:|
| AssetRegistry directory discovery             |     **1214 s = 20.2 min** |
| `BaseGame` config refresh #1 (151,363 `.cfg`) | 189 s, *inside* the above |
| `BaseGame` config refresh #2                  |    ~0 s — already a no-op |
| Cook itself (`Execution of commandlet took`)  |                   42–56 s |
| `UnrealPak` writing the shipped containers    |                 **1.1 s** |

The tell:

- `Execution of commandlet took: 42.23s`
- `Took 1,278.14s to run Stalker2ModEditor-...-Cmd.exe`

Everything outside the commandlet timer is startup/shutdown.

**The work is 1 minute; the startup is 42.**

Root cause: Wine per-file syscall overhead over the four mounted content paks (578 GB). Wine needs 38 s merely to *enumerate* the loose cfg tree vs 0.16 s native — ~240× — and cost is linear in file count.

## 2. Theories tested and disproved

All of these looked convincing. None is the cause.

- **DDC latency.** The 132 GB `Compressed.ddp` reports 24.85 ms latency, 0.067 MB/s. But `TotalGets = 363` and `Assets Built: 0` → ~9 s total, not 40 min.
- **The Game Data Editor's 151k `.cfg` load** — what the GSC devs reportedly say. Real, but 189 s of 1214 → ~15%.
- **`AssetRegistryDiscoveryCache=AlwaysWrite`.** The SDK ships `Never` at `Engine/Config/BaseEngine.ini:2579`. Overriding it in `Stalker2/Config/DefaultEngine.ini` changed nothing: no `AssetDiscovery cache` log line at all, timing identical. Not honoured on this code path. Reverted. Also ruled out a stale `CoalescedSourceConfigs` masking the override.
- **Cache warming.** The GameData tree is permanently in the page cache — native read of all 351 MB = 3.1 s, identical on repeat. Nothing to warm.
- **`DirectoriesToNeverCook`.** Affects cooking, not the startup scan.
- **Trimming GameData.** See §3. Measured 3.7%.

## 3. Trimming GameData: safe, and pointless

`src/trim-gamedata.mts` hides `SpawnActorPrototypes` — 86.2% of the 151,363 cfgs — by atomic `renameSync` into `$SDK_PATH/.s2mods-hidden-gamedata/`, with a marker file written *before* the first rename and restore handlers on:

- `exit`
- `SIGINT`
- `SIGTERM`
- `uncaughtException`
- `unhandledRejection`

|           |    Editor process | Commandlet | Cfgs walked |
|-----------|------------------:|-----------:|------------:|
| Untrimmed |         1322.67 s |    45.78 s |     151,363 |
| Trimmed   |         1273.34 s |    56.40 s |      20,843 |
| **Delta** | **−49 s = −3.7%** |      noise |  **−86.2%** |

Output verified identical:

`verify-cook-output: 3 same, 0 differ, 4 tolerated, 0 only-in-A, 0 only-in-B`

Zero `EnsureNoEntryChildNotExist` errors.

**Lesson: removing 86% of the files bought 3.7%.** The cfg tree was never the bottleneck — the paks are.

Off by default (`TRIM_GAMEDATA`).

Its crash-recovery path also got a real test: the Wine process died during shutdown and the directory still came back.

Earlier wrong premise worth remembering: counting only *loose* files under `Content` (151,984, 99.6% cfg) suggested a 96% win. But the SDK's actual content lives in four mounted paks, which caps the cfg share at ~16% — and the real number turned out to be 3.7%.

## 4. The one real win: `src/repack.mts`

**Insight:** the cook's last step is 1.1 s of `UnrealPak`. If the `.uasset`/`.uexp` haven't changed, the whole editor round-trip is dead weight.

`repack.mts` replays *only* the packaging tail from the existing `Cooked/` tree.

**~43 min → ~9 s for cfg-only changes.**

Derivation rules, reverse-engineered and verified against four cooked mods:

- Candidates = every file under `Cooked/` **minus** `Metadata/`, **minus** anything not under `Stalker2/Mods/<Mod>/`.
- `NewContent` ships the `.uplugin`; `OverrideContent` does **not**.
- `OverrideContent` additionally ships loose cfgs from `GameData/**`, and remaps destination:
  - `Stalker2/Mods/<Mod>/Content/X`
  - → `Stalker2/Content/X`
  
  That's what `-RemapPluginContentToGame` does, only on this pass.
- `.uasset`/`.umap` → `PakListIoStore`.
- `.uexp`/`.ubulk`/`.uptnl` are listed **nowhere** — IoStore pulls them in via the `.uasset`.
- Emission order is **files before subdirectories** (`walkFilesBeforeDirs`) — order matters for byte-identical response files.
- Response files are:
  - UTF-8 **with BOM**
  - **CRLF**
  - backslash NT paths inside
  - destination prefixed `../../../`

Verification:

- **9/9 response files byte-identical**
- `.utoc` / `.ucas` byte-identical

### The pak reproducibility trap

`.pak` bytes never match between runs.

`repak info` shows a **different path hash seed every run**:

- `223EAFB2`
- `7E319F3B`

Every pak on disk differs, even the two variants of a single mod. It is not filename-derived — CRC32 tested.

So `verifyRepack` unpacks both paks with `repak` and compares `Map<relpath, Buffer>` instead of raw bytes.

Status reads:

`match (entries; seed differs)`

### Gotchas hit while building it

- `UnrealPak` exit 3 on `FasterLootAnimation4x`: `Cooked/.../NewContent` was an empty leftover skeleton. Fixed with a zero-files guard returning `null` from `planVariant`.
- An apparent `NPCAttachments` verify failure was not a bug: the baseline pak was from Aug 25 15:56, while the cfgs were regenerated Aug 26 20:02. Repack correctly packed the *newer* content.

## 5. Wiring: `ensure-cooked.mts`

Fingerprint `raw/` **in two halves**:

- `cookable`: `.uasset .uexp .umap .ubulk .uptnl`
- `loose`: everything else

Content-hashed, never mtime.

The pipeline rewrites `raw/` itself:

- `pull-assets` copies the SDK folder back
- `prepare-configs` regenerates cfgs

So timestamps churn while bytes stay identical.

Decision tree:

- `previous.raw === rawHash` → **skip entirely**
- `previous.cookable === split.cookable` → **repack** (~9 s)
- otherwise → **cook**
- staged output with no `.raw-hash` → **adopt it**; don't burn 40 min proving it
- legacy bare-SHA1 `.raw-hash` files still parse via `startsWith("{")`

## 6. Pass analysis

`src/analyze-cook-passes.mts`:

- **71 of 85** mods can already skip the `NewContent` pass
- **3 more** could
- **11** genuinely need both

That shortcut alone halves a cold cook:

**~43 min → ~22 min**

> ⚠️ **Open risk:** an uncommitted `package-classifier.mts` change makes `AnomaliesHitAllMutants` skip `NewContent`, so its next release would **drop a pak users currently have**. Check before publishing it.

## 7. Untried lever

`-AssetGatherAll=false` / `EditorGameScansAR=false`

This is the master switch that skips the initial scan.

It's the only remaining candidate that could take **20 min → ~zero** rather than shaving a few percent.

Not run — cooks were halted by request.

## 8. Verifier design note

`verify-cook-output.mts` tolerates only *time-derived* bytes, each documented:

- `__ModKitWwiseCookAnchor_<unixtime>__`
  - Proof: two passes of one mod, same `raw/`, produced `_1787675641_` and `_1787677144_`
  - 25 min apart, exactly the gap between passes
- `Manifest_UFSFiles_Win64.txt`
  - ISO mtime per line
- `Autogenerated_<unixtime>_*`

Derived-by-containment:

- `Metadata/`
- `ChunkManifest/*.txt`
- `.pak`
- `.ucas`
- `.utoc`

**A file present on one side only always fails**, tolerated path or not.

Tolerances excuse unstable bytes, never a missing file.

`--strict` fails on tolerated diffs too.

## 9. Bottom line

| Scenario                                |  Before |       After |
|-----------------------------------------|--------:|------------:|
| cfg-only ship                           | ~43 min |    **~9 s** |
| cold cook — 71/85 mods                  | ~43 min | **~22 min** |
| cold cook — 11 mods needing both passes | ~43 min |     ~43 min |

## 10. Operational rules earned the hard way

- **Never run an SDK cook unasked.** ~22 min per pass, and it wipes `SavedMods/{Cooked,Staged}/<mod>`.
- Trust **logs with timestamps** (`Log.json`) over code comments. A stale "21 min/pass" comment sent me down the wrong path.
- Writes under `$SDK_PATH` need explicit permission.
 