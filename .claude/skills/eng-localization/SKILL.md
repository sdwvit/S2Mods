---
name: eng-localization
description: Look up localized text by identifier or English text, rebuild per-culture JSON catalogs from binary resources, derive text identifiers, and update localization assets through src/localization/uasset.mts. Use when looking up or adding localized text in this repository.
---

# Localization lookup

`locale/<culture>.json` is the dump to search: one file per language, a flat `{sid: text}` map,
extracted from the retail `.locres` files (see below). 18 files, 119 MB, **git-ignored** — it is
regenerable from any install, and the root-level one-file version was too big for an editor to open.

```
locale/en.json  locale/uk.json  locale/de.json  locale/fr.json  locale/es.json  locale/it.json
locale/pl.json  locale/cs.json  locale/tr.json  locale/sr.json  locale/pt-BR.json
locale/es-419.json  locale/ar.json  locale/zh-Hans.json  locale/zh-Hant.json  locale/ja.json
locale/ko.json  locale/ru.json
```

Filenames are the game's own culture codes, matching the `.locres` path each came from — so
Ukrainian is `uk`, not the `ua` the old single-file dump used as a key.

**A SID absent from a file means that language ships no text for it.** Only 49,566 of the 82,857
SIDs have English text at all; the rest are placeholders and cut content that ship an empty string.
So "not in the dump" is often true of a SID that exists but is blank — check another language before
concluding the extraction missed something.

**Search case-insensitively.** Both halves of a phrase can be present while the phrase as typed is
not: `Надійна Ничка` finds nothing, `надійна ничка` finds `sid_stashes_Gen_Stash15_name`
("Very Safe Stash").

```bash
python3 -c "
import json, glob
q = 'search_term'.lower()
for f in sorted(glob.glob('locale/*.json')):
    for sid, text in json.load(open(f)).items():
        if q in text.lower() or q in sid.lower():
            print(f.split('/')[-1][:-5], sid, '|', text[:120])
"
```

Extracted 2026-09-15 from retail. The root-level `TextLocalizations.json` this replaces is **gone**
(deleted 2026-09-15, recoverable from git history): it was April, en/ua only, and 37,512 SIDs —
missing 45,377 of them, with 98 stale English strings (`sid_character_army_0` was the placeholder
"Army"; it is really "Unknown military"). Do not go looking for it. The SDK's
`Stalker2/Content/TextToolBackup/TextDatabase.json` is a 0-byte stub on this machine, so it is not
a source; do not reach for it.

SID prefixes:
- `sid_character_<npc_prototype_id>` — NPC names (e.g. `sid_character_micman_0` → "Ensign")
- `sid_topic_` — dialog topic titles
- `sid_label_` — dialog option labels
- `sid_phrase_` — full dialog lines
- `sid_notes_` — notes/documents

**Keys a new dialog or journal quest needs** (from vanilla RSQ06 and Wolf's hub dialogs; example in
`Mods/WolfArmorFetch/writeLocalization.mts`):
- `sid_topic_<DialogChainSID>`: the topic line in the NPC's menu
- `sid_phrase_<TextToolPhraseSID>`: a spoken line. A `DialogPrototype` with no `TextToolPhraseSID` has
  no text key; vanilla copies (`..._41275_1`) reuse the original's `TextToolPhraseSID`
- `sid_label_<TextToolPhraseSID minus its last _segment>`: the short reply option for a player line
- Name every `TextToolPhraseSID` `<label SID>_<NNN>`, the dialog asset's phrase scheme (see below);
  vanilla uses `<label>_<5-digit id>` the same way. The game splits off the last `_<segment>` to find
  the label, so an id like `_1` on `Foo_Accept_Wolf_1` was read in-game (2026-10-08) as
  `sid_phrase_Foo_Accept_Wolf`, and `Foo_Accept_Accepted_1`'s label as `sid_label_Foo_Accept`
- `sid_journal_<QuestSID>_Name`, `sid_journal_description_<DescriptionSID>`,
  `sid_journal_stage_<StageSID>`: the journal (keyed by the stage SID, not its `Description` field)

**Dialog label derivation:** a node SID like `RSQ01_Dialog_Warlock_RSQ_confirm_26957` maps to
`sid_label_RSQ01_Dialog_Warlock_RSQ_confirm` — strip the trailing numeric suffix, prepend
`sid_label_`. That label text is what appears as an answer option in WaitForReply pickers.

## All eighteen languages: the retail `.locres` files

This is where `locale/` comes from, and how to rebuild it when a patch lands. It
matters because a mod overriding a vanilla SID must supply *every* language or the other seventeen
fall back to English, and the shipped text is the only source of the official wording. Reachable
without any IoStore tooling:

