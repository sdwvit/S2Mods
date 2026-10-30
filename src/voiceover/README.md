# Voiceover workflow

Voiced dialog lines for mods, cloned from the game's own voices with Higgs Audio v3 (text-to-speech from a reference
clip), reviewed by the user on a local website, refined by an agent, and kept as approved takes.

- `pipeline/`: generation and analysis scripts (Python and shell).
- `server/`: the review website and the agent that answers notes (`server/README.md`).
- `AGENT_PROTOCOL.md`: how agents work with the review site.

Game audio and generated takes never go into the repo: everything lives in a workspace folder outside it.

## Setup

1. **Workspace.** Make a folder outside the repo and set `VOICEOVER_ROOT` in `.env` to it. The scripts create
   `higgs/`, `review/` and `archive/` as needed.
2. **Higgs Audio v3.** Clone `https://github.com/Saganaki22/Higgs_v3-TTS-ComfyUI` (tested at v0.1.9) into
   `<root>/src/higgs-comfy`, or set `VOICEOVER_HIGGS_SRC`. Only its `native.py` is used (the plain PyTorch path,
   no ComfyUI).
3. **Higgs venv** at `<root>/.venv-higgs` (or set `VOICEOVER_HIGGS_PYTHON`): Python 3.12, torch + torchaudio 2.8
   (tested with the ROCm 6.4 build on an AMD GPU; a CUDA build should work), transformers 5.5, numpy, soundfile,
   safetensors, tokenizers.
4. **Model:** `bosonai/higgs-tts-3-4b` from Hugging Face. The scripts read the Hugging Face cache
   (`~/.cache/huggingface/hub/models--bosonai--higgs-tts-3-4b/snapshots`), or set `VOICEOVER_HIGGS_MODEL`.
5. **Analysis tools (optional).** A venv with `praat-parselmouth`, numpy and soundfile for
   `analyze_take.py`/`select_en.py`. `voice_sim.py` needs torch and transformers; it runs on CPU.
6. **Review site:** `npm run voiceover-server`, then open http://127.0.0.1:8765. It needs `claude` on PATH for the
   agent, or set `VOICEOVER_AGENT=0`.

`.env` keys: `VOICEOVER_ROOT`, `VOICEOVER_APPROVED_DIR`, `VOICEOVER_MOD_DIR`, `VOICEOVER_AGENT*`
(see `.env.sample` and `server/README.md`).

## Workspace layout

| Path                                                    | What it is                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `refs/higgs/<spk>_<lang>.wav`                           | reference clip of a speaker's voice in one language                                                 |
| `refs/higgs/refs_new.json`                              | `{"<spk>_<lang>": {"wav", "text", "clips"}}`: each reference with its transcript and source clips   |
| `higgs/<spk>_<lang>.json`                               | the script: `{refs, lines: [{n, sid, speaker, text, same_as?, ua?}]}`                               |
| `higgs/<spk>_<lang>/<NN>_<sid>/s2024.wav`               | the line's current take (the seed in the name)                                                      |
| `higgs/<spk>_<lang>/<NN>_<sid>/alt-<name>.wav` + `.txt` | an alternative and the exact text it used                                                           |
| `higgs/final/<spk>_<lang>/<NN>_<sid>.wav`               | the approved take (written by the server on a pick)                                                 |
| `higgs_test/`                                           | ad-hoc experiments that are not script lines (`higgs_dialog.py` output)                             |
| `review/`                                               | `feedback.jsonl`, `agent_events.jsonl`, `jobs/` (pid files, GPU lock), agent session, runs and logs |
| `archive/<date>/`                                       | everything superseded: old takes, unpicked seeds, deleted takes. Nothing is deleted outright.       |

`sid` is the game's dialog phrase SID, so a take maps one-to-one to a subtitle line. `same_as` marks a line with
the same words as another: it reuses that line's final take. In English scripts, `ua` keeps the Ukrainian source
line the tags were taken from.

## Steps

1. **References.** For each speaker and language, join a few calm vanilla lines of that voice into a 20-30 s clip,
   and write down exactly what is said in it (the subtitle text of each clip). The voice files are in the SDK's
   `O/Voices/<lang>/` banks; their subtitle text is in the game's localization, keyed by the phrase SID. Add a
   second reference for shouting lines when the voice has them (for example `<spk>_angry_<lang>.wav`, used with
   `@<ref>`). Accent and timbre come from the reference: a reference in the wrong mood colours every take.
