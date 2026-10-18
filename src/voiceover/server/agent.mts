// A Claude Code agent kept alive next to the review server. It receives review notes that need an agent (a
// hand-written comment) as stream-json user messages, one batch at a time, and starts the generation jobs itself.
// The session id is saved, so a restarted server resumes the same conversation (`claude --resume`).
// Each finished turn is logged with its cost to review/agent_runs.jsonl; no note is sent once today's runs
// reach the daily budget (notes wait for the next day).
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

type Rec = Record<string, any>;

export interface AgentOptions {
  root: string; // voice workspace (cwd of the agent)
  modDir: string | null; // mod source the agent may read and edit (subtitles)
  pipelineDir: string; // the generation scripts the agent may run
  protocol: string; // AGENT_PROTOCOL.md
  port: number;
  model: string;
  command: string; // claude executable
  turnTimeoutMs: number;
  rotateAfter: number; // start a fresh session after this many notes
  dailyUsd: number; // budget per calendar day (local time)
  pending: () => Rec[]; // records an agent still has to handle
  lineInfo: (rec: Rec) => Rec | null; // the line's script entry and takes, for the prompt
  postEvent: (e: Rec) => void;
  runs: () => Rec[];
  appendRun: (r: Rec) => void;
  now: () => string;
}

const rules = (o: AgentOptions) => {
  const alt = path.join(o.pipelineDir, "alt_jobs.sh"),
    one = path.join(o.pipelineDir, "line_job.sh");
  return `You handle review notes for generated game voice lines.
The working directory is the voice workspace. Read ${o.protocol} once at the start of the session and follow it.
${o.modDir ? `Mod source (dialog order and subtitle text): ${o.modDir}` : "No mod source is configured: do not edit subtitles."}
Rules:
- The user works only on the review website and cannot answer questions. Never ask, never post a "question" event.
  Every note is a request for new audio: generate it.
- When a note gives new wording, voice exactly that text${o.modDir ? ", and update the same line's subtitle in the mod source (find it by its current text; English for *_en batches, Ukrainian for *_uk batches)" : ""}.
- When the note is open-ended or you are unsure, generate 2-3 alternatives with
  ${alt} <batch> <sid> <feedback_id> <name>[@<ref>] "<text>" ...
  For one exact change use ${one} <sid> <batch> <sid> "<text>" <feedback_id>.
- Higgs tags: one tag at the start of a sentence, never two stacked; available tags are the ones already used in higgs/*.json.
- Read the neighbouring lines (higgs/<batch>.json${o.modDir ? " and the mod dialog" : ""}) before choosing emotion or emphasis.
- Do not wait for generation to finish; the jobs post their own progress. Do not touch higgs/final/.
- Events: curl -s -XPOST 127.0.0.1:${o.port}/api/event -d '{"feedback_id":..., "group":..., "sid":..., "status":..., "message":...}'
- End every turn with one short line per note saying what you started.`;
};