```bash
# loose files inside the .pak, NOT in the .utoc — plain repak reaches them
repak list "$STALKER2_FOLDER/Stalker2/Content/Paks/pakchunk0-Windows.pak" | grep locres
repak get  "$STALKER2_FOLDER/.../pakchunk0-Windows.pak" \
  Stalker2/Content/Localization/Game/de/Game.locres > de.locres
```

Cultures: `en uk de fr es it pl cs tr sr pt-BR es-419 ar zh-Hans zh-Hant ja ko ru`, mapping onto the
`ELocalizationLanguage` members in that order (`es`→SpanishEuropean, `es-419`→SpanishLatinoAmerican,
`pt-BR`→PortugalBrazilian). ~82k SIDs each, all in one namespace, `ST_S2BaseGameLocalization`.

Format is `FTextLocalizationResource` **v3** (`Optimized_CityHash64_UTF16`): 16-byte magic
(`0e 14 74 75 …`), version byte, `int64` string-table offset; at that offset `int32` count then
`FString` + `int32` refcount each; back at the header an `int32` entry count, `int32` namespace
count, then per namespace `(uint32 hash, FString)` + key count + per key
`(uint32 hash, FString, uint32 sourceHash, int32 stringIndex)`. `FString` is `int32` length —
negative means UTF-16LE of `-n` chars — and both encodings include the terminator.

`Mods/NamedArtifactFetchQuests/labels.json` is text extracted this way and committed as data; the
parser was deliberately **not** kept in `src/`, so rebuild it from the spec above if a patch
changes the shipped wording.

## Overriding a vanilla SID works

A mod's localization database **does** override base-game text, not just add new keys — verified
in-game 2026-09-15 with NamedArtifactFetchQuests, which rewrites 22 vanilla `sid_label_*` RSQ
dialog options and needs no cfg patch at all. So renaming any shipped string is a text-only mod.

## Item name and description SIDs

An item's displayed name and description are **not** fields on the prototype — the game derives
their localization SIDs from the item prototype's own `SID`:

```
sid_items_<ItemSID>_name
sid_items_<ItemSID>_description
sid_items_<ItemSID>_short_name   # optional; weapons/ammo only, used in tight UI slots
```

So an `ItemPrototype` with `SID = Bear` reads `sid_items_Bear_name` ("Bear Detector") and
`sid_items_Bear_description`. A new modded item needs nothing but a matching pair of these SIDs —
without them the UI shows the raw SID string.

Look them up in `locale/` like anything else:

```bash
python3 -c "
import json
en = json.load(open('locale/en.json'))
for sid, text in en.items():
    if sid.startswith('sid_items_Bear_'): print(sid, '|', text)
"
```

## Shipping mod text: the per-mod localization uasset

A mod ships its strings in `raw/Stalker2/Content/<ModName>-localization.uasset`, a
`LocalizationModTextToolAsset` whose single export is a `LocalizedTexts` array of
`{ SID, LanguagesToLocalizedStrings }`. Read and rewrite it with `src/localization/uasset.mts`:

```bash
node src/localization/uasset.mts <file.uasset>   # dump summary/imports/exports as JSON
```

```ts
import { writeLocalizedTexts } from "../../src/localization/uasset.mts";
writeLocalizedTexts(file, [
  { SID: "sid_items_Foo_name", LanguagesToLocalizedStrings: { "ELocalizationLanguage::English": "Foo" } },
]);
```

`writeLocalizedTexts` replaces the whole array, so build the complete entry list every run.

### Where it is authored, and how it reaches the game

The mod's `writeLocalization.mts` is the single source of truth for the text. The `.uasset` is
build output that happens to be committed (a checkout must be able to pack without the SDK), so
nothing reads its old content: `writeLocalizedTexts` rebuilds the `LocalizedTexts` array *and* the
name table from the entries alone, which makes the bytes a function of the entries plus the
package's identity - rewriting with fewer entries shrinks the table instead of leaving orphans.

`writeModLocalization` therefore takes an existing package only as a **template** for that
identity, and writes the result to two places:

- `raw/Stalker2/Content/<ModName>-Localization<N>.uasset` - the committed artifact, and what a
  no-SDK checkout packs.
- the SDK mod's `Content/` (through the mod's `sdk` symlink), which is where the cook picks it up.
  The template is this copy when the symlink is live, because it is the one the Mod Editor created.

Both copies are byte-identical afterwards, so `pull-assets` (which copies the SDK folder over
`raw/` at the start of every cook) is a no-op for it. There is deliberately **no** localization
filter in `pull-assets` any more: a text asset authored in the Mod Editor for a mod with no
`writeLocalization.mts` has to reach `raw/` like any other package, or it is never committed and
never packed.

