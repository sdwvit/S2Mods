---
name: eng-build-pipeline
description: Prepare, package, build, and install repository components through their npm scripts. Covers configuration generation, when asset compilation is required, deployment, and application launch. Use when asked to prepare, cook, inject, pack, build, or install a component in this repository.
---

# Build pipeline

## Always prepare first
Run `npm run prepare-configs` from the **mod's own folder** before any cook/inject/pack.
`cook-inject` packages whatever is already in `raw/`; if `structTransformers` changed but
`raw/` wasn't regenerated, you ship stale configs.

## "prepare" ≠ "cook"
When the user says "prepare", that means `npm run prepare-configs` — nothing else.
**Never run `cook-inject` without an explicit request.** It's heavy (builds paks, injects
into the game). If unsure, ask.

## Use the npm scripts, not manual node commands
Each mod has a `package.json` with `prepare-configs`, `pack-inject`, `cook-inject`,
`publish-steam`, `publish-modio`, `zip-for-xbox`, pre-wired with the right `S2_MOD` env var
and paths. `cd` into the mod folder and run the script.

## cfg-only mods skip the SDK cook
A mod whose `raw/` contains only `.cfg` (no `.uasset`/`.umap`/audio) must NOT be cooked —
`raw/Stalker2/Content/GameLite/GameData` is copied straight into the game's own
`Stalker2/Content/GameLite/GameData`, the loose-cfg overlay the engine reads on top of the
packed data. That folder is shared by every cfg-only mod, so each install records the files it
wrote in `Mods/<ModName>/.injected-gamedata-files.json` and removes exactly those on the next
install. `src/inject-raw.mts`
(`isCfgOnlyMod()` / `injectRawIntoGame()`) implements this and `src/cook-inject.mts` picks it
automatically. A full SDK cook takes ~45 min (two ~22 min AssetRegistry scans) and buys
nothing for cfg-only mods.

## Stopping a running cook: kill the orphans, then release the SDK lock
Everything that writes to the SDK or game (`push-to-sdk`, `cookMod`, inject, ...) runs under
`withSdkMutationLock` (`src/sdk-mutation-lock.mts`): a lock **directory** at
`$(node -e 'console.log(require("os").tmpdir())')/s2mods-sdk-mutation.lock` with an `owner.json`
naming the holder's pid and label. It is only removed in a `finally`, so killing the npm/node
process (TaskStop, Ctrl+C, kill) **leaves the lock behind**, and every later
`prepare-configs`/`cook-inject` hangs on `[sdk-lock] waiting for SDK/game mutation lock` (silently,
when its output is filtered) for up to the 60 min force-release timeout.

Killing node also **does not stop the cook itself**: `dotnet AutomationTool.dll GSCCookMod…` and
`Stalker2ModEditor-Win64-Shipping-Cmd.exe -run=Cook…` keep running as orphans and keep writing
into `SavedMods/`. After stopping a cook, always:

1. Kill the orphans for that mod only — match on the mod name *and* `AutomationTool` /
   `GSCCook` / `Shipping-Cmd`. Do **not** kill a bare `Stalker2ModEditor-Win64-Shipping.exe`
   (no `-Cmd`): that is the user's interactive Mod Editor.
2. Check `owner.json`'s pid is dead (`ps -p <pid>`), then `rm -rf` the lock directory.
3. Only then start the next prepare/cook.

A cook killed between its two passes also leaves a **half-staged** tree (OverrideContent paks,
empty NewContent). `ensure-cooked` used to adopt any staged tree with no `.raw-hash` as current,
which shipped the mod without its new packages (localization SIDs showing raw). It now adopts
only when every variant whose PackageClassifier list is non-empty has a container
(`hasCompleteStagedCook`), so the next `cook-inject` re-cooks instead. If a cook-inject finishes
suspiciously fast after a killed run, check its log for `adopting it`.

