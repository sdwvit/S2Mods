// Job queue for generation work (table `jobs` in review/review.sqlite), run by the review server.
// - A job is one or more commands (steps) run in order in its own process group, from the workspace root, with
//   stdout/stderr in review/jobs/<id>.log. Every step runs; the job fails when any step fails. GPU jobs (the default) hold review/jobs/gpu.lock while they run, so they
//   also wait for scripts outside the queue that take the same lock. Up to `slots` jobs run at a time.
// - Invalidation by key: a new job supersedes the queued jobs with the same key and stops the running one.
// - Freshness: a job that names its inputs and outputs is skipped ("up to date") when every output exists and is
//   newer than every input, and the last finished job with that key ran the same commands.
// - A job left running when the server stopped is queued again on the next start.
// - A job can be held: it stays in the queue but does not start (a running one is stopped) until it is released.
// - Paused (kept in the database, so it survives restarts): no new job starts; a running job is stopped and queued
//   again, so nothing runs on the GPU until the queue is resumed.
// - The queue posts no events: it is itself the live view. A failed job stays listed (status failed) until it is
//   dismissed or a newer job with its key replaces it.
import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

type Rec = Record<string, any>;

export type JobSpec = {
  key: string;
  steps: string[][];
  label?: string;
  priority?: number;
  group?: string;
  sid?: string;
  feedback_id?: string;
  inputs?: string[];
  outputs?: string[];
  gpu?: boolean;
};