Nothing has to be registered: the `.uplugin` does not enumerate assets, and
`writePackageClassifierLists` walks the SDK mod's `Content/` tree, so a file on disk there is
listed in `NewPackages.txt` and cooked.

A mod's **first** localization asset needs no trip through the Mod Editor either.
`writeModLocalization` derives the package name from where the asset lives -
`/<SdkModName>/<AssetName>`, with `<SdkModName>` read off the mod's `sdk` symlink so a
`sdkModNameOverride` still works - and mints the package from
`src/localization/fixtures/empty-localization.uasset` via `renameLocalizationPackage`. It also
repairs the package name of an asset whose name no longer matches its path (the old advice was to
copy another mod's asset and rename the *file*, which left the package pointing at the other mod).

Renaming a text asset is not a string replace, which is why it is a function and not a note here:
the identity is spelled in the summary's `PackageName` (a length-prefixed `FString`, so it resizes
the header), twice in the name table (as hashed `FName`s, in the half the editor keeps sorted, so
the table can reorder and every name index has to be remapped), and again in the asset-registry
section as `FString`s. All three lengths move independently, and every stored offset in the package
is patched through one `shift()` built from those edits. `LocalizationId` is re-derived from the new
name rather than inherited - it namespaces the package's gathered text, so two mods minted from the
same fixture must not share one.

The symptom when this breaks is the UI showing the raw keys (`sid_items_FactionPatchDuty_name`);
check with `strings -a <staged>.ucas | grep <SID>` before blaming the writer.

Constraints worth knowing before writing:

- **New FNames are appended to the name table for you.** `writeLocalizedTexts` adds any FName the
  payload needs (property names, each `ELocalizationLanguage::<Lang>` key) that the package lacks,
  hashes it the way `FNameEntrySerialized` does, and shifts every summary/export offset behind the
  table — so a freshly created, empty SDK text asset works as a starting point. Language keys still
  have to be spelled exactly as the enum members: `English`, `Ukrainian`, `German`,
  `French`, `SpanishEuropean`, `Italian`, `Polish`, `Czech`, `Turkish`, `Serbian`,
  `PortugalBrazilian`, `SpanishLatinoAmerican`, `Arabic`, `ChineseSimplified`,
  `ChineseTraditional`, `Japanese`, `Korean`, `Russian`. SID strings are `FString`s, not FNames,
  so those are unconstrained.
- Non-ASCII text is written as UTF-16LE automatically; no escaping needed.
- Round-trip after writing (`node src/localization/uasset.mts <file>`) — the parser is strict, so a
  clean re-parse is a real check that the offsets were patched correctly.

`src/localization/text.mts` holds the shared authoring machinery: the `LANGUAGES` list, the
`TemplateByLanguage` type (`English` is the fallback for every language left out), `TEXT_ALIASES`
(the Russian slot is served Ukrainian text), `localized()` for `{placeholder}` substitution that
follows the language, `itemLocalization()` for a `sid_items_<SID>_name`/`_description` pair, and
`writeModLocalization(import.meta.url, entries, fileName?)`, which resolves
`raw/Stalker2/Content/<ModName>-localization.uasset` (or `fileName`, for a mod shipping several
text assets) from the calling mod's directory. A mod's own
`writeLocalization.mts` should hold nothing but its strings.

An item can also point its text lookup elsewhere with the prototype's `LocalizationSID` field: the
game reads `sid_items_<LocalizationSID>_name` instead of `sid_items_<SID>_name`. Vanilla mutant
loot does this (`mutpartspack_*`), and DecoupledRanks uses it so its `_NonQuest` faction patch
clones share the quest variants' text rather than duplicating 26 entries.

`Mods/FactionPatches/writeLocalization.mts` is the worked example: it derives
`sid_items_<SID>_name` / `_description` for every faction patch from the mod's own item
definitions, exports `writeFactionPatchLocalization()`, and is called from that mod's
`addFactionPatchItems` transformer (inside its once-guard) so the text is regenerated by
`prepare-configs` and can never drift from the prototypes. `Mods/DecoupledRanks/writeLocalization.mts`
does the same for that mod, and imports `factionPatchLocalization()` because it ships the same
patches. Both are deliberately *not* executable on
their own - no `isMain` block, no npm script - so there is exactly one way the asset gets written.

Two traps that pattern hits:

- **Circular import.** A generator that reads the mod's item definitions and is called back from
  the module defining them is a cycle. Keep every cross-module *value* use inside a function body;
  a computed object key (`[FactionPatchSID]: …`) evaluated at module scope throws
  `Cannot access 'X' before initialization`. Type-only imports are erased and always safe.
