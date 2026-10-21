# Plan: Wolf's third job (working title "Cover Story")

Story rules (memory feedback-story-style): the conflict comes from outside, Wolf stays likable, and
Skif and Wolf want the same thing. Wolf never leaves Cordon. Jobs 1-2 get small iterations only.

## Premise

Where jobs 1-2 leave off: Skif brought Wolf the Decider (job 1), its serial gave Wolf the sniper's
name and nothing else, and Wolf took Ward soldiers alive to question them (job 2). They didn't know where the sniper is posted, but they knew
his crew sells Ward guns to the bandits of Sultansk. That explains how a Ward Fora ended up with a
broke stalker in job 1. The Ward men know Wolf's face; Skif they don't. So Skif poses as a Sultansk
buyer and gets the sniper's post out of the dealers.

Lore hooks:
- Rostok rumor, vanilla `sid_phrase_Rostok_Hub_semen_danilyc_0_InfoTopic_1_InfoTopic_1_61690`:
  "bandits in Zaton with brand new Warden guns".
- Sultansk is the Zaton bandit hub (vanilla `Sultansk_PDABandit*` notes).

## Beats

1. **Offer**, a day after the Falcon hand-in. Wolf briefs Skif and hands the Decider back, fully
   repaired and kitted out: "A Ward rifle opens Ward doors." Skif keeps it after the job.
   Optional side question "What's his name?": Wolf hands Skif a note with the Ward sniper's name, badly
   handwritten (quest item `WolfArmorFetch_SniperName`, given by a dialog `GetItem` action). The name
   never appears in any text. Skip the question and Skif goes in without it.
2. **Get in.** The buyer's go-between, Vasyan Bariga («Васян Барига»), a Sultansk bandit north of
   the town with two of his lads over a stalker they just robbed and shot, carries the deal on his PDA: meeting place and password, as a PDA
   chat in the style of vanilla EQ13's Filimon chat. He says a word to the corpse ("А треба було, фраєр,
   зразу бабос і хабарчик оддавать"), then one to Skif ("А ти ще хто такий? Ану з'їбався звідси"),
   and the three attack; the PDA comes off his body. Wolf names him and nothing else: no
   password, no answers, no word of the Sultan. (Code identifiers still say `hook`.)
   - Optional, Sultan's favor (found by the player, never hinted): if Skif brought the Sultan his
     briefcase (vanilla SQ50), he can ask a favor back. Two bandit bodyguards wait outside the meeting
     place and join Skif when he arrives.
3. **The meeting.** Three fully kitted Ward dealers in a tight space: the lead (assault rifle, Skif
   talks to him), an LMG and an SMG, all in heavy Ward suits or exos. They test whether the buyer is
   real before dealing; Skif bluffs through their questions (see Bluff checks) and fishes for the
   sniper's post and rotation in between. Pass and the lead lets slip where the sniper is posted. Run
   out of their patience and the deal goes loud.
4. **Out** with the info, or with the dealers' own PDA after a firefight. Same info either way, so
   the quest can't dead-end.
5. **Hand-in.** Wolf: "Now I know where he sleeps." He marks the place, pays, and keeps waiting. The
   hunt stays open, matching his vanilla "sooner or later".

Small iteration on job 2 (optional): one Wolf line at the Falcon hand-in hinting that the prisoners
talked about more than the sniper.

## Bluff checks

D&D-style: the lead asks questions. Some answers are safe (no roll); bluffs roll a die plus Skif's
bonus against a difficulty. A failed roll is a strike; at the strike limit the dealers turn hostile.

Bonus, added to every roll:
- The sniper, one option shown (the best available): rifle + name +2, rifle only +1, name only +1,
  neither 0 (Skif just describes the rifle: Ward Fora, green trims).
- A Ward badge in Skif's pocket, +1: the vanilla `VartaDogtag` (Korshunov's badge from the main
  quest) or RareNPCDrops' droppable copy `RareNPCDrops_VartaDogtag`.