2. **Script.** One `higgs/<spk>_<lang>.json` per speaker and language, in dialog order, with tagged text (see
   Tagging). Ukrainian first: it is the original language of the game, so its takes become the model for English.
3. **Generate.** `pipeline/gen_chunks.sh <spk>_<lang> 1` generates every line without a folder yet, in chunks, taking
   the GPU lock per chunk so review jobs can run in between. A take is kept only when its length fits the text
   (about 13 characters per second); otherwise the next seed is tried. Seed 2024 goes first.
4. **Review.** The user listens on the site, picks a take (it is copied to `higgs/final/`) or writes a note. Notes
   go to the agent, which makes new takes or alternatives (`AGENT_PROTOCOL.md`).
5. **English.** Once Ukrainian lines are approved, `pipeline/en_from_ua.py --text <subtitles.json> <spk>...` writes
   `higgs/<spk>_en.json`, carrying each Ukrainian line's tags onto the English subtitle at the same place.
   Generate with three seeds per line (`gen_chunks.sh <spk>_en 3`), then `pipeline/select_en.py <spk>...` keeps the
   seed whose delivery measures closest to the approved Ukrainian take (pitch level and range, pauses, ending)
   and archives the rest. The user reviews the English batch like the Ukrainian one.
6. **Approved takes.** After every pick, `pipeline/backup_finals.sh` mirrors `higgs/final/` into
   `VOICEOVER_APPROVED_DIR` (for example a `voice/approved/` folder in the mod) and writes `manifest.json`
   (`{file: {sid, speaker, text, tagged_text}}`, `text` without tags or stress marks). That folder is what mod
   integration works from. If the user changed a line's words, its subtitle must change to match.

Checks: `analyze_take.py --ref <ref.wav> <take>...` prints pitch, range, pauses and phrase endings (falling =
statement, rising = question); `voice_sim.py <spk>_<lang> <take>...` flags takes whose voice sits closer to another
reference (reliable for distinct voices, noisy for similar ones).

## Tagging

Higgs reads inline tags such as `<|prosody:expressive_low|>`, `<|prosody:pitch_low|>`, `<|prosody:pause|>`,
`<|prosody:long_pause|>`, `<|prosody:speed_slow|>`, `<|emotion:bitterness|>`, `<|emotion:determination|>`,
`<|emotion:amusement|>`, `<|emotion:surprise|>`, `<|emotion:anger|>`, `<|emotion:contemplation|>`. What worked:

- `expressive_low` at the start of a line, and the strong emotion late in the sentence.
- One tag at the start of a sentence. Two tags stacked together leak a glitch into the audio.
- A tag right before a word can break that word's stress; keep tags away from hard-stress words.
- An early `determination` in a short line makes it too intense.
- Ukrainian stress: a combining acute (U+0301) after the stressed vowel is honoured (`ва́ртівський`); capitals and
  hyphens are not. Capitals do work for emphasis in English (`Do you even KNOW…`).
- There is no tag for every mood (no suspicion, no annoyance): use nearby ones (`pitch_low`, `speed_slow`, `anger`)
  and offer alternatives.
- Tagged lines can run away (50 s for an 8 s line); the length check rerolls the seed.

## Into the game (mod side)

Known so far, not yet verified end to end for mod assets: the game finds a line's voice and face animation through
`DialogRuntimeData` assets named `<ChainSID>_Voiceover` and `<ChainSID>_FaceAnimation` (phrase SID -> AkAudioEvent /
AnimSequence); cfgs and the localization asset hold no voice data. The audio goes into the Zone Kit's Wwise project
as Sound Voice objects with English and Ukrainian sources plus an Event per line (see the `eng-wwise` skill). Lip
sync is a baked `AS_FAC_<EN|UA>_<speaker>_<phrase>` AnimSequence on the face skeleton; the player has none.
Adding audio makes a mod an asset mod (cook-inject).

### Lip sync

Audio-driven face animation, fitted on a vanilla speaker's own lines: the scripts and the steps are in the
`eng-dialog-voiceover` skill (`.claude/skills/eng-dialog-voiceover/`, section "Making lip-sync anims").
