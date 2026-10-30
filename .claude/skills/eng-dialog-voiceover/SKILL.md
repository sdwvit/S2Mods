---
name: eng-dialog-voiceover
description: Voiced mod dialogs in S2 - adding voice lines and lip-sync face animation (AS_FAC_*) to a mod's dialogs, how the game finds a phrase's voice and face anim (DialogRuntimeData, TextToolPhraseSID keys), what silently breaks it (install folder, unknown TextTool characters, editor drops at cook), body/face animation during dialog (gesture pools, weapon state, interrupts), and how to check each stage (editor, cooked utoc, live game memory). Use when adding voiced lines or facial animation to a mod, when a mod dialog shows subtitles but no voice, or lip-sync or gestures misbehave.
---

# Voiced mod dialogs

Facts here come from the retail exe (2026-09-29 build) and in-game tests, unless marked *inferred*.

## The pipeline at a glance
A voiced phrase needs four things, all keyed by the phrase's cfg `TextToolPhraseSID`:

| Piece | What it is | Made by |
|---|---|---|
| Wwise event | `VO_<speaker>_<SID>` with EN + UA sources, in the mod's banks | `eng-wwise` skill |
| Event asset | `AkAudioEvent` `.uasset` for that event | `writeWwiseEventAsset` in `src/wwise-event-asset.mts` |
| Voiceover runtime data | `DialogRuntimeData`, `AssetType = Voiceover`: phrase SID -> event | `writeDialogRuntimeData` in `src/localization/uasset.mts` |
| Face anim (optional) | `AS_FAC_<EN\|UA>_<speaker>_<SID>` + a `FaceAnimation` runtime data | `lipsync/` here, then `writeDialogRuntimeData` |

Adding audio makes a mod an asset mod: ship it with `cook-inject`.

Files next to this skill (they work for any mod; the editor scripts take their inputs from the pasted line):

| File | Runs in | Does |
|---|---|---|
| `lipsync/dump_face_anim.py` | editor | dumps a vanilla speaker's face anims to JSON (read-only) |
| `lipsync/fit_lipsync.py` | Linux | fits audio -> face channels, predicts tracks for new lines |
| `lipsync/create_face_anims.py` | editor | bakes and saves the predicted `AS_FAC_*` anims |
| `probe_voiceover_keys.py` | editor | lists the phrase keys the editor sees in one `_Voiceover` asset |
| `probe_voiceover_reload.py` | editor | the same before and after a reload from disk (stale copy?) |
| `dialog_runtime_probe.py` | Linux | dumps the running game's merged voice/face maps (read-only) |

Related: TTS generation and the review site are in `src/voiceover/README.md`; the cfg -> runtime data -> event -> bank
trace is `DesignDocs/DialogVoiceoverSpec.md`.

