# Dialog voiceover: from cfg to .wem

Traced on 2026-10-18 for the vanilla hello topic `E02_MQ01_rihter_0_HelloTopic` (Rihter), using GameLite cfgs and the
SDK's `*-WindowsModEditor.pak` files (`repak list` / `repak unpack -i <path>`). This is what a voiced line consists of,
and what a cfg-only mod is missing.

## 1. Cfg: which chain plays, and its phrases
- `NPCPrototypes.cfg`: `Rihter { HelloDialogChain = E02_MQ01_rihter_0_HelloTopic; VoiceUA = G; VoiceEN = G }`. Quest
  nodes can also start the chain (`EQuestNodeType::SetDialog` with `DialogChainPrototypeSID`, `LastPhrases`).
- `DialogChainPrototypes/E02_MQ01_rihter_0_HelloTopic.cfg`: `StartingDialogPrototypeSID = ..._hello_41656`,
  `DialogMembers[0].DialogMemberName = rihter_0`, `IsPCDialogMember = false`.
- `DialogPrototypes/E02_MQ01_rihter_0_HelloTopic.cfg`: one phrase, `SID = TextToolPhraseSID = ..._hello_41656`,
  `DialogMemberIndex = 0`, `HasVOInSequence = false`. **No voice field at all.**
- Some hello chains have no chain/phrase cfg at all (`E02_MQ01_rihter_0_CallPlayer`): NPCPrototypes names the chain and
  the voice comes from runtime data alone.
- Legacy fields `AKEventName` / `AKEventSubPath` (subpath relative to `.../Events/Voiceover/`), `AssetsSubPath`,
  `FaceAnimationAssetName`, `FaceAnimationSubPath` are still set on ~600 vanilla phrases. No vanilla phrase writes them
  empty. Pointing a mod phrase's `AKEventName`/`AKEventSubPath` at an existing vanilla event plays nothing (tested
  2026-10-18): the cfg route is dead.

## 2. DialogRuntimeData: phrase -> event / face anim
Next to the editor-only Dialog Blueprint (`PKG_EditorOnly`, no reference to the runtime data either way), in
`/Game/_Stalker_2/maps/_Stalker2_WorldMap/QuestObjects/Dialogs/<...>/` (or `.../QuestObjects/DefaultRuntimeData/` for
chains without a blueprint):
- `<ChainSID>_Voiceover`: `DialogRuntimeData { AssetType = Voiceover, AssetContainer -> NameToAsset_AssetContainer }`,
  `Assets: TMap<FName, FSoftObjectPath>`: phrase SID (no `sid_phrase_`) -> `/Game/_STALKER2/Audio/WwiseAudio/Events/
  Voiceover/<Type>/VO_<Quest>/<voice>/VO_<voice>_<PhraseSID>`. One event per phrase; Wwise picks the language.
- `<ChainSID>_FaceAnimation`: `NameAndLocalizationToAsset_AssetContainer`, phrase SID -> `None` ->
  `{ELocalizationLanguage -> SoftObjectPath}` to `/Game/_STALKER2/Animations/CharacterHead/<Type>/<Quest>/<voice>/
  <EN|UA>/AS_FAC_<EN|UA>_<voice>_<PhraseSID>`.
- Nothing in the cfgs or the blueprint names these assets: the chain SID is the only link.
- `src/localization/uasset.mts` `writeDialogRuntimeData` writes `_Voiceover` packages from a vanilla template
  (byte-identical round trip); `Mods/WolfArmorFetch/voice/runtime-data.mts` uses it.

## 3. AkAudioEvent
`.../Events/Voiceover/MainQuests/VO_E02_MQ01/rihter/VO_rihter_..._hello_41656.uasset` (Wwise pak, UE5 1008, 2 KB):
export `AkAudioEvent` with `EventInfo: WwiseEventInfo { WwiseGuid, WwiseShortId, WwiseName }`. No audio inside; the
cook bundles the event's banks and media into a `.ubulk`.

## 4. Wwise project
- `Events/Voiceover/MainQuests/VO_E02_MQ01.wwu`: Event `VO_rihter_..._hello_41656` with one Play action targeting the
  Sound Voice of the same name.