export function createAgent(o: AgentOptions) {
  const sessionFile = path.join(o.root, "review", "agent_session.json");
  const logDir = path.join(o.root, "review", "agent_logs");
  let proc: ChildProcessWithoutNullStreams | null = null;
  let procCost = 0; // total_cost_usd is cumulative per process
  let inFlight: Rec[] = [];
  let turnStart = 0;
  let timer: NodeJS.Timeout | null = null;
  let resumed = false;
  let gotResult = false;
  const sent = new Set<string>(); // feedback ids handed to the agent (never sent twice)

  const loadSession = (): Rec => {
    try {
      return JSON.parse(fs.readFileSync(sessionFile, "utf8"));
    } catch {
      return {};
    }
  };
  const saveSession = (s: Rec) => fs.writeFileSync(sessionFile, JSON.stringify(s, null, 1));
  const spentToday = () => {
    const day = o.now().slice(0, 10);
    return o
      .runs()
      .filter((r) => String(r.ts).startsWith(day))
      .reduce((a, r) => a + Number(r.cost_usd || 0), 0);
  };

  function log(line: string) {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, o.now().slice(0, 10) + ".log"), line + "\n");
  }

  function start() {
    const s = loadSession();
    const args = [
      "-p",
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      o.model,
      "--add-dir",
      path.dirname(o.protocol),
      ...(o.modDir ? ["--add-dir", o.modDir] : []),
      "--append-system-prompt",
      rules(o),
      "--allowedTools",
      "Read",
      "Grep",
      "Glob",
      "Edit",
      `Bash(${path.join(o.pipelineDir, "alt_jobs.sh")}:*)`,
      `Bash(${path.join(o.pipelineDir, "line_job.sh")}:*)`,
      "Bash(curl:*)",
    ];
    resumed = !!s.session_id;
    if (resumed) args.push("--resume", s.session_id);
    gotResult = false;
    procCost = 0;
    const p = spawn(o.command, args, {
      cwd: o.root,
      env: { ...process.env, REVIEW_PORT: String(o.port) },
    });
    proc = p;
    log(`${o.now()} start ${resumed ? "resume " + s.session_id : "new session"} (pid ${p.pid})`);
    readline.createInterface({ input: p.stdout }).on("line", (ln) => onLine(ln));
    readline.createInterface({ input: p.stderr }).on("line", (ln) => log("stderr: " + ln));
    p.stdin.on("error", () => {});
    p.on("error", (e) => log("spawn error: " + e.message));
    p.on("exit", (code, sig) => {
      log(`${o.now()} exit ${code ?? sig}`);
      if (proc !== p) return;
      proc = null;
      if (resumed && !gotResult) saveSession({}); // the saved session could not be resumed: start fresh next time
      if (inFlight.length) finish(null, `agent stopped (${code ?? sig})`);
    });
  }

  function onLine(ln: string) {
    let d: Rec;
    try {
      d = JSON.parse(ln);
    } catch {
      return;
    }
    if (d.type === "system" && d.subtype === "init" && d.session_id) {
      const s = loadSession();
      if (s.session_id !== d.session_id) saveSession({ session_id: d.session_id, notes: 0 });
    }
    if (d.type === "assistant") {
      for (const c of d.message?.content || []) {
        if (c.type === "text" && c.text) log("assistant: " + c.text);
        if (c.type === "tool_use") log("tool: " + JSON.stringify(c.input).slice(0, 500));
      }
    }
    if (d.type === "result") {
      gotResult = true;
      finish(d, d.is_error ? `agent error: ${d.subtype || ""} ${d.result || ""}`.trim() : null);
    }
  }

  /** Close the turn: log the run with its cost, answer notes the agent left without any event, send the next batch. */
  function finish(res: Rec | null, error: string | null) {
    if (timer) clearTimeout(timer);
    timer = null;
    const batch = inFlight;
    inFlight = [];
    const total = Number(res?.total_cost_usd || 0);
    const cost = Math.max(0, total - procCost);
    procCost = total;
    const s = loadSession();
    o.appendRun({
      ts: o.now(),
      feedback_ids: batch.map((r) => r.id),
      sids: batch.map((r) => r.sid),
      model: Object.keys(res?.modelUsage || {}).join(",") || o.model,
      cost_usd: Math.round(cost * 1e6) / 1e6,
      turns: res?.num_turns ?? null,
      duration_ms: res?.duration_ms ?? Date.now() - turnStart,
      ok: !error,
      session_id: res?.session_id || s.session_id || null,
      result: String(error || res?.result || "").slice(0, 2000),
    });
    // a note the agent did not answer with any event still has to show something under the line
    const open = new Set(o.pending().map((r) => r.id));
    for (const r of batch) {
      if (!open.has(r.id)) continue;
      o.postEvent({
        feedback_id: r.id,
        group: r.group,
        sid: r.sid,
        status: error ? "question" : "done",
        message: error
          ? `Agent failed: ${error.slice(0, 300)}. Send the note again to retry.`
          : `Agent: ${String(res?.result || "").slice(0, 500)}`,
      });
    }
    if (res && s.session_id) {
      const notes = (s.notes || 0) + batch.length;
      if (notes >= o.rotateAfter) {
        saveSession({}); // long sessions get slow and costly: the next note starts a fresh one
        proc?.stdin.end();
      } else saveSession({ ...s, notes });
    }
    setImmediate(pump);
  }

  /** Send every note that needs an agent and was not sent yet, as one message (unless today's budget is spent). */
  function pump() {
    if (inFlight.length) return;
    const todo = o.pending().filter((r) => !sent.has(r.id));
    if (!todo.length || spentToday() >= o.dailyUsd) return;
    if (!proc) start();
    for (const r of todo) sent.add(r.id);
    inFlight = todo;
    turnStart = Date.now();
    const notes = todo.map((r) => ({ ...r, line: o.lineInfo(r) }));
    const text =
      `New review notes (${todo.length}). Handle each one, then end the turn.\n` +
      notes.map((n) => JSON.stringify(n)).join("\n");
    log(`${o.now()} send ${todo.map((r) => r.id).join(",")}`);
    proc!.stdin.write(
      JSON.stringify({ type: "user", message: { role: "user", content: text } }) + "\n",
    );
    timer = setTimeout(() => {
      log(`${o.now()} turn timeout`);
      const p = proc;
      proc = null;
      finish(null, `no answer in ${Math.round(o.turnTimeoutMs / 60000)} min`);
      p?.kill();
    }, o.turnTimeoutMs);
  }

  return {
    pump,
    status: () => ({
      state: inFlight.length ? "working" : proc ? "idle" : "off",
      notes: inFlight.map((r) => ({ id: r.id, group: r.group, sid: r.sid })),
      spent_today: Math.round(spentToday() * 1e4) / 1e4,
      daily_usd: o.dailyUsd,
      paused: spentToday() >= o.dailyUsd,
      model: o.model,
    }),
    stop: () => proc?.kill(),
  };
}