**Editor scripts** run only when pasted into the Zone Kit editor's Output Log in Python mode (no remote execution):
each script's header has the line to paste, `<inputs>; exec(open(r"Z:\...\<script>.py").read())`. They use Windows
paths, so data must sit where Wine sees it (`S:\` is `/media/nvme`, `Z:\` is `/`).

## Adding voiced lines to a mod
1. **Takes**: one WAV per line and language (`src/voiceover/README.md` for TTS and picking). Before Wwise import, pad
   each copy with 0.1 s of trailing silence: tightly trimmed takes make speaker
   changes sound rushed, there is no per-phrase delay field in dialog cfgs (`PreblendTime` /
   `BlendExpForEaseInOut` are sequence camera blends), and a Wwise initial delay would put lip-sync out of step.
2. **Wwise**, editor closed (`eng-wwise`): import the lines as Sound Voice objects + one Event each, generate banks
   for just those events, and copy their `Event/<lang>/*` and `Media/<lang>/*.wem` into
   `Mods/<Mod>/wwise/GeneratedSoundBanks/Windows`.
3. **Event assets**: one `AkAudioEvent` `.uasset` per event, so no Wwise Browser checkout is needed:
   `writeWwiseEventAsset(template, dest, "/<Mod>/.../<Event>", guid, shortId)` with the GUID and `Id` from the event's
   bank json (`SoundBanksInfo.SoundBanks[0].Events[0]`). The template must be an editor-saved event from any mod
   (UE 1013); the vanilla ones in the Wwise pak are an older file version.
4. **Face anims**, editor open: see the next section. Skip for lines spoken by the player.
5. **Runtime data**: one `<ChainSID>_Voiceover` per chain (phrase SID -> `/<Mod>/.../<Event>.<Event>`) and, with face
   anims, one `<ChainSID>_FaceAnimation` (phrase SID -> anim object path), written from the templates in
   `src/localization/fixtures/dialog-runtime-{voiceover,faceanimation}.uasset` with `writeDialogRuntimeData` (both
   writers emit soft object paths, `<path>.<name>`). Write assets to `raw/` and the SDK mod's `Content/` (the cook
   reads only the latter).
6. `npm run prepare-configs`, then `cook-inject`. Check the result with "Debugging" below.

When adding a few lines to a mod that already has voice, run every step for the new lines only (a `--only <regex>` or
chain regex in each tool); nothing else needs rebuilding.

## Making lip-sync anims (`lipsync/`)
A face anim is an `AnimSequence` on `SKEL_fac`: float curves plus bone tracks, 60 fps (EN) or 30 fps (UA) in vanilla,
and no head or body motion. The player (`pc`) has none. The tools learn the mapping from audio to face on one vanilla
speaker's own lines, then bake new anims from copies of that speaker's anims.

1. **Pick a vanilla speaker**: a folder of their `AS_FAC_*` anims under `/Game/_STALKER2/Animations/CharacterHead/...`
   (e.g. `Hubs/<Hub>/<speaker>`) whose voice files are
   `<ZoneKit>/O/Voices/<English(US)|Ukrainian(UA)>/S2_Live/VO_<speaker>_<key>.wav` under the same keys. More lines fit
   better. One model can serve every NPC speaker in the mod.
2. **Dump** (editor, read-only): `dump_face_anim.py` with `VANILLA` (that folder) and `OUT` (the dump folder).
3. **Fit** (Linux, venv with numpy, soundfile, torch, torchaudio; the voiceover Higgs venv has them):
   `python3 -I lipsync/fit_lipsync.py <dump_dir> <ZoneKit>/O/Voices <stage_dir> <pred.json>`, where `<stage_dir>`
   holds the padded takes as `{en,uk}/VO_<speaker>_<PhraseSID>.wav`. It fits a ridge regression from 40-band log-mel
   frames (±6 frames of context) to each face channel, keeps the channels the audio predicts on held-out lines
   (correlation > 0.35, printed), and takes every other channel from a base: the shortest vanilla line at least as
   long. It overwrites `<pred.json>`: to extend an existing set, fit the new lines into a scratch file and merge its
   `anims` into the main one (back it up first).
4. **Bake** (editor, saves assets): `create_face_anims.py` with `PRED`, `VANILLA` (as in step 2) and `DEST` (e.g.
   `/<Mod>/Animations`). It saves `<DEST>/<speaker>/<EN|UA>/AS_FAC_<EN|UA>_<speaker>_<SID>`, UA first, 10 per paste
   (one run over everything stalled after ~20): paste again until the log says `done; 0 left`. It skips anims that
   exist, so delete one to rebuild it. Log: `face_anims.txt` next to `PRED`.
5. **Wire up**: the `<ChainSID>_FaceAnimation` runtime data from step 5 above. A line voiced in one language only can
   point both languages at the same anim.

Check a baked anim in the editor's anim viewer on the speaker's head, then in game.

## How the game finds a phrase's voice (verified)
1. **Discovery, once at boot.** Step 23 of `AInitLevelGameMode`'s startup sequence asks the global AssetRegistry for
   every asset of class `/Script/Stalker2.DialogRuntimeData` (`GetAssetsByClass`) and async-loads them. No label, path,
   DLC name or GameFeatureData scan rule is involved; `UDialogAssetReferenceSettings.bUseSingeAssetLabel` (Quest.ini)
   has no runtime reader, and a `QuestAssetLabel` / `PAK_Quest_BaseGame` override does nothing.
2. **Merge.** Each asset's `AssetType` (FName: `Voiceover`, `FaceAnimation`, `VoiceGen`) picks one global container,
   and its `AssetContainer` entries are appended. Mod and vanilla entries share one map.
3. **Play.** Key: the phrase's `TextToolPhraseSID`, exactly (no `sid_phrase_` prefix). Lookup order: `Voiceover`, then
   `VoiceGen`. A phrase with `ShowNextDialogOptionsAsAnswers = true` (an answer menu, always the player in vanilla)
   plays nothing.
4. The runtime data asset's name and folder don't matter; the chain SID is not part of the lookup.

## What silently breaks voice registration
- **Install folder.** Only mods under `Content/Paks/~mods/` (or the Workshop) get "register and activate" (InitLevel
  step 11), which appends the plugin's `AssetRegistry.bin` to the global registry. Under any other `Paks/` folder,
  cfgs, overrides and by-path loads work, but class queries don't see the assets. The repo injects into `~mods`
  (`src/base-paths.mts`).
- **Unknown speaker.** The editor drops a runtime-data entry on load (so also at cook) when its phrase's TextTool
  `Character` is unknown or `None`. The player must be `PC` (`sid_character_PC`), NPCs a vanilla character SID. The
  known list is the `characters` array (`{ id, sid, name_sid }`) of the SDK's `TextDatabase_<part>.json` files
  (FullEditor pak, `Stalker2/Content/TextToolBackup/`). A mod can't add its own file there: a custom NPC stays
  silent until it is added to one. Cfg NPC prototypes don't count, since the cfg mod
  (`<Mod>Cfg`) isn't loaded during the assets cook.
- **Missing takes.** A runtime-data generator that writes only lines that have a take silences any line whose take
  was dropped since the last run.

## Animation during dialog
- **Face**: the `FaceAnimation` entry plays from the phrase's start. Lip-sync carries no head or body motion.
- **Body gestures** come from `HumanDefaultAnimCollection`: a phrase's `DialogMembersAnimations[*].DialogAnimations`
  (explicit `EDialogAnimationType`), else a weighted random talking/listening pool. Both are keyed by the NPC's pose
  state, and only contextual-action states have entries (`RelaxStand` maps to `CAStand`, sitting states to their own).
  Armed and combat stances have none, so an NPC whose `SetAIBehavior` uses `WeaponState Combat` (or `Relax` with a
  rifle) moves only its head: give speaking NPCs `EWeaponState::NoWeapon`, as most vanilla Stay goals do. About a
  quarter of the `CAStand` talking pool is low-motion clips, so some lines look stiff regardless.
- **Interrupts**: the face anim is stopped only on the interrupt path of chains with `ContinueAfterInterrupt = true`.
  With `false`, the voice stops and the mouth keeps moving to the anim's end (vanilla hub topics too, *inferred*).

## Debugging: subtitles but no voice
Walk the stages in order; the first one that's missing the key is the culprit.
1. **Source asset**: decode the runtime data with `parseUasset` (`src/localization/uasset.mts`); the container map
   count must match the lines you expect.
2. **Editor**: `probe_voiceover_keys.py` with `PKG = "/<Mod>/<ChainSID>_Voiceover"`. Fewer keys than the file holds
   means the editor dropped them (unknown speaker, above). `probe_voiceover_reload.py` tells a stale editor copy apart.
3. **Cooked**: `retoc unpack-raw <NewContent.utoc> <dir>`, find the chunk via `manifest.json`'s `chunk_paths`, and
   count the `VO_<speaker>_` names in it. The cook keeps only what the editor kept.
4. **Mod registry**: `repak unpack` the NewContent `.pak` (it holds `AssetRegistry.bin` and the `.uplugin`) and grep
   for `DialogRuntimeData` and your asset names.
5. **Live game**: `python3 -I .claude/skills/eng-dialog-voiceover/dialog_runtime_probe.py <pid> <exe base> <key>...`
   lists the merged maps and their entries per package root, read-only through `/proc/<pid>/mem`. Use the wine process
   whose `/proc/<pid>/maps` maps the exe (header has details). Missing here but present in the registry: check the
   install folder.