- `Actor-Mixer Hierarchy/S2 Live/Voiceover/VO_E02_MQ01.wwu`: that Sound Voice under the `rihter` Actor-Mixer, with one
  `AudioFileSource` per language, `S2_Live\VO_rihter_..._hello_41656.wav`, i.e.
  `<ZoneKit>/O/Voices/{English(US),Ukrainian(UA)}/S2_Live/<name>.wav`.

## 5. Banks and media
`GeneratedSoundBanks/Windows/Event/<Language>/VO_rihter_..._hello_41656.{bnk,json,xml,txt}`, one auto-defined bank per
event per language. The json lists the event (`Id` = ShortID 4149143011) and its media:
`Media/English(US)/507129666.wem` (loose, not streamed) plus shared SFX media used by the voice-modulator effects
(`VM_*` ShareSets, `RTPC_VM_Preset`).

## Mod side: what's verified
- A mod `<ChainSID>_Voiceover` under `/WolfArmorFetch/Dialogs/`, pointing at vanilla events, cooks fine and is listed in
  the mod's `AssetRegistry.bin` with class `/Script/Stalker2.DialogRuntimeData` — and plays nothing in game (2026-10-18).
  Everything in sections 1–2 matches vanilla except the package root (`/WolfArmorFetch/...` vs `/Game/...`).
  Cause (2026-10-20): the mod was installed under `Paks/notmods/`, which mounts plain paks without registering the plugin.

## 6. Registration and lookup in the retail exe (2026-10-20)
- `UDialogAssetReferenceSubsystem` (a Blueprintable engine subsystem; the instance is `/QuestTool/BP_DialogAssetReference
  Subsystem_C`) runs once at boot, as step 23 of `AInitLevelGameMode`'s init table (0x148eaa4e8, 16-byte entries):
  `AssetRegistry->GetAssetsByClass(DialogRuntimeData)`, then `RequestAsyncLoad` (priority 100). Code: 0x1410a8e4c;
  load callback 0x140a97290 ("Registering DialogRuntimeData: %s").
- The callback groups by `AssetType` (FName at +0x30) into a `TMap<FName, Container*>` at subsystem +0x30, creating the
  container from the first asset's container class, and appends (`AppendContainer`, vtable +0x2e0) its entries.
  `UDialogRuntimeData` has only `AssetType` and an instanced `AssetContainer` (+0x38). `bUseSingeAssetLabel` and
  `QuestAssetLabelClass` (`UDialogAssetReferenceSettings`, config `Quest`) have no reader found in retail code.
- Mod plugins are registered at step 11 (0x146c749aa: "Registered mod plugin", "Failed to load asset registry for mod
  plugin"): their `AssetRegistry.bin` is loaded and appended to the global registry (`IAssetRegistry` vtable +0x3e8).
  Only mods found under `Content/Paks/~mods/` (custom) or the Workshop (managed) take that path.
- Play (0x140e00dc8): key = the phrase's `TextToolPhraseSID` (parsed to FDialogPrototype +0xdc by 0x140b8aeb2), looked
  up in `Voiceover`, then `VoiceGen`. FaceAnimation uses the same key plus a language. The phrase byte +0xfa
  (`ShowNextDialogOptionsAsAnswers`) skips voice.
- In the live game (2026-10-20): 25 384 vanilla Voiceover entries; WolfArmorFetch's appeared (83, then all NPC + Skif
  lines) only after moving the install to `~mods` and setting Skif's TextTool character to `PC`.

## 7. What the editor drops
Loading a `_Voiceover` / `_FaceAnimation` asset in the Zone Kit (editor or cook) removes entries whose phrase's TextTool
character is `None` or not in the editor's character list (`TextDatabase_<part>.json` `characters`, FullEditor pak).
Verified by elimination: the file held 19 entries, the editor and the cooked package 13; every Skif (`None`) and custom-NPC
(`WolfArmorFetch_Bagor`) entry was gone, every vanilla-character entry kept; with Skif as `PC` his 52 entries cooked. The
code doing it was not located (no PostLoad/Serialize override on the runtime-data or container classes in the editor).