## Launching the game
Any new `inject-*` / `cook-*` / `pack-*` script that should optionally start the game must
`import { maybeLaunchStalker2 } from "./launch-stalker2.mts"` and call it at the end.
Never `spawn("steam", ...)` directly — the helper centralizes the Steam app id (1643320),
the gating env vars (`LAUNCH_STALKER2_AFTER_INJECT=1`, `DRY` skip) and the detached/unref'd
spawn options. Reference call sites: `src/pack-inject.mts`, `src/cook-inject.mts`.

## One repo mod, one or two SDK mods
`src/mod-kinds.mts` classifies a mod's `raw/Stalker2/Content` into `cfgs` / `assets` / `both` /
`empty` (`classifyRawContent(rawFolder)`), and that answer decides how many SDK mods the repo mod
is built as. `node src/report-mod-kinds.mts` (`npm run report-mod-kinds`, `--split`, `--json`)
prints the classification and resulting SDK mod name(s) for every mod in `Mods/` without touching
the SDK.

- **cfgs-only / assets-only / empty** → one SDK mod, the mod's own name (or `sdkModNameOverride`).
  Nothing about these changed.
- **both** → **two** SDK mods: the assets half keeps the existing name, the cfg half gets
  `<Name>Cfg`. Which half keeps the name is not a free choice — a cooked package embeds its own
  path as `/<SdkModName>/<rest>` and the PackageClassifier addresses it the same way, so renaming
  the assets half would invalidate every cooked package it has.

Why: a cook costs ~22 min per pass and ~21 of those minutes are editor startup, independent of
what the mod ships. `.cfg` files never reach the cooker. A mixed SDK mod therefore paid a full
cook for a one-line cfg edit; the cfg half on its own has no cookable files at all, so
`ensure-cooked` always serves it with the ~9s `src/repack.mts` replay instead.

`SdkModTarget` in `src/mod-meta-paths.mts` is the per-SDK-mod path bundle (`modFolder`,
`stagedModFolder`, `packageClassifierFolder`, `stagedPakFolderFor(variant)`);
`sdkModTargets` is the 1-or-2 list, `primarySdkModTarget` the one holding the mod's own name.
`cookMod`/`createMod`/`repackMod`/`writePackageClassifierLists` all take an optional target and
default to the primary, so the legacy single-value exports (`sdkModFolder`, `sdkStagedModFolder`,
…) still point exactly where they always did.

Who does what per half: `push-to-sdk` writes the .cfgs into the cfg half (and clears stale .cfgs
out of *both*, which is the migration for mods built before the split); `pull-assets` pulls only
the primary half back into `raw/`; `ensure-cooked` fingerprints and cooks/repacks each half
independently; `inject-into-game` and `pull-staged` **merge** both staged trees into one
destination.

## Live-editing a split mod in Play In Editor
The Mod Editor only loads the half you open, the assets half, so the `<Name>Cfg` patches are
missing in PIE. To test cfgs and assets together, copy the cfgs into the main mod by hand. The
user allows these SDK copies without asking each time.

1. Copy `SDK/Stalker2/Mods/<Name>Cfg/Content/GameLite` into `SDK/Stalker2/Mods/<Name>/Content/`.
2. `grep -rE 'refurl|refkey'` the copied patches. In the editor, `refurl=../X.cfg` resolves inside
   the mod's own folder, not vanilla GameData, so the parent is missing ("File ... does not
   exist"). The struct loads without its base fields, and spawning the item stack-overflows the
   editor. For each referenced file, copy the vanilla cfg from `SDK_PATH/Stalker2/Content/GameLite/GameData`
   into the same relative path under the mod's `Content/GameLite/GameData/`. A patch with no
   `refurl` needs no vanilla copies. Never point `refurl` at the vanilla file instead: loading it
   re-applies the mod's own patches, which load it again, and the editor loops until it runs out
   of memory.
