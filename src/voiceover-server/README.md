# Voiceover review server

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
| `scripts/line_job.sh`                | optional: started for an edited text with no comment                            |
| `scripts/backup_finals.sh`           | optional: run after finals change                                               |

## What the server does by itself

After saving a feedback record for a `batch:` group:

- `pick` / `good` copies the take to `higgs/final/` and posts a `done` event (`Final: …`). An alternative's text
  becomes the line's script text.
- `unpick` moves that final copy to `archive/unfinal/<date>/` (`Unpicked: …`).
- `apply_text` with no comment posts `queued` and starts `scripts/line_job.sh <sid> <batch> <sid> <text> <feedback_id>`.

Anything with a hand-written comment is left for an agent: `GET /api/pending` lists those records.

## API

- `GET /api/groups[?ids=a,b]`, `/api/feedback`, `/api/pending`, `/api/linestatus`, `/api/events?n=30`,
  `/api/jobs`, `/api/run`
- `GET /api/stream`: Server-Sent Events, `change` with the list of changed groups/files
- `GET /audio/<path>`: a take, with HTTP Range
- `POST /api/feedback` `{group, sid, verdict, n?, take?, comment?, suggested_text?}`
- `POST /api/event` `{feedback_id?, group?, sid?, status, message?}`; status is one of
  `seen queued working regenerated done question`
- `POST /api/delete` `{path}`: moves a take to `archive/deleted/<date>/`

## Tests

```sh
pnpm vitest run src/voiceover-server
```

The tests start the real server against a throwaway workspace and drive `index.html` in jsdom.
