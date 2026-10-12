---
name: eng-project-setup
description: Create a new repository component with the required directory layout, metadata, package scripts, icon, and configuration patch naming. Use when scaffolding a new component in this repository.
---

# Project setup

Each mod lives in `Mods/<ModName>/`:

1. **meta.mts** — description (BBCode), changenote, `structTransformers` array.
   For mods with only raw cfg patches, `structTransformers: []`.
2. **package.json** — scripts using the `S2_MOD=<ModName>` env var: `prepare-configs`,
   `pack-inject`, `cook-inject`, `publish-steam`, `publish-modio`, `zip-for-xbox`.
   Package name `@s2mods/<lowercase-with-hyphens>`, `private: true`.
3. **raw/Stalker2/Resources/Icon128.png** — can be copied from an existing mod.

**Do NOT create a `.uplugin` file** unless the user explicitly asks — they handle those
themselves or they already exist.

Transformer shape: a function with a `.files` property listing the cfg files to process,
returning a forked struct, an array of structs, or `null` to skip. See
[eng-config-transforms](../eng-config-transforms/SKILL.md).

Patch cfg filename convention: `<OriginalName>_patch_<ModName>.cfg`.

A mod whose `raw/` ends up holding **both** `.cfg` patches and cooked assets is automatically
built as two SDK mods — `<SdkName>` for the assets, `<SdkName>Cfg` for the cfgs — so a cfg edit
no longer drags the ~22 min cook along. It still publishes as a single mod. Nothing has to be
declared for this; `src/mod-kinds.mts` derives it from `raw/`, and
`node src/report-mod-kinds.mts` shows the result. `sdkModNameOverride` in `meta.mts` still
renames the assets half (and with it the derived cfg name) when several repo mods share one SDK
mod. See [eng-build-pipeline](../eng-build-pipeline/SKILL.md).