- Output is byte-for-byte reproducible - no timestamps or GUIDs are regenerated - so a rerun that
  changes nothing leaves the asset untouched in git.

## Dialog text: the `DialogModTextToolAsset`

The Mod Editor's Text Tool has a second asset class for dialogs,
`/Script/ModKitEditor.DialogModTextToolAsset`, whose single export holds `Dialogs`:

```
Dialogs: Array<DialogTopicTextTool_ModEditor>
  TextToolTopicName, SID = <ModName>_<TopicName>       GlobalWFR.SID = sid_topic_<SID>
  TopicCharacterSIDs: Array<Name>
  Labels: Array<DialogLabelTextTool_ModEditor>
    TextToolLabelName, SID = <topic SID>_<LabelName>   LabelWFR.SID  = sid_label_<SID>
    Phrases: Array<DialogPhraseTextTool_ModEditor>
      SID = <label SID>_000, _001...                   PhraseText.SID = sid_phrase_<SID>
      Character: Name (speaker, e.g. volk_1; None when unset)
```

`GlobalWFR`, `LabelWFR` and `PhraseText` are each a `ModTextToolLocalizedText`: the same
`{ SID, LanguagesToLocalizedStrings }` as a plain text asset's entry. The scheme matches what the game
expects of a `DialogPrototype`: its `TextToolPhraseSID` is a phrase SID, and the game finds the reply
label by dropping the `_<NNN>`. So a label groups a reply option with the lines spoken after it.

Write one with `writeModDialogs(import.meta.url, topics)` (`src/localization/text.mts`). It writes
`raw/Stalker2/Content/<ModName>-dialogs.uasset`, minted from `fixtures/empty-dialog.uasset` like the
text asset, and regenerates the database. Build the topics with `dialogTopic()`, which applies the
SID scheme; `phraseSID()` gives the same SIDs for the `DialogPrototypes` to use. The writer
(`writeDialogTexts` in `uasset.mts`) reproduces the editor's own asset byte for byte
(`fixtures/authored-dialog.uasset`). `writeModLocalizationDatabase` gathers dialog text alongside
plain text. Whether the editor's own cook-time gather also does is not yet verified.

To see a new asset class's field types, dump it with `UASSET_TYPES=1 node src/localization/uasset.mts <file>`.

## The autogenerated localization database

The text asset above is only the *source* the Mod Editor gathers from. What the game actually reads
is a second package the editor emits during the cook:

```
LogModTextToolManager: Created mod localization database with 28 localized texts from 1 ModTextToolAsset assets
LogModAssetCreator: Saved ModLocalizationDatabaseDataAsset '../../Mods/FactionPatches/Content/Autogenerated_1788536974_LocalizationDatabase.uasset'
```

A `ModLocalizationDatabaseDataAsset` whose single export is `LocalizationDatabase`, a
`TMap<FString, FModLocalizationLocalizedStringsContainer>` keyed by SID holding the same
`LanguagesToLocalizedStrings` map. The `<n>` is a Unix timestamp when the editor names it.

`writeModLocalization` generates it too, so a mod that ships new text no longer needs a cook for
the text to work. It is written by `writeModLocalizationDatabase(import.meta.url)`
(`src/localization/text.mts`), which gathers the entries off disk from every
`LocalizationModTextToolAsset` in the mod's `raw/Stalker2/Content` — the same thing the editor does
— so the database cannot drift from its sources and a mod with several text assets needs no special
handling.

**Who owns the name.** The number is a save timestamp, so it is not derivable and there is no
"correct" one to converge on — only the one already in play. `writeModLocalizationDatabase` looks
in the **SDK mod's `Content/` first**, then `raw/`, and only mints
`Autogenerated_<md5-of-mod-name>` as a stand-in for a mod that has never been cooked. The SDK's
copy wins because a cook mints its own name and that becomes the mod's identity from then on. Any
database under a *different* `Autogenerated_<n>` name is then deleted from both trees — otherwise
the cook ships two databases of the same SIDs, and the classifier can even put them in different
containers (seen 2026-09-15: the editor's in OverrideContent only, ours in both).

Two things worth knowing:

- The editor's gather puts **Ukrainian first** in each language map, whatever order the text asset
  held. Reproduced only for byte-identity; a `TMap` is not read positionally.
- Output is byte-identical to the editor's own database except `LocalizationId`, the package `Guid`
  and `PackageSource` — all minted randomly per save and not derivable. `renameLocalizationPackage`
  derives `LocalizationId` from the package name instead, which is what matters (two mods must not
  share one).
