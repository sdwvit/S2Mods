# Voiceover review server

Part of the voiceover workflow (`../README.md`); agents follow `../AGENT_PROTOCOL.md`.

A local web page for reviewing generated voice lines: listen to takes, pick finals, leave notes for an agent.
Node.js 24+, no dependencies at runtime (jsdom is only used by the tests).

```sh
npm run voiceover-server [-- <port>]   # default port 8765 (or REVIEW_PORT)
```

Set `VOICEOVER_ROOT` in `.env` to the voice workspace. The server reads and writes only inside it:

| Path in the workspace                | What it is                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `higgs/<batch>.json`                 | script for one speaker and language: `{refs, lines: [{n, sid, speaker, text}]}` |
| `higgs/<batch>/<NN>_<sid>/*.wav`     | takes for a line; `alt-<name>.txt` next to an alternative holds its text        |
| `higgs/final/<batch>/<NN>_<sid>.wav` | the picked take for a line                                                      |
| `higgs_test/<name>.json`             | test groups (`variants`)                                                        |
| `review/feedback.jsonl`              | the user's feedback records (append-only)                                       |
| `review/agent_events.jsonl`          | progress events from the server and agents (append-only)                        |
| `review/jobs/<sid>.pid`              | running generation jobs, shown under "Agent activity"                           |

## What the server does by itself

After saving a feedback record for a `batch:` group:

- `pick` / `good` copies the take to `higgs/final/` and posts a `done` event (`Final: …`). An alternative's text
  becomes the line's script text.
- `unpick` moves that final copy to `archive/unfinal/<date>/` (`Unpicked: …`).
- `apply_text` with no comment posts `queued` and starts `../pipeline/line_job.sh <sid> <batch> <sid> <text> <feedback_id>`.

Anything with a hand-written comment is left for an agent: `GET /api/pending` lists those records.
`GET /api/missing` lists batch lines with no takes yet: lines never generated, and lines the other language's
script (`<speaker>_en` / `<speaker>_uk`) has but this one lacks. A line with `same_as` reuses that line's final take.

## The agent

Notes with a hand-written comment go to a Claude Code agent the server keeps running (`claude -p` with stream-json
input). It reads the dialog around the line, starts `alt_jobs.sh` / `line_job.sh` jobs from `../pipeline/`, and may
update subtitles in the mod source (`VOICEOVER_MOD_DIR`). Its tools are limited to reading, editing, those two scripts and `curl`
for events.

- Notes that arrive while it works go together in the next message.
- The session id is saved in `review/agent_session.json`; a restarted server resumes it (`--resume`). After 25 notes
  (`VOICEOVER_AGENT_ROTATE`) the next note starts a fresh session.
- Every turn is logged to `review/agent_runs.jsonl` with its cost; the page header shows the total and today's spend.
- `VOICEOVER_AGENT_DAILY_USD` (default 15) caps a calendar day: further notes wait until the next day.
- A note the agent leaves without an event gets the agent's summary; a failed or timed-out turn
  (`VOICEOVER_AGENT_TIMEOUT_MIN`, default 15) posts the error under the line.
- Settings: `VOICEOVER_AGENT=0` turns it off, `VOICEOVER_AGENT_MODEL` (default `sonnet`), `VOICEOVER_AGENT_CMD`,
  `VOICEOVER_MOD_DIR` (the mod whose subtitles it may edit; unset = no subtitle edits),
  `VOICEOVER_PIPELINE_DIR` (default `../pipeline`). Logs: `review/agent_logs/<date>.log`.

## API

- `GET /api/groups[?ids=a,b]`, `/api/feedback`, `/api/pending`, `/api/missing`, `/api/runs`, `/api/linestatus`, `/api/events?n=30`,
  `/api/jobs`, `/api/run`
- `GET /api/stream`: Server-Sent Events, `change` with the list of changed groups/files
- `GET /audio/<path>`: a take, with HTTP Range
- `POST /api/feedback` `{group, sid, verdict, n?, take?, comment?, suggested_text?}`
- `POST /api/event` `{feedback_id?, group?, sid?, status, message?}`; status is one of
  `seen queued working regenerated done question`
- `POST /api/delete` `{path}`: moves a take to `archive/deleted/<date>/`

## Tests

```sh
pnpm vitest run src/voiceover/server
```

The tests start the real server against a throwaway workspace and drive `index.html` in jsdom.
