---
name: eng-project-setup
description: Create a new mod (Mods/<ModName>) in one command with the bootstrap script src/create-mod.mts - package.json, meta.mts, transformer stubs, icon, optional raw/ prepare. Use whenever asked to create, scaffold, start or set up a new mod or component in this repository.
---

# Project setup

## Bootstrap (always start here)

One command creates the whole mod; never write these files by hand:

```bash
npm run create-mod -- <ModName> \
  --files "GameData/ObjPrototypes.cfg,ObjPrototypes/GeneralNPCObjPrototypes.cfg" \
  --files "/QuestNodePrototypes/RSQ01.cfg" \
  --description "One-line summary" \
  --prepare
```

- `<ModName>`: PascalCase, letters and digits. Fails if `Mods/<ModName>` exists.
- `--files`: one flag per transformer, comma-separated cfg paths (relative to `GameData/`,
  substrings allowed). Named `transform<FirstFileBasename>` in `transform<…>.mts`. Each path is
  checked against GameLite and a miss prints `Warning: no GameLite cfg matches`; fix the path
  before writing logic. One cfg belongs to one transformer only (AGENTS.md).
- `--description`: title line of the BBCode description; the donate footer is added.
- `--prepare`: runs `prepare-configs` with `SKIP_SDK_PUSH=1` (about 4 s): `raw/` gets the
  announce blueprint and installed-flag cfg. No SDK writes, no readme.
- Omit `--files` for a mod with no cfg edits (`structTransformers: []`).

Output: `package.json` (`@s2mods/<kebab>`, scripts `prepare-configs`, `update-readme`,
`cook-inject`, `publish-steam`, `publish-modio`, `zip-for-xbox` via `S2_MOD=<ModName>`),
`meta.mts` (description, `changenote: "Initial release."`, transformers imported),
the transformer stubs (return `null`), `raw/Stalker2/Resources/Icon128.png` (git-ignored, copied
from another mod). Everything is prettier-formatted.

Then:
1. Fill in the transformer bodies ([eng-config-transforms](../eng-config-transforms/SKILL.md)).
   Narrow the `Struct` parameter type to the s2cfgtojson prototype type when useful.
2. From `Mods/<ModName>/`: `SKIP_SDK_PUSH=1 npm run prepare-configs` while iterating
   (cheap, check the "structs written" count), plain `npm run prepare-configs` once the user
   asks to build (that pushes to the SDK and writes the readme).
3. Stay on `master`; mods are selected with `S2_MOD`, not branches.

Not done by the script: **no `.uplugin`** (push-to-sdk creates the SDK mod; don't add one unless
the user asks), no git commit, no publish metadata.

## Conventions

- **changenote**: covers only the release being prepared: everything since the last
  `publish: <ModName>` commit (`git log -1 --grep="publish: <ModName>"`). What that commit's
  changenote already said has shipped, so leave it out (see AGENTS.md, "Public-facing text").
- Transformer shape: a function with a `.files` property listing the cfg files to process,
  returning a forked struct, an array of structs, or `null` to skip.
- Patch cfg filename convention: `<OriginalName>_patch_<ModName>.cfg` (generated).

A mod whose `raw/` ends up holding **both** `.cfg` patches and cooked assets is automatically
built as two SDK mods — `<SdkName>` for the assets, `<SdkName>Cfg` for the cfgs — so a cfg edit
no longer drags the ~22 min cook along. It still publishes as a single mod. Nothing has to be
declared for this; `src/mod-kinds.mts` derives it from `raw/`, and
`node src/report-mod-kinds.mts` shows the result. `sdkModNameOverride` in `meta.mts` still
renames the assets half (and with it the derived cfg name) when several repo mods share one SDK
mod. See [eng-build-pipeline](../eng-build-pipeline/SKILL.md).
