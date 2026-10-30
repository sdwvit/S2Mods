---
name: eng-dialog-voiceover
description: Voiced mod dialogs in S2 - how the game finds and plays a phrase's voice and lip-sync (DialogRuntimeData, the dialog asset subsystem, TextToolPhraseSID keys), what a mod needs for its voice to register (~mods install, known TextTool characters), what the editor silently drops at cook, dialog body/face animation behaviour (gesture pools, weapon state, interrupts), attaching hub topics to NPCs, and how to check each step (cooked utoc, live game memory). Use when a mod dialog shows subtitles but no voice, a speaker's lines are silent, lip-sync or gestures misbehave, or a topic doesn't appear on an NPC.
---

# Voiced mod dialogs

Reference mod: `Mods/WolfArmorFetch` (voice/ has the generators and editor probes). The cfg -> runtime data -> event ->
bank trace is in `DesignDocs/DialogVoiceoverSpec.md`; Wwise authoring is the `eng-wwise` skill; the TTS and review site
are `src/voiceover/README.md`. Facts below are from the retail exe (2026-09-29 build) and in-game tests on 2026-10-20,
unless marked inferred.

## How the game plays a phrase's voice (verified)
1. **Discovery, once at boot.** Step 23 of `AInitLevelGameMode`'s startup sequence asks the global AssetRegistry for
   every asset of class `/Script/Stalker2.DialogRuntimeData` (`GetAssetsByClass`) and async-loads them. No label, path,
   DLC name or GameFeatureData scan rule is involved; `UDialogAssetReferenceSettings.bUseSingeAssetLabel` (Quest.ini)
   has no runtime reader. A `QuestAssetLabel` / `PAK_Quest_BaseGame` override does nothing.
2. **Merge.** Each loaded asset's `AssetType` (an FName: `Voiceover`, `FaceAnimation`, `VoiceGen`) picks one global
   container, and the asset's `AssetContainer` entries are appended to it. Mod and vanilla entries share one map.
3. **Play.** The key is the phrase's cfg `TextToolPhraseSID`. Lookup: `Voiceover`, then `VoiceGen`. A phrase with
   `ShowNextDialogOptionsAsAnswers = true` (an answer menu, always the player in vanilla) plays nothing.
4. The `<Chain>_Voiceover` asset name and folder don't matter; the chain SID is not part of the lookup.

## What a mod needs, or its voice silently never registers
- **Install under `Content/Paks/~mods/`** (or the Workshop). Only those mods get "register and activate" (InitLevel
  step 11), which appends the plugin's `AssetRegistry.bin` to the global registry. Any other folder under `Paks/`
  mounts as plain paks: cfgs, overrides and by-path loads work, class queries don't see the assets. The repo injects
  into `~mods` since 2026-10-20 (`src/base-paths.mts`).