const sh = (a: string) => "'" + a.replace(/'/g, "'\\''") + "'";

export function createQueue(o: {
  db: DatabaseSync;
  root: string;
  slots: number;
  now: () => string;
}) {
  const { db } = o;
  const logDir = path.join(o.root, "review", "jobs");
  const lockFile = path.join(logDir, "gpu.lock");
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY, key TEXT NOT NULL, label TEXT, steps TEXT NOT NULL, cmd_hash TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, grp TEXT, sid TEXT, feedback_id TEXT,
      inputs TEXT NOT NULL DEFAULT '[]', outputs TEXT NOT NULL DEFAULT '[]', gpu INTEGER NOT NULL DEFAULT 1,
      created TEXT, started TEXT, finished TEXT, pid INTEGER, exit_code INTEGER, message TEXT);
    CREATE INDEX IF NOT EXISTS jobs_status ON jobs (status, priority DESC, id);
    CREATE INDEX IF NOT EXISTS jobs_key ON jobs (key, id);
    CREATE TABLE IF NOT EXISTS queue_settings (name TEXT PRIMARY KEY, value TEXT);
  `);
  const procs = new Map<number, ChildProcess>();
  let version = 0; // bumped on every change, for the page's change stream

  const get = (id: number) => db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Rec | undefined;
  const set = (id: number, fields: Rec) => {
    const keys = Object.keys(fields);
    db.prepare(`UPDATE jobs SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(
      ...keys.map((k) => fields[k]),
      id,
    );
    version++;
  };
  /** The job as the API returns it. */
  const view = (j: Rec) => ({
    id: j.id,
    key: j.key,
    label: j.label,
    status: j.status,
    priority: j.priority,
    group: j.grp,
    sid: j.sid,
    feedback_id: j.feedback_id,
    steps: JSON.parse(j.steps),
    inputs: JSON.parse(j.inputs),
    outputs: JSON.parse(j.outputs),
    gpu: !!j.gpu,
    created: j.created,
    started: j.started,
    finished: j.finished,
    exit_code: j.exit_code,
    message: j.message,
    log: path.relative(o.root, path.join(logDir, `${j.id}.log`)),
  });
  const mtime = (p: string) => {
    try {
      return fs.statSync(path.resolve(o.root, p)).mtimeMs;
    } catch {
      return null;
    }
  };
  function upToDate(j: Rec) {
    const outs: string[] = JSON.parse(j.outputs),
      ins: string[] = JSON.parse(j.inputs);
    if (!outs.length) return false;
    const outT = outs.map(mtime),
      inT = ins.map(mtime);
    if (outT.some((t) => t === null) || inT.some((t) => t === null)) return false;
    if (Math.min(...(outT as number[])) < Math.max(0, ...(inT as number[]))) return false;
    const last = db
      .prepare("SELECT cmd_hash FROM jobs WHERE key = ? AND status = 'done' AND id != ? ORDER BY id DESC LIMIT 1")
      .get(j.key, j.id) as Rec | undefined;
    return !last || last.cmd_hash === j.cmd_hash;
  }

  /** Is pid still our job's process group leader? (after a restart the pid may belong to something else) */
  const ours = (pid: number) => {
    try {
      return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").some((a) => a === lockFile || a === "-c");
    } catch {
      return false;
    }
  };
  /** Stop a running job's process group; its exit handler leaves the status set here alone. */
  function stop(j: Rec, status: "cancelled" | "superseded" | "queued" | "held", message: string) {
    const back = status === "queued" || status === "held"; // stays in the queue
    set(j.id, { status, message, ...(back ? { started: null, pid: null } : { finished: o.now() }) });
    if (j.pid && (procs.has(j.id) || ours(j.pid)))
      try {
        process.kill(-j.pid, "SIGTERM");
      } catch {}
  }

  /** Cancel queued and running jobs with this key (or key prefix), except `keep`; returns how many. */
  function invalidate(where: string, arg: string | number, status: "cancelled" | "superseded", message: string, keep = 0) {
    const rows = db
      .prepare(`SELECT * FROM jobs WHERE ${where} AND status IN ('queued', 'running', 'held') AND id != ?`)
      .all(arg, keep) as Rec[];
    for (const j of rows) {
      if (j.status === "running") stop(j, status, message);
      else set(j.id, { status, message, finished: o.now() });
    }
    return rows.length;
  }

  function enqueue(spec: JobSpec) {
    const steps = spec.steps;
    if (!spec.key || typeof spec.key !== "string") throw new Error("key required");
    if (!Array.isArray(steps) || !steps.length || !steps.every((s) => Array.isArray(s) && s.length && s.every((a) => typeof a === "string")))
      throw new Error("steps must be a non-empty list of argv lists");
    const r = db
      .prepare(
        `INSERT INTO jobs (key, label, steps, cmd_hash, priority, status, grp, sid, feedback_id, inputs, outputs, gpu, created)
         VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        spec.key,
        spec.label || spec.key,
        JSON.stringify(steps),
        crypto.createHash("sha1").update(JSON.stringify(steps)).digest("hex"),
        Number(spec.priority) || 0,
        spec.group || null,
        spec.sid || null,
        spec.feedback_id || null,
        JSON.stringify(spec.inputs || []),
        JSON.stringify(spec.outputs || []),
        spec.gpu === false ? 0 : 1,
        o.now(),
      );
    const id = Number(r.lastInsertRowid);
    version++;
    invalidate("key = ?", spec.key, "superseded", `superseded by #${id}`, id);
    const j = get(id)!;
    if (upToDate(j)) set(id, { status: "skipped", message: "up to date", finished: o.now() });
    pump();
    return view(get(id)!);
  }

  type By = { id?: number; key?: string; prefix?: string };
  const match = (by: By): [string, string | number] => {
    if (by.id != null) return ["id = ?", Number(by.id)];
    if (by.key) return ["key = ?", by.key];
    if (by.prefix) return ["substr(key, 1, length(?1)) = ?1", by.prefix];
    throw new Error("id, key or prefix required");
  };

  /** Hold jobs (queued or running: a running one is stopped) or release held ones; returns how many changed. */
  function hold(by: By, on: boolean) {
    const [where, arg] = match(by);
    const rows = db
      .prepare(`SELECT * FROM jobs WHERE ${where} AND status IN (${on ? "'queued', 'running'" : "'held'"})`)
      .all(arg) as Rec[];
    for (const j of rows) {
      if (!on) set(j.id, { status: "queued", message: null });
      else if (j.status === "running") stop(j, "held", "on hold");
      else set(j.id, { status: "held", message: "on hold" });
    }
    pump();
    return rows.length;
  }

  /** Ids of the notes any job was ever started for: such a note is taken up, whatever became of its job. */
  const feedbackIds = () =>
    new Set(
      (db.prepare("SELECT DISTINCT feedback_id FROM jobs WHERE feedback_id IS NOT NULL").all() as Rec[]).map(
        (r) => r.feedback_id as string,
      ),
    );

  function cancel(by: By) {
    if (by.id != null && get(Number(by.id))?.status === "failed") {
      set(Number(by.id), { status: "dismissed" }); // a failed job leaves the list
      return 1;
    }
    if (by.id != null) return invalidate("id = ?", Number(by.id), "cancelled", "cancelled");
    if (by.key) return invalidate("key = ?", by.key, "cancelled", "cancelled");
    if (by.prefix) return invalidate("substr(key, 1, length(?1)) = ?1", by.prefix, "cancelled", "cancelled");
    throw new Error("id, key or prefix required");
  }

  function retry(id: number) {
    const j = get(id);
    if (!j) throw new Error(`no job #${id}`);
    return enqueue({
      key: j.key,
      steps: JSON.parse(j.steps),
      label: j.label,
      priority: j.priority,
      group: j.grp,
      sid: j.sid,
      feedback_id: j.feedback_id,
      inputs: JSON.parse(j.inputs),
      outputs: JSON.parse(j.outputs),
      gpu: !!j.gpu,
    });
  }

  function start(j: Rec) {
    fs.mkdirSync(logDir, { recursive: true });
    const steps = (JSON.parse(j.steps) as string[][]).map((s) => s.map(sh).join(" "));
    const script = steps.length === 1 ? steps[0] : `rc=0; ${steps.map((s) => `${s} || rc=$?;`).join(" ")} exit $rc`;
    const argv = j.gpu ? ["flock", lockFile, "bash", "-c", script] : ["bash", "-c", script];
    const log = fs.openSync(path.join(logDir, `${j.id}.log`), "w");
    const p = spawn(argv[0], argv.slice(1), { cwd: o.root, detached: true, stdio: ["ignore", log, log] });
    fs.closeSync(log);
    procs.set(j.id, p);
    set(j.id, { status: "running", started: o.now(), pid: p.pid ?? null, message: null });
    const finish = (code: number | null, err?: Error) => {
      if (!procs.delete(j.id)) return;
      const cur = get(j.id);
      if (cur?.status === "running") {
        const ok = code === 0;
        set(j.id, {
          status: ok ? "done" : "failed",
          finished: o.now(),
          exit_code: code,
          message: ok ? null : err ? String(err) : `exit ${code}`,
        });
      }
      pump();
    };
    p.on("error", (e) => finish(null, e));
    p.on("exit", (code) => finish(code));
  }

  const paused = () =>
    (db.prepare("SELECT value FROM queue_settings WHERE name = 'paused'").get() as Rec | undefined)?.value === "1";
  function setPaused(on: boolean) {
    db.prepare("INSERT INTO queue_settings (name, value) VALUES ('paused', ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value").run(on ? "1" : "0");
    version++;
    if (on)
      for (const id of [...procs.keys()]) {
        const j = get(id);
        if (j?.status === "running") {
          stop(j, "queued", "queued again: the queue was paused");
        }
      }
    else pump();
    return { paused: on };
  }

  function pump() {
    while (!paused() && procs.size < o.slots) {
      const j = db
        .prepare("SELECT * FROM jobs WHERE status = 'queued' ORDER BY priority DESC, id LIMIT 1")
        .get() as Rec | undefined;
      if (!j) return;
      if (upToDate(j)) {
        set(j.id, { status: "skipped", message: "up to date", finished: o.now() });
      } else start(j);
    }
  }

  /** Jobs left running by a previous server: stop what is still alive and queue them again. */
  function recover() {
    for (const j of db.prepare("SELECT * FROM jobs WHERE status = 'running'").all() as Rec[]) {
      stop(j, "queued", "queued again after a server restart");
    }
  }

  /** On shutdown: stop running jobs and leave them queued for the next start. */
  function shutdown() {
    for (const id of [...procs.keys()]) {
      const j = get(id);
      procs.delete(id);
      if (j?.status === "running") stop(j, "queued", "queued again after a server restart");
    }
  }

  function list(all = false) {
    const rows = db
      .prepare(
        all
          ? "SELECT * FROM jobs ORDER BY id DESC LIMIT 500"
          : `SELECT * FROM jobs j WHERE status IN ('queued', 'running', 'held')
               OR (status = 'failed' AND NOT EXISTS (SELECT 1 FROM jobs k WHERE k.key = j.key AND k.id > j.id))
             ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 WHEN 'held' THEN 2 ELSE 3 END, priority DESC, id`,
      )
      .all() as Rec[];
    return rows.map(view);
  }

  recover();
  return {
    enqueue,
    cancel,
    retry,
    pump,
    shutdown,
    list,
    get: (id: number) => {
      const j = get(id);
      return j && view(j);
    },
    sig: () => String(version),
    paused,
    setPaused,
    hold,
    feedbackIds,
  };
}