3. Restart PIE. The editor re-parses cfgs at every session start, so an editor restart is not needed.

Cleanup: `prepare-configs` (its `push-to-sdk` step) deletes these copies, so repeat steps 1–2
after every run while live-editing. Remove them by hand before any `cook-inject` or publish:
`pull-assets` copies the main SDK mod over `raw/`, so vanilla cfg copies would end up in `raw/`
and ship.

## Published as one mod, always
A split mod is still ONE Steam/mod.io/Nexus/Xbox listing. Both halves' staged trees are merged
into the single `steamworkshop/Windows/` payload by `src/pull-staged.mts`; they differ in their
`Stalker2/Mods/<sdkName>/` subfolder and in their container basenames
(`<sdkName>Stalker2-Windows-<variant>.{pak,utoc,ucas}`), so the merge is a pure overlay with no
collision and the game mounts both containers out of `notmods/<ModName>/`. Steam takes
`steamworkshop/` as its content folder, mod.io zips it, `zip-for-xbox` zips `raw/` (loose, no
paks) — none of them needs to know there are two halves. `pull-staged` throws rather than
publishing half a mod if only one half is staged.

## The PackageClassifier is generated, not authored
`GSCCookMod` cooks a mod twice and steers each pass with one of two package lists:

| pass | `-CustomConfig` | `-AssetsToCookWithDLCList` | `-AssetsToNeverCookWithDLCList` |
|---|---|---|---|
| `GSCCookModOverrideContent` | `ModCookOverrideContent` | `OverridePackages.txt` | `NewPackages.txt` |
| `GSCCookModNewContent` | `ModCookNewContent` | `NewPackages.txt` | `OverridePackages.txt` |

`ModCookNewContent/DefaultGame.ini` stages `GameLite/ModGameData` and *drops*
`GameLite/GameData`; the override config keeps it. So a package in the wrong list is cooked
under the wrong staging rules. The Mod Editor writes the pair; driving the cook from the CLI
does not, and it dies with `AssetsToNeverCookWithDLCList file not found` — so
`src/package-classifier.mts` writes them before every cook (UTF-8, no BOM, CRLF including the
last line, empty file when empty).

The rule: a package at `Content/<tail>.uasset` is `/<Mod>/<tail>`, and is **override** when the
base game ships `/Game/<tail>`, **new** otherwise (including the mod's own root `.uasset` and
anything under `__ExternalActors__`). Exceptions, all `Autogenerated_<unixtime>_<Kind>`:
`ActorPatchesData`/`ActorDeletionsData` → always override; `WorldSubsystemData`,
`LocalizationDatabase`, `ActorReplacementData` → **neither** list, which does not mean "not
shipped": an unlisted package is excluded by neither pass and so lands in *both* containers.

`src/asset-registry.mts` answers "does the base game ship it" from
`Stalker2/Releases/Latest/Windows/AssetRegistry.bin` — it parses the `LoadNameBatch` block at
the head (~1 s, cached in `.asset-registry-cache.json`) rather than grepping the 1.4 GB body.
Two traps that a substring grep gets wrong in both directions:
- the blob is concatenated with no separators, so `/Game/A/Foo` "matches" inside `/Game/A/FooBar`;
- a package path is one FName, and a trailing `_<number>` without leading zeros is split off
  into the FName's numeric part, so the shipped `.../BP_100_Rads_Bar_120` is stored as
  `.../BP_100_Rads_Bar`. `hasBaseGamePackage()` retries with that suffix stripped.

## Cook flags
Pass `-nocompile -nocompileuat` (the SDK's own `PakPlainMod.bat` does): the SDK is an installed
build, and without them RunUAT rebuilds AutomationTool and the project script modules first.
`-UnrealExe=Stalker2ModEditor-Win64-Shipping-Cmd.exe` is mandatory for the same reason — there
is no `UnrealEditor-Cmd.exe`, and the cook dies with *"Needs to be built first"* without it.