- **Every speaker must be a character the editor knows.** The editor drops a runtime-data entry on load (so also in the
  cook) when its phrase's TextTool `Character` is unknown or `None`: Skif must be `PC` (`sid_character_PC`), NPCs a
  vanilla character SID. The known list is the `characters` array of the SDK's `TextDatabase_<part>.json` files
  (FullEditor pak, `Stalker2/Content/TextToolBackup/`); entries are `{ id, sid, name_sid }`. A mod has no file of its
  own there: a custom NPC (WolfArmorFetch's `WolfArmorFetch_Bagor`) loses its voice until it's added to one. The cfg
  mod (`<Mod>Cfg`) isn't loaded during the assets cook ("plain .uplugin mod ... will not load in Mod Editor"), so cfg
  NPC prototypes don't count.
- Keys: `TextToolPhraseSID` exactly (no `sid_phrase_` prefix). Paths: the event's object path
  `/<Mod>/.../<Event>.<Event>`.

## Checking each step
- **Source asset**: decode with `parseUasset` (`src/localization/uasset.mts`); the container map count must match.
- **Editor view**: `Mods/WolfArmorFetch/voice/probe_voiceover_keys.py` / `probe_voiceover_reload.py` (paste the exec
  line into the Output Log, Python mode). Fewer keys than the file holds = the editor dropped them (see characters).
- **Cooked**: `retoc unpack-raw <NewContent.utoc> <dir>`, then find the chunk by `manifest.json`'s `chunk_paths` and
  count `VO_<speaker>_` names in it. The cooked package keeps only what the editor kept.
- **Mod registry**: `repak unpack` the NewContent `.pak` (it holds `AssetRegistry.bin` and the `.uplugin`) and grep for
  `DialogRuntimeData` and your asset names.
- **Live game**: `python3 -I .claude/skills/eng-dialog-voiceover/dialog_runtime_probe.py <pid> <exe base> <key>...`
  lists the merged maps and their entries per package root, read-only through `/proc/<pid>/mem`. Use the wine process
  whose `/proc/<pid>/maps` maps the exe. `Stalker2.log` stops after pak mounting and is no help.

## Pitfalls
- `voice/runtime-data.mts` has no dry-run: any run rewrites the `_Voiceover` assets in `raw/` **and the SDK** (through
  the mod's `sdk` symlink), and leaves out lines without an approved take - so an unpicked line on the review site
  goes silent in the next cook.
- Vanilla `.wem` voice is Wwise Vorbis: ffmpeg can't decode it (vgmstream isn't installed).
- Our TTS takes are trimmed to ~0.05 s of silence at each end, so speaker changes came ~0.1 s apart and sounded
  rushed. There is no per-phrase delay field in dialog cfgs (`PreblendTime` / `BlendExpForEaseInOut` are sequence
  camera blends). A Wwise initial delay on the next line would desync lip-sync (the face anim starts with the
  phrase), so `voice/wwise_import.py` appends 0.1 s of silence (`PAD_END_S`) to each Wwise copy; the approved takes
  stay as they are (2026-10-20).

## Animation during dialog
- **Lip-sync** (`AS_FAC_*`, SKEL_fac) carries no head or body motion; vanilla's doesn't either.
- **Body gestures** come from `HumanDefaultAnimCollection`: a phrase's `DialogMembersAnimations[*].DialogAnimations`
  (explicit `EDialogAnimationType`), else a weighted random talking/listening pool. Both are keyed by the NPC's pose
  state; only contextual-action states have entries (`RelaxStand` maps to `CAStand`, sitting states to their own).
  Armed/combat stances have none, so an NPC whose `SetAIBehavior` uses `WeaponState Combat` (or `Relax` with a rifle)
  moves only its head. Speaking NPCs: `EWeaponState::NoWeapon`, as most vanilla Stay goals. About a quarter of the
  `CAStand` talking pool is low-motion clips, so some lines look stiff even then.
- **Interrupts**: the face anim is stopped only on the interrupt path of chains with `ContinueAfterInterrupt = true`;
  with `false` the voice stops and the mouth keeps moving to the anim's end (vanilla hub topics too, inferred).

## Getting a topic onto a hub NPC
- The hub quest owns the NPC (it spawns and resets his dialogs); `SetDialog` from another quest goes missing, so mods
  attach topics from hub nodes off the hub's own triggers (NPC create events, phase technicals).
- Those triggers fire only when the NPC is (re)created. A condition that turns true while he stands there (a timer in
  another quest, a state reached on load after his creation) needs a listener: hang a `Condition` node and a one-shot
  `Technical` on the hub's vanilla `OnTickEvent` (vanilla OnTickEvents always `LaunchOnQuestStart`; none is launched
  by a node, so reuse one that already runs on existing saves). See `RookieVillage_Hub_WolfArmorFetch_CoverReadyPin`.
- Gate the topic on exactly what the quest-giver marker uses, or saves get the marker and no topic.
- Saves where the NPC was created before the mod was installed never re-run those triggers. Set
  ``gameStartCommand: `XStartQuestNodeBySID <node>` `` in meta.mts (the announce blueprint runs it on every world
  load) and make `<node>` a Repeatable hub `If` on "the NPC's create event has run" that launches the same
  re-attach chain (`WolfArmorFetch_OnWorldLoad`). See DesignDocs/DetectInstalledModSpec.md.

## Adding a few voiced lines to a built mod (2026-10-21, two FishPass lines: about 15 min + a 7 min cook)
Only the new lines go through each step; nothing else is rebuilt.
1. Script and takes: add the UA lines to `higgs/<spk>_uk.json`, generate, and get the user's picks. English:
   `en_from_ua.py --text <json with {sid, en}> <spk>...`, `gen_chunks.sh <spk>_en 3`, then `select_en.py` with
   **`.venv-analysis/bin/python`** (the Higgs venv lacks parselmouth, and select_en then exits silently, archiving
   nothing). `backup_finals.sh` after the picks.
2. Lip sync, with the editor open: pad the new takes by `PAD_END_S` into a scratch `{en,uk}/` stage, run
   `fit_lipsync.py` on that stage only, merge its `anims` into `lipsync/pred.json` (back it up), and have the user
   run `exec(open(r"Z:\home\<user>\IdeaProjects\S2Mods\Mods\WolfArmorFetch\voice\create_face_anims.py").read())`.
   It only builds anims that don't exist yet.
3. Wwise, with the editor closed: start `WwiseConsole.exe waapi-server` on the mod's wproj (eng-wwise), run
   `WINE_NVME='U:\nvme' python3 -I wwise_import.py approved --only '<regex>'`, then `kill` the server. Build the
   banks for just those events (one trim batch), and copy their `Event/<lang>/*` and `Media/<lang>/*.wem` into
   `Mods/<Mod>/wwise/GeneratedSoundBanks/Windows`.
4. `event-assets.mts <regex>`, `runtime-data.mts --face`, then `prepare-configs` + `cook-inject`.

## Open (2026-10-20)
- `WolfArmorFetch_Decider_Accept_Offer_000` (a topic's opening NPC line) stops ~3 s in, at a pause; other lines play
  in full. Suspected: the topic-selecting key press carried over as a skip (the line is skippable). Unconfirmed.
