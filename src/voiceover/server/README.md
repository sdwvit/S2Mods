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
| `review/review.sqlite`               | the user's feedback, progress events and agent runs (tables `feedback`, `events`, `runs`) |
| `review/jobs/<id>.log`, `gpu.lock`   | queue job logs; the lock GPU jobs hold while they run                           |

Everything lives in SQLite (Node's built-in `node:sqlite`), with one source for each kind of state:

- **Static records** (`store.mts`): `feedback` (the user's notes), `events` (the history of what happened on lines and
  notes) and `runs` (agent turns), one column per field. They never say what is happening now.
- **Dynamic state** (`queue.mts`): the `jobs` table and the pause setting. A line's dot (queued, running, held, paused)
  and a note's status come from the queue alone: its job, or the note waiting for one.

Older stores are migrated on start: tables that kept each record as a JSON blob, and the `feedback.jsonl`,
`agent_events.jsonl` and `agent_runs.jsonl` files (imported once, then renamed to `<name>.jsonl.imported`).

## Job queue

Generation work runs through a queue in the server (`queue.mts`, table `jobs`), one GPU job at a time
(`VOICEOVER_GPU_SLOTS`). `../pipeline/line_job.sh`, `alt_jobs.sh` and `stitch_jobs.sh` enqueue their work; anything
else can use `../pipeline/enqueue.py` or `POST /api/queue`.

- A job is a list of commands (steps) run from the workspace root in their own process group. Every step runs; the job
  fails when any step fails (exit code and `review/jobs/<id>.log`, plus a `Failed: …` event on the line).
- GPU jobs hold `review/jobs/gpu.lock`, so scripts outside the queue that take the same lock (`gen_chunks.sh`) wait
  for them and the other way round. Commands in the queue must not take the lock themselves.
- **Invalidation:** a job supersedes the queued jobs with the same `key` and stops the running one (line jobs use
  `line:<sid>`). Cancel by `id`, `key` or key `prefix`.
- **Freshness:** with `outputs` (and `inputs`), a job is skipped as "up to date" when every output exists and is newer
  than every input, and the last finished job with that key ran the same commands. Touch an input to force a rerun.
- Higher `priority` runs first, then the oldest. Jobs running when the server stops are queued again on the next start.
- **Hold** one job (⏸ on its row, `POST /api/queue/hold {id | key | prefix, held}`): it stays in the queue, after the
  queued ones, and does not start (a running one is stopped) until released (▶).
- **Pause** (`POST /api/queue/pause {paused}`, or the button on the page): no job starts and a running job goes back to
  the queue, so nothing uses the GPU. The setting is kept in the database and survives restarts; `GET /api/queue/state`.
- Notes from the page that no job has taken up yet are listed at the end of the queue as `waiting`; ✕ dismisses one.
- The page shows the queue (running job first, then queued jobs in run order), each with a cancel button.

## Take versions

A take is never overwritten: before a job writes `<line>/<take>.wav`, `../pipeline/keep_version.py` moves the current
file (and its `.txt` sidecar) to `<line>/versions/<take>/NNN.wav`, oldest first. The page shows `‹ n/N ›` on a take
with versions; play, pick, ✎ and delete act on the version shown, and a pick of an older version copies that file to
finals (`take` is then `versions/<take>/NNN.wav`).

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
- Every turn is logged to the `runs` table with its cost; the page header shows the total and today's spend.
- `VOICEOVER_AGENT_DAILY_USD` (default 15) caps a calendar day: further notes wait until the next day.
- A note the agent leaves without an event gets the agent's summary; a failed or timed-out turn
  (`VOICEOVER_AGENT_TIMEOUT_MIN`, default 15) posts the error under the line.
- Settings: `VOICEOVER_AGENT=0` turns it off, `VOICEOVER_AGENT_MODEL` (default `sonnet`), `VOICEOVER_AGENT_CMD`,
  `VOICEOVER_MOD_DIR` (the mod whose subtitles it may edit; unset = no subtitle edits),
  `VOICEOVER_PIPELINE_DIR` (default `../pipeline`). Logs: `review/agent_logs/<date>.log`.

## API

- `GET /api/groups[?ids=a,b]`, `/api/feedback`, `/api/pending`, `/api/missing`, `/api/runs`, `/api/linestatus`, `/api/events?n=30`,
  `/api/run`, `/api/queue[?all=1|?id=N]`
- `POST /api/queue` `{key, steps: [[argv...]...], label?, priority?, group?, sid?, feedback_id?, inputs?, outputs?, gpu?}`,
  `/api/queue/cancel` `{id | key | prefix | feedback_id}`, `/api/queue/retry` `{id}`, `/api/queue/pause` `{paused}`, `/api/queue/hold` `{id | key | prefix, held}`
- `GET /api/stream`: Server-Sent Events, `change` with the list of changed groups/files
- `GET /audio/<path>`: a take, with HTTP Range
- `POST /api/feedback` `{group, sid, verdict, n?, take?, comment?, suggested_text?}`
- `POST /api/event` `{feedback_id?, group?, sid?, status, message?}`; status is one of
  `seen queued done question`
- `POST /api/delete` `{path}`: moves a take to `archive/deleted/<date>/`

## Tests

```sh
pnpm vitest run src/voiceover/server
```

The tests start the real server against a throwaway workspace and drive `index.html` in jsdom.
