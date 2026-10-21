---
name: eng-config-transforms
description: Write configuration struct transformers in meta.mts using fork semantics, arrays, root structs, references, and iteration. Use when writing or editing structTransformers or configuration patch logic in this repository.
---

# Configuration transforms

## Transformers, not raw patches
Don't hand-write `raw/` patch cfg files for new mods. Implement the logic as
`structTransformers` in `meta.mts` that fork and modify structs programmatically.
Only write raw patches when explicitly told to.

## Multiple structs
Returning an **array** from a transformer is enough to emit multiple structs — the processor
flattens and concatenates. Don't use `context.extraStructs`.
Return `null` to skip a struct.

## `fork()` is empty
`fork()` returns an EMPTY bpatch struct — no children copied. To modify an array, clone it
off the ORIGINAL struct and assign it to the fork:

```ts
const fork = struct.fork();
const arr = struct.SomeArray.clone();
arr.entries().forEach(([key]) => { arr[key] = newValue; });
fork.SomeArray = arr;
return fork;
```

## New root structs need isRoot
Any `new Struct(name)` intended as a top-level cfg entry needs
`s.__internal__.isRoot = true` right after construction — otherwise `toString()` renders
just `struct.begin` instead of `Name : struct.begin`. Parsed structs and `fork()` get this
automatically; `new Struct()` does not.

## How the game applies patch files (retail exe, 2026-10-21)
Read from `Stalker2-Win64-Shipping.exe` disassembly (log records near `0x148edbb00`, merge
function at `0x146ca347c`; addresses are build-specific).
- **Any `.cfg` inside the folder `<stem>/` is a patch to `<stem>.cfg`.** On loading `X.cfg` the
  game strips `.bin`/`.cfg`, appends `/`, scans `X/` for `.cfg` files and applies each
  ("Applying %d .cfg files as patches from '%s' to '%s'"). The `_patch_` name is a
  convention, not a requirement (`_patch_*` globbing is only used for the binary-cache
  `.bin_patch` files). Vanilla relies on this: `GameData/ObjPrototypes.cfg` is the root and every
  file in `ObjPrototypes/` (`QuestObjPrototypes.cfg`, `GeneralNPCObjPrototypes.cfg`, the mutant
  files) is a patch merged into it. A third-party `ObjPrototypes/zzKpLMTradePatch.cfg` therefore
  patches the same tree as vanilla's QuestObjPrototypes entries.
- **Merge is per top-level key** (the struct name before `: struct.begin`, not its `SID`):
  - key absent: the node is added ("Adding struct node").
  - key present, `removenode`: the existing node is deleted.
  - key present, `bpatch`: recursive merge, field by field (see `fork()` below).
  - key present, neither: the **whole existing node is replaced** ("Replacing node"). Every
    vanilla field it doesn't restate is gone, so a non-bpatch override must re-inherit them,
    e.g. `CorpusMedlak : struct.begin {refurl=@BaseGame/ObjPrototypes/QuestObjPrototypes.cfg;refkey=CorpusMedlak}`
    plus only the changed fields. Keys can differ from SIDs (vanilla `CorpusMedlak` has
    `SID = CorpMedlak`); match the key.
- Not verified: the order patch files in one folder apply in (a sort-like routine follows the
  scan; the `zz` prefix in third-party mods assumes alphabetical), and whether a self-`refkey`
  on a replacing node resolves against the pre-replacement vanilla node. These logs sit at a
  verbosity the game doesn't print by default.

## refkey vs refurl
- New structs created in a `_patch_` file are conceptually in the **same** vanilla file:
  set `__internal__.refkey = <baseSID>` (a struct in that file) and delete
  `__internal__.refurl` if present.
- `refurl` is only for inheriting from a struct in **another** file.
- `refurl` on a bpatch struct is unnecessary — bpatch only patches existing fields, so
  don't bother clearing it on forks.

### A relative `refurl` resolves against the *patched* file, not the patch file
A patch lives one folder deeper than its target: `ItemPrototypes/DetectorPrototypes/DetectorPrototypes_patch_<Mod>.cfg`
patches `ItemPrototypes/DetectorPrototypes.cfg`. The game resolves `refurl` as if the struct sat
in the **target** file, so copy the vanilla value verbatim — do *not* add a `../` to compensate
for the patch subfolder. From that DetectorPrototypes patch, `{refurl=../ItemPrototypes.cfg}`
correctly reaches `GameData/ItemPrototypes.cfg` (verified working in FactionPatches and
DecoupledRanks); `../../ItemPrototypes.cfg` would be wrong.

### Cross-mount `refurl` needs an `@Mount` prefix
Config paths are mounted by name: `BaseGame` (the `GameLite/GameData` tree), `GameSettings`,
and one per installed mod named after the `ConfigPathName` in its `GameFeatureData` — i.e. the
mod's own name. A *relative* `refurl` resolves only inside the file's own mount, so from
`GameLite/ModGameData/<Mod>/EffectPrototypes/X.cfg` a `{refurl=../EffectPrototypes.cfg}` does
**not** reach the base game's file. Nothing warns; the struct inherits nothing and the cook
then fails with one `FParserNode.EnsureNoEntryChildNotExist ... has missing child for Key
'<name>'` per unfilled key. Prefix the mount instead — `@BaseGame/...` is relative to the
GameData root, `@<ModName>/...` addresses that mod's ModGameData tree:

    {refurl=@BaseGame/ItemPrototypes/ConsumablePrototypes.cfg;refkey=TemplateConsumable}

Patches under `GameLite/GameData/` already sit in the `BaseGame` mount, so plain relative
`refurl` works there unchanged.

## Iterating a Struct
Use `struct.forEach(cb)` or `struct.entries().forEach(cb)` — never `for...of`, which doesn't
respect Struct's internal data model. For early exit, assign to an outer variable inside the
callback.

## Patching DLC prototypes (`dlc = true`)
DLC content (Deluxe/Ultimate/PreOrder/DLC1) is NOT in the SDK GameLite tree — it lives in
the game paks under `Stalker2/Content/GameLite/DLCGameData/<DLC>/` and is extracted into
`<projectRoot>/DLCGameData` (same layout, `GameLite` prefix stripped).

DLC files are flat: every item type shares one `ItemPrototypes.cfg`, so a transformer's
`files` suffixes (e.g. `"/WeaponPrototypes.cfg"`) never match them by filename. Opt in with:

```ts
transformWeaponPrototypes.files = ["/WeaponPrototypes.cfg"];
transformWeaponPrototypes.dlc = true;
```

Then DLC cfgs are also scanned, and only structs whose origin resolves to one of `files` are
passed to the transformer. Origin is the struct's `refurl` (pointing back at the vanilla
GameData file), inherited through `refkey` for DLC-local templates; structs with no
resolvable `refurl` are skipped. Output lands in
`raw/Stalker2/Content/GameLite/DLCGameData/<DLC>/<Name>/<Name>_patch_<Mod>.cfg`.

Any mod that changes a whole prototype family (weapons, armors, attachments, consumables)
should set `dlc = true` so DLC variants behave the same.
