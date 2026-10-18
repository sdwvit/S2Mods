# Voice review: agent protocol

How an agent works with the review site (`server/`) and the voice workspace (`VOICEOVER_ROOT`). The workflow as a
whole is in `README.md`.

The page writes the user's feedback to `review/feedback.jsonl`; progress goes to `review/agent_events.jsonl`. Both are
append-only JSON Lines: never rewrite or truncate them. The page picks up changes within about a second.
Run commands from the workspace root. The scripts named here are in `pipeline/` of this folder.

## Who handles what

- **The server** acts on mechanical feedback for `batch:` groups as soon as it saves the record:
  - `good`, `pick`, `unpick`: copies the take to `higgs/final/` (or moves an unpicked final to `archive/unfinal/`),
    posts a `done` event ("Final: …" / "Unpicked: …") and runs `backup_finals.sh`. On startup it does this once more
    for picks made while it was down.
  - `apply_text` with `suggested_text` and an empty comment: posts `queued`, then starts
    `line_job.sh <sid> <batch> <sid> <text> <feedback_id>`.
- **The server's agent** (a `claude -p` process the server keeps, see `server/README.md`) gets every record with a
  hand-written comment, including a pick that carries a comment (the pick is finalized, the comment still needs
  audio), and every `test:` record.
- **An interactive agent** must not also watch feedback while the server's agent is on: both would handle the same
  note. To work notes by hand, run the server with `VOICEOVER_AGENT=0`.

## Rules for notes

- The user works only on the website and cannot answer there. Never post `question`, never suggest an edit for the
  user to apply. Every note is a request for new audio: generate it.
- When a note gives new wording, voice exactly that text (no extra edits of your own) and update the line's subtitle
  in the mod source to match.
- When the note is open-ended ("use context", "better emotion") or you are unsure, generate 2-3 alternatives:
  `alt_jobs.sh <batch> <sid> <feedback_id> <name>[@<ref>] "<text>" ...` runs them in sequence as one line job, each
  as `alt-<name>.wav` + `alt-<name>.txt`. `@<ref>` voices a take with another key from the script's `refs`.
- One exact change: `line_job.sh <sid> <batch> <sid> "<text>" <feedback_id>` replaces the line's `s2024.wav` and the
  script text. A new job for a line cancels that line's running job.
- Read the neighbouring lines (the batch script and the mod's dialog) before choosing emotion or emphasis.
- Tags: see "Tagging" in `README.md`. One tag at a sentence start, never two stacked.
- Don't wait for generation; jobs post `working` and `regenerated` themselves. Never edit `higgs/final/` by hand.

## Feedback record (`review/feedback.jsonl`)

```json
{
  "id": "026355750d",
  "ts": "2026-10-16T23:20:50+0100",
  "group": "batch:pc_uk",
  "n": 27,
  "sid": "<phrase SID>",
  "take": "s2024.wav",
  "verdict": "redo",
  "comment": "reads like a question",
  "suggested_text": null,
  "status": "new"
}
```

- `group`: `batch:<dir under higgs/>` (script `higgs/<name>.json`, or the longest prefix: `volk_uk_old` ->
  `volk_uk.json`) or `test:<name>` (`higgs_test/<name>.json`, `sid` = variant name, `#i` when a variant has several lines).
- `take`: wav file in the line's folder (`higgs/<batch>/<NN>_<sid>/`), or null for the whole line.
- `verdict`: `pick` / `unpick` (a take), `good` (old records), `redo` (comment), `apply_text` (`suggested_text`),
  `comment` (a note).
- `suggested_text`: null unless the user edited the text; may contain Higgs tags and U+0301 stress marks. Use it verbatim.
- `status` in the file is always `new`; the current status is the latest matching event.

## Finding work

- `python3 -I pipeline/pending_feedback.py` (or `GET /api/pending`): records an agent still has to handle. A record
  leaves the list once any agent event refers to it, so post `queued` as soon as a job is scheduled (`alt_jobs.sh`
  does this itself).
- `GET /api/missing`: batch lines without any take, never generated or only in the other language's script
  (`missing` names that script, `missing_text` its text). Add the line to the script if needed and generate it.
  A `same_as` line reuses its source's final take and needs nothing.

## Events

`curl -s -XPOST 127.0.0.1:8765/api/event -d '{"feedback_id":"…","group":"batch:pc_uk","sid":"…","status":"regenerated","message":"new take s7.wav"}'`

Status is one of `seen`, `queued`, `working`, `regenerated`, `done`, `question`. Include `feedback_id` whenever you act
on a record; without it, the event applies to all feedback on that `group`+`sid` submitted before it.

On the page:

- **Pulsing dot:** `queued`/`seen`, or `redo`/`apply_text` feedback with no event yet.
- **Spinning ring:** `working`.
- **Green check, for a few seconds:** `regenerated` or `done`; clears the pending state.
- The newest event message shows under the line text when it is newer than the user's last note.
- "Needs me" lists lines with unheard takes, lines never reviewed, and lines where an agent replied after the
  user's last note. Lines with no takes are shown with a "no takes yet" badge but are not in "Needs me".