Question pool, general Ward knowledge asked straight (quiz style). Nobody in the quest gives the
answers away: the player knows the Zone or guesses. Picked so far:
- "Does the Ward enlist stalkers?" Right: "No." (vanilla Pvt. Pilipenko, `E03_MQ02`: "the Ward
  doesn't enlist stalkers").
- "What does the Ward think of Duty?" Right: Don Draper's elevator line from Mad Men, "I don't think
  about you at all." The Ward doesn't rate Duty: Korshunov ended the Duty-Freedom feud with the Treaty
  (Lt. Koronov, `E03_MQ02`), and Duty lost Rostok over it (DLC01 Lt. Kozhukh).

## Decisions

- [x] Decider: given on accept, full durability, with attachments; proof of trust at the meeting; Skif keeps it.
- [x] Sniper's name never shown in text; carrying Wolf's note is the "name" bonus.
- [x] Ward badge: +1 with either badge.
- [x] Meeting spot: the building of shelter `AD27BB2F45CF8138AF598FBBF63DA6A8` by the Weather Station
      (`59B744E544A3194779A169962ABDFBE2`), Zaton. Vanilla EQ139 also puts Ward NPCs there.
- [x] Quest name "Cover Story" / «Легенда»; Wolf's topic "Did the prisoners talk?" (default, change freely).
- [x] Dice (hardcore, after the first playtest): d20 + bonus (0-3). Rolls: Hook's fate DC 13, fishing
      DC 15, a second fishing try DC 14. Telling the truth about Hook, or skipping the password, blows the cover.
      Two quiz questions. Strike limit 2: a failed roll or a wrong answer is a slip; the second slip
      blows the cover.
- [x] Roll visibility: outcome only, no tags (vanilla has no skill tags; brackets are actions only).
- [x] Hand-in pay (default): 8000 coupons, paid in Wolf's dialog.
- [x] Firefight ending pays the same as a clean bluff.

## How it is built

- Job 3 is its own quest, `WolfArmorFetch_Cover` (WolfArmorFetch's End stops all its nodes, so saves
  past Falconry need a separate quest), started from rootgraph like job 1-2's quest.
- Text: `coverText.mts`; dialog trees: `coverDialog.mts`; ids/places/numbers: `cover.mts`; quest
  graph: `coverNodes.mts`; new cfg prototypes: `coverPrototypes.mts`; condition builders: `conditions.mts`.
- Wolf's topics ride RookieVillage_Hub (`transformRookieVillageHub.mts`), the Sultan's favor rides
  Skadovsk_Hub (`transformSkadovskHub.mts`; Sultansk is the Skadovsk hub).
- Rolls are pre-cast when Hook's PDA is picked up (`Random` with 20 pins into `<Q>_Roll1..3`); the
  bonus is added to every roll as Skif walks in (`If` + `SetGlobalVariable Add 1`). A risky reply is one
  option leading to dialog `If` nodes (vanilla RSQ05_Dialog_Sich_C11_Finish_If_1): roll passed / first
  slip / blown. The first playtest's version, hidden reply variants with GlobalVariable conditions,
  showed duplicates. Slips set `<Q>_Strike` with a dialog `SetGlobalVariable` action (vanilla E07_SQ01).
- NPCs are new `ESpawnType::Obj` spawn actors (no placeholder actor in the level). Dealers are
  ObjPrototypes on `GeneralNPC_Varta_Heavy` with their own item generators (armor sets the look);
  the bodyguards are `GeneralNPC_SultanBandit_Stormtrooper` (neutral). Vasyan is an ObjPrototype on that
  stormtrooper with his own NPCPrototype (`NameTextKey`, as vanilla's Sultan) for his name.
- Quest `Conditions` hold one condition per group, joined by `And` (vanilla layout). Two in one group
  passed when either held, so the meeting and Vasyan's line fired on spawn in the second playtest.
- Vasyan: a comment (no dialog window) to the robbed stalker at 10 m, then the forced line to Skif at
  5 m. The fight is launched from the ending pin named after the last line, as vanilla does.
- Walk-in triggers (Vasyan's line, the meeting, the saves, the bodyguards) use `DistanceToPoint` on the
  NPC's stand point. `DistanceToNPC` on the lead let the forced meeting start at ~98 m in the second playtest.
- Checkpoint saves (`SaveGame` nodes, as vanilla EQ50) at 30 m from Vasyan and 20 m from the lead.
- Lines that end a fight (Vasyan's, the blown cover's "Fire!") and the lead's last intel line close the
  dialog (`Terminate = true`). The blown cover is two lines, so the accusation can be read first.
- Forced dialogs start at 5 m from Vasyan (one line, then ChangeRelationships to Enemy) and 2.5 m from
  the lead, so Skif is inside the room first.
- Wolf's hand-in branches on `<Q>_Intel` with a dialog `If` too: the first playtest showed duplicated
  replies at Wolf.
- Wolf's hand-in topic is attached only once Skif has the lead's word or the dealers' PDA: hub listeners
  for the meeting's Intel ending and the PDA pickup, plus a re-attach check on `ReturnToWolf`. It was
  shown from the accept on in the first playtest.
- Blown cover: `ChangeRelationships` (preset Enemy) player↔each dealer and bodyguards↔dealers, plus
  `ResetAI` on the dealers. Their Stay goal was `HigherThanCombat`, which kept them from fighting in the
  first playtest; AI goals are now `HigherThanALife`. Endings are heard from the SetDialog pins as well
  as the dialog-finished event.
- Quest item names use `sid_items_<SID>_name/_description` (the `sid_questItemprototypes_` keys of
  vanilla showed untranslated in the first playtest).

## Implementation checklist

- [x] Spawn actors, dealer ObjPrototypes and loadouts, Decider gift, PDAs, notes, global variables.
- [x] Quest nodes: readiness (a day after the Falcon hand-in, at once on saves past it), accept,
      Hook, rolls, walk-in bonus, forced meeting dialog (re-offered as a topic if walked out of),
      both endings, the dealers' PDA path, Sultan's bodyguards, hand-in, End.
- [x] Dialogs: Wolf offer + hand-in, the Sultan's favor, the meeting.
- [x] Journal entry + stages, localization in all 17 languages.
- [x] `npm run prepare-configs` passes.
- [x] Other 15 languages in `coverText.mts`, then `prepare-configs` again.
- [x] First playtest: almost works. Fixed after it: PDA names, the go-between's line and rename, duplicated replies,
      Wolf giving answers, Ward not aggroing, walk-in distance, harder rolls, dialog style.
- [ ] Second playtest. Unverified, check first:
      - new spawn actors without a placeholder actor actually spawn (Hook, dealers, bodyguards);
      - the d20 `Random` node and dialog `SetGlobalVariable` actions behave (try a `ShowFadeScreen`
        debug line if the meeting misbehaves);
      - armor from the dealers' item generators shows on them;
      - `ItemAdd` of Hook's PDA when shot from further than 80 m (death fallback);
      - the forced meeting dialog starts when walking in, and the re-offer after walking out;
      - bodyguards follow and fight after a blown cover;
      - an existing save past Falconry gets the offer.
- [ ] Add a DesignDocs note on adding spawners + dialogs via cfg once verified in-game.

## Voice integration checklist
- [x] Ukrainian subtitles synced to the approved takes (coverText, deciderText, dialogText); delivery-only diffs left alone.
- [x] `voice/wwise_import.py` reads `voice/approved/`, stages WAVs to `/media/nvme/vm/voice-clone/wwise_stage`, builds a
      `VO_WolfArmorFetch` work unit (Actor-Mixer + Events) with per-speaker mixers copied from vanilla templates.
- [x] `writeDialogRuntimeData` in `src/localization/uasset.mts` (round-trips vanilla `_Voiceover` byte-identically) and
      `voice/runtime-data.mts` -> `raw/Stalker2/Content/Dialogs/<ChainSID>_Voiceover.uasset` (10 chains, 136 lines).
- [ ] Missing takes: ward `Cover_Meeting_Quiz1_Right_001` (en + uk), volk `Cover_Accept_Accepted_002` (en).
- [ ] `prepare-configs` to regenerate the text assets with the synced subtitles (writes the SDK via `sdk/`).
- [ ] Discovery test: one mod `_Voiceover` pointing at vanilla Wolf events, cook-inject, hear it in game.
- [ ] Mod Wwise project in the SDK (extract the ModWwiseOverlay), run `wwise_import.py` over WAAPI, trim + generate banks,
      keep the banks/work units in `wwise/` (the .wem files are our audio: ask before committing).
- [ ] AkAudioEvent .uassets for the 136 events (`src/wwise-event-asset.mts`), into raw/ and the SDK mod's Content/.
- [ ] Copy `Dialogs/*_Voiceover` into the SDK mod's Content/, cook-inject, verify in game (EN + UA).
- [ ] Optional: `_FaceAnimation` assets + lip sync for NPC lines (the player has none).

## After this mod: ModGameData in the shared scripts (only if voice works in game)
- [ ] Tried 2026-10-20: dialog chains + phrases as per-chain `ModGameData/WolfArmorFetch/Dialog{Chain,}Prototypes/<Chain>.cfg`
      in the assets SDK mod (like the SOC workshop mod), via a `StructTransformer.modGameData` option. Reverted before the
      in-game result: split mods keep every cfg in `<Mod>Cfg` for fast repacks, and the Cfg SDK mod has no
      GameFeatureData, so it can't mount a ModGameData tree. Revisit only with a way to ship ModGameData from the Cfg half.
- [ ] If it does work: upgrade the shared scripts (cfg processor output option, push-to-sdk routing, the cook
      fingerprint - `ensure-cooked` skipped the cook when only ModGameData cfgs changed - repack/inject, AGENTS.md and
      the eng-config-transforms skill).
