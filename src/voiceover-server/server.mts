// Voice-line review server: serves index.html, audio takes (with HTTP Range), a JSON API and a Server-Sent Events
// stream of file changes. It also acts on mechanical feedback by itself (picks, unpicks, comment-less text edits);
// records with a hand-written comment are left for an agent (see /api/pending).
// Usage: node src/voiceover-server/server.mts [port]   (env VOICEOVER_ROOT = voice workspace, REVIEW_PORT = port)
import "../ensure-env.mts";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(process.env.VOICEOVER_ROOT || "");
if (!process.env.VOICEOVER_ROOT || !fs.existsSync(path.join(ROOT, "higgs"))) {
  throw new Error(
    "Set VOICEOVER_ROOT (in .env) to the voice workspace: the folder holding higgs/ and review/.",
  );
}
const REVIEW = path.join(ROOT, "review");
const HIGGS = path.join(ROOT, "higgs");
const TEST = path.join(ROOT, "higgs_test");
const FEEDBACK = path.join(REVIEW, "feedback.jsonl");
const EVENTS = path.join(REVIEW, "agent_events.jsonl");
const JOBS = path.join(REVIEW, "jobs");
const RUNLOG = path.join(HIGGS, "run.log");
const INDEX = path.join(import.meta.dirname, "index.html");
const PORT = Number(process.argv[2] || process.env.REVIEW_PORT || 8765);
const STATUSES = new Set(["seen", "queued", "working", "regenerated", "done", "question"]);

type Rec = Record<string, any>;

// ---- files ----

/** JSON with Python's separators, so the .jsonl files keep one format whoever writes them. */
function dumps(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(dumps).join(", ") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => JSON.stringify(k) + ": " + dumps(x))
        .join(", ") +
      "}"
    );
  return JSON.stringify(v ?? null);
}

function loadJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) ?? fallback;
  } catch {
    return fallback;
  }
}

function readJsonl(p: string): Rec[] {
  let text = "";
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    return [];
  }
  const out: Rec[] = [];
  for (const ln of text.split("\n")) {
    if (!ln.trim()) continue;
    try {
      out.push(JSON.parse(ln));
    } catch {}
  }
  return out;
}

const appendJsonl = (p: string, obj: Rec) => fs.appendFileSync(p, dumps(obj) + "\n", "utf8");

function now() {
  const d = new Date(),
    z = -d.getTimezoneOffset(),
    p = (n: number) => String(Math.abs(n)).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${z < 0 ? "-" : "+"}${p(Math.trunc(z / 60))}${p(z % 60)}`
  );
}
const today = () => now().slice(0, 10);

const statNs = (p: string) => fs.statSync(p, { bigint: true });
const isDir = (p: string) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const isFile = (p: string) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};
const listDir = (d: string) => {
  try {
    return fs.readdirSync(d);
  } catch {
    return [];
  }
};
const rel = (p: string) => path.relative(ROOT, p);

const cache = new Map<string, unknown>();
function cached<T>(p: string, kind: string, fn: (p: string) => T): T | null {
  let st;
  try {
    st = statNs(p);
  } catch {
    return null;
  }
  const key = `${p}\0${kind}\0${st.mtimeNs}\0${st.size}`;
  if (!cache.has(key)) {
    try {
      cache.set(key, fn(p));
    } catch {
      cache.set(key, null);
    }
  }
  return cache.get(key) as T;
}

/** Duration in seconds from the RIFF header: data bytes / (rate * channels * bytes per sample). */
function wavDur(p: string) {
  const fd = fs.openSync(p, "r");
  try {
    const size = fs.fstatSync(fd).size,
      hdr = Buffer.alloc(8);
    let off = 12,
      rate = 0,
      align = 0;
    while (off + 8 <= size) {
      fs.readSync(fd, hdr, 0, 8, off);
      const id = hdr.toString("latin1", 0, 4),
        len = hdr.readUInt32LE(4);
      if (id === "fmt ") {
        const fmt = Buffer.alloc(16);
        fs.readSync(fd, fmt, 0, 16, off + 8);
        rate = fmt.readUInt32LE(4);
        align = fmt.readUInt16LE(12);
      } else if (id === "data") {
        const bytes = Math.min(len, size - off - 8);
        return Math.round((Math.floor(bytes / align) / rate) * 100) / 100;
      }
      off += 8 + len + (len & 1);
    }
    throw new Error("no data chunk");
  } finally {
    fs.closeSync(fd);
  }
}

const md5 = (p: string) => crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex");

// ---- groups ----

function take(p: string, label?: string, finalHash?: string | null) {
  const st = statNs(p);
  const t: Rec = {
    file: path.basename(p),
    url: "/audio/" + rel(p) + "?v=" + st.mtimeNs,
    dur: cached(p, "dur", wavDur),
    mtime: Number(st.mtimeNs) / 1e9,
    label: label || path.basename(p).slice(0, -4),
  };
  if (finalHash && cached(p, "md5", md5) === finalHash) t.final = true;
  const side = p.slice(0, -4) + ".txt"; // A/B alternative: sidecar with the exact (tagged) text used
  if (fs.existsSync(side))
    t.alt_text = cached(side, "txt", (s) => fs.readFileSync(s, "utf8").trim());
  return t;
}

const wavs = (d: string) =>
  listDir(d)
    .filter((f) => f.endsWith(".wav") && isFile(path.join(d, f)))
    .sort()
    .map((f) => path.join(d, f));

/** higgs/<name>.json, else the longest <prefix>.json (volk_uk_stopped -> volk_uk.json). */
function scriptFor(name: string): [string | null, Rec] {
  let best: string | null = null;
  for (const f of listDir(HIGGS)) {
    if (
      f.endsWith(".json") &&
      (name === f.slice(0, -5) || name.startsWith(f.slice(0, -5) + "_")) &&
      (!best || f.length > best.length)
    )
      best = f;
  }
  return best ? [best, loadJson(path.join(HIGGS, best), {})] : [null, {}];
}

function batchGroup(name: string) {
  const d = path.join(HIGGS, name);
  const [scriptName, script] = scriptFor(name);
  const key = (n: number, sid: string) => `${n}\0${sid}`;
  const log = new Map<string, Rec>(
    (loadJson<Rec[]>(path.join(d, "log.json"), []) || []).map((e) => [key(e.n, e.sid), e]),
  );
  const lines = new Map<string, Rec>(
    (script.lines || []).map((l: Rec) => [key(l.n, l.sid), { ...l }]),
  );
  const dirs = new Map<string, string>();
  for (const f of listDir(d)) {
    const m = /^(\d+)_(.+)$/.exec(f);
    if (m && isDir(path.join(d, f))) {
      const k = key(Number(m[1]), m[2]);
      dirs.set(k, path.join(d, f));
      if (!lines.has(k)) lines.set(k, { ...log.get(k), n: Number(m[1]), sid: m[2] });
    }
  }
  const sorted = [...lines.values()].sort(
    (a, b) => a.n - b.n || (a.sid < b.sid ? -1 : a.sid > b.sid ? 1 : 0),
  );
  const out = sorted.map((l) => {
    const k = key(l.n, l.sid);
    const fin = path.join(HIGGS, "final", name, `${String(l.n).padStart(2, "0")}_${l.sid}.wav`);
    const fh = fs.existsSync(fin) ? cached(fin, "md5", md5) : null;
    const takes = wavs(dirs.get(k) || "").map((p) => take(p, undefined, fh));
    if (fh && !takes.some((t) => t.final)) takes.push({ ...take(fin, "final"), final: true });
    const lg = log.get(k);
    return {
      n: l.n,
      sid: l.sid,
      speaker: l.speaker || "",
      text: l.text || "",
      expected: lg ? (lg.expected ?? null) : null,
      tries: lg ? (lg.tries ?? null) : null,
      takes,
    };
  });
  return {
    id: "batch:" + name,
    kind: "batch",
    name,
    script: scriptName,
    dir: rel(d),
    lines: out,
    total: (script.lines || []).length,
  };
}

function testGroup(name: string) {
  const spec = loadJson<Rec>(path.join(TEST, name + ".json"), {});
  const out: Rec[] = [];
  for (const v of spec.variants || []) {
    let vd = path.join(TEST, name, v.name);
    if (!isDir(vd) && v.name === name) vd = path.join(TEST, name);
    (v.lines || []).forEach((l: Rec, i: number) => {
      const ws = wavs(vd).filter((p) =>
        path.basename(p).startsWith(String(i).padStart(2, "0") + "_"),
      );
      out.push({
        n: i,
        sid: v.name + (v.lines.length > 1 ? "#" + i : ""),
        speaker: l.speaker || "",
        text: l.text || "",
        seed: l.seed ?? null,
        takes: ws.map((p) => take(p)),
      });
    });
  }
  return {
    id: "test:" + name,
    kind: "test",
    name,
    script: `higgs_test/${name}.json`,
    dir: "higgs_test/" + name,
    lines: out,
    total: out.length,
  };
}

function deciderGroup() {
  const lines = wavs(path.join(HIGGS, "decider")).map((p, i) => ({
    n: i,
    sid: path.basename(p).slice(0, -4),
    speaker: "",
    text: "",
    takes: [take(p)],
  }));
  return {
    id: "decider",
    kind: "approved",
    name: "decider (approved)",
    dir: "higgs/decider",
    lines,
    total: lines.length,
  };
}

function groupIds() {
  const ids = new Set<string>();
  for (const f of listDir(HIGGS)) {
    if (isDir(path.join(HIGGS, f)) && f !== "final" && f !== "decider") ids.add("batch:" + f);
    else if (f.endsWith(".json")) ids.add("batch:" + f.slice(0, -5));
  }
  if (isDir(path.join(HIGGS, "decider"))) ids.add("decider");
  for (const f of listDir(TEST)) if (f.endsWith(".json")) ids.add("test:" + f.slice(0, -5));
  return [...ids].sort();
}

function buildGroup(gid: string) {
  const [kind, name] = splitGid(gid);
  return kind === "batch" ? batchGroup(name) : kind === "test" ? testGroup(name) : deciderGroup();
}
const splitGid = (gid: string): [string, string] => {
  const i = gid.indexOf(":");
  return i < 0 ? [gid, ""] : [gid.slice(0, i), gid.slice(i + 1)];
};

/** Max mtime (ns) + entry count of a set of paths, recursive for dirs. */
function treeSig(paths: string[]): [bigint, number] {
  let m = 0n,
    n = 0;
  const stack = [...paths];
  while (stack.length) {
    const p = stack.pop()!;
    let st;
    try {
      st = statNs(p);
    } catch {
      continue;
    }
    if (st.mtimeNs > m) m = st.mtimeNs;
    n++;
    if (st.isDirectory()) stack.push(...listDir(p).map((f) => path.join(p, f)));
  }
  return [m, n];
}

function groupPaths(gid: string) {
  const [kind, name] = splitGid(gid);
  if (kind === "batch") {
    const sn = scriptFor(name)[0];
    return [
      path.join(HIGGS, name),
      path.join(HIGGS, "final", name),
      ...(sn ? [path.join(HIGGS, sn)] : []),
    ];
  }
  if (kind === "test") return [path.join(TEST, name), path.join(TEST, name + ".json")];
  return [path.join(HIGGS, "decider")];
}

function runStatus() {
  let lines: string[], mtime: number;
  try {
    lines = fs.readFileSync(RUNLOG, "utf8").split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    mtime = fs.statSync(RUNLOG).mtimeMs / 1000;
  } catch {
    return { tail: [], progress: null };
  }
  let since: string[] = [];
  for (const ln of lines) since = ln.startsWith("done:") ? [] : [...since, ln];
  let prog = null;
  const m = since.length ? /^(\d+) (\S+) /.exec(since.at(-1)!) : null;
  if (m) {
    // current batch: newest batch dir that holds this NN_sid
    const sub = `${m[1]}_${m[2]}`;
    const cands = listDir(HIGGS).filter(
      (f) => isDir(path.join(HIGGS, f)) && isDir(path.join(HIGGS, f, sub)),
    );
    if (cands.length) {
      const age = (b: string) => fs.statSync(path.join(HIGGS, b, sub)).mtimeMs;
      const b = cands.reduce((x, y) => (age(y) > age(x) ? y : x));
      prog = {
        batch: b,
        done: since.filter((s) => /^\d+ /.test(s)).length,
        total: (scriptFor(b)[1].lines || []).length,
      };
    }
  }
  return {
    tail: lines.slice(-20),
    progress: prog,
    mtime,
    finished: lines.length > 0 && lines.at(-1)!.startsWith("done:"),
  };
}

// ---- feedback state ----

/** Latest agent event per feedback item (by feedback_id, or by group+sid for later events without id). */
function statuses(fb: Rec[], ev: Rec[]) {
  for (const f of fb) {
    f.latest = null;
    for (const e of ev) {
      if (
        e.feedback_id === f.id ||
        (!e.feedback_id && e.group === f.group && e.sid === f.sid && (e.ts || "") >= (f.ts || ""))
      )
        f.latest = e;
    }
    if (f.latest) f.status = f.latest.status ?? f.status;
  }
  return fb;
}

/** Per group|sid: pending-redo state. redo/apply_text feedback or seen/queued -> queued, working -> working,
 * regenerated/done/question -> done (a question waits on the user, no job runs). */
function lineStates(fb: Rec[], ev: Rec[]) {
  const byId = new Map(fb.map((f) => [f.id, f]));
  type Item = [string, string, string, string | null, string, string];
  const items: Item[] = fb
    .filter((f) => f.verdict === "redo" || f.verdict === "apply_text")
    .map((f) => [
      f.ts || "",
      f.group,
      f.sid,
      "queued",
      f.comment || f.verdict,
      "feedback " + f.verdict,
    ]);
  const map: Rec = {
    seen: "queued",
    queued: "queued",
    working: "working",
    regenerated: "done",
    done: "done",
    question: "done",
  };
  for (const e of ev) {
    const f = byId.get(e.feedback_id) || {};
    const g = e.group || f.group,
      sid = e.sid || f.sid;
    if (g && sid)
      items.push([e.ts || "", g, sid, map[e.status] ?? null, e.message || "", e.status]);
  }
  items.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const out: Rec = {};
  for (const [ts, g, sid, st, msg, raw] of items) {
    const cur = (out[g + "|" + sid] ??= { state: null });
    if (st) cur.state = st;
    Object.assign(cur, { ts, message: `${raw}: ${msg}` });
  }
  return out;
}

/** Line jobs (scripts/line_job.sh, alt_jobs.sh) still alive: running (latest event for the sid is 'working') or queued on the GPU lock. */
function jobs() {
  const last = new Map<string, Rec>();
  for (const e of readJsonl(EVENTS)) if (e.sid) last.set(e.sid, e);
  const out: Rec[] = [];
  for (const f of listDir(JOBS)
    .filter((f) => f.endsWith(".pid"))
    .sort()) {
    const sid = f.slice(0, -4);
    let pid: number;
    try {
      pid = parseInt(fs.readFileSync(path.join(JOBS, f), "utf8").trim(), 10);
      process.kill(pid, 0);
    } catch {
      continue;
    }
    let args: string[] = [];
    try {
      args = fs.readFileSync(`/proc/${pid}/cmdline`).toString("utf8").split("\0");
    } catch {}
    const i = args.indexOf("_"); // bash -c '...' _ <batch> <sid> <text> ...
    const [batch, text] = i >= 0 && args.length > i + 3 ? [args[i + 1], args[i + 3]] : ["", ""];
    const e = last.get(sid) || {},
      running = e.status === "working";
    const group = running || !batch ? e.group : `batch:${batch}`; // a queued job's batch is in its args
    out.push({
      sid,
      group: group || "",
      status: running ? "working" : "queued",
      ts: running ? e.ts || "" : "",
      feedback_id: running ? e.feedback_id || "" : "",
      message: running ? e.message || "" : text,
    });
  }
  return out.sort((a, b) => Number(a.status !== "working") - Number(b.status !== "working"));
}

/** Move a take (and its alt-*.txt sidecar) to archive/deleted/<date>/<same path>. Final copies can't be deleted here. */
function deleteTake(relPath: string): [Rec, number] {
  let p: string;
  try {
    p = fs.realpathSync(path.join(ROOT, decodeURIComponent(relPath)));
  } catch {
    return [{ error: "not a deletable take" }, 400];
  }
  if (
    ![HIGGS, TEST].some((b) => p.startsWith(b + path.sep)) ||
    p.startsWith(path.join(HIGGS, "final") + path.sep) ||
    !p.endsWith(".wav") ||
    !isFile(p)
  )
    return [{ error: "not a deletable take" }, 400];
  const dst = path.join(ROOT, "archive", "deleted", today(), rel(p));
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  for (const src of [p, p.slice(0, -4) + ".txt"])
    if (fs.existsSync(src)) moveFile(src, dst.slice(0, -4) + src.slice(-4));
  return [{ deleted: rel(p), moved_to: rel(dst) }, 200];
}

function moveFile(src: string, dst: string) {
  try {
    fs.renameSync(src, dst);
  } catch {
    fs.copyFileSync(src, dst); // across filesystems
    fs.unlinkSync(src);
  }
}

// ---- actions the server takes by itself ----

const AUTO_FINAL = new Set(["good", "pick", "unpick"]);
const SERVER_MESSAGES = ["Final:", "Unpicked:", "Queued: regenerating"];

/** What the server does with a feedback record: 'final', 'redo' or null (left for an agent).
 * Picks/unpicks of batch lines copy files; an edited text with no comment regenerates the line. */
function autoKind(rec: Rec): "final" | "redo" | null {
  if (!String(rec.group || "").startsWith("batch:")) return null;
  if (AUTO_FINAL.has(rec.verdict)) return "final";
  if (rec.verdict === "apply_text" && rec.suggested_text && !String(rec.comment || "").trim())
    return "redo";
  return null;
}

/** Records an agent still has to handle: no event yet and not the server's job, or a comment no agent event answers
 * (a pick with a comment is finalized here and still needs new audio for the comment). */
function pending() {
  const events = readJsonl(EVENTS);
  const ev = new Set(events.filter((e) => e.feedback_id).map((e) => e.feedback_id));
  const agentEv = new Set(
    events
      .filter(
        (e) => e.feedback_id && !SERVER_MESSAGES.some((m) => String(e.message || "").startsWith(m)),
      )
      .map((e) => e.feedback_id),
  );
  return readJsonl(FEEDBACK).filter(
    (f) =>
      (!ev.has(f.id) && !autoKind(f)) || (String(f.comment || "").trim() && !agentEv.has(f.id)),
  );
}

const postEvent = (e: Rec) => appendJsonl(EVENTS, { ts: now(), ...e });
const lineDirs = (batch: string, sid: string) =>
  listDir(path.join(HIGGS, batch))
    .filter((f) => f.endsWith("_" + sid) && isDir(path.join(HIGGS, batch, f)))
    .map((f) => path.join(HIGGS, batch, f));

/** Copy picked takes into higgs/final/ (good: the line's s2024 take, or its only file), move unpicked finals to
 * archive/unfinal/, post a done event for each, then run scripts/backup_finals.sh if the workspace has one. */
function finalize() {
  const handled = new Set(
    readJsonl(EVENTS)
      .filter((e) => e.status === "done" || e.status === "regenerated")
      .map((e) => e.feedback_id),
  );
  let changed = false;
  for (const fb of readJsonl(FEEDBACK)) {
    if (handled.has(fb.id) || !AUTO_FINAL.has(fb.verdict) || !String(fb.group).startsWith("batch:"))
      continue;
    const batch = fb.group.slice(6),
      finalBatch = batch.replace(/_fix$/, ""); // pc_uk_fix redoes belong to pc_uk
    const done = (message: string) => {
      postEvent({ feedback_id: fb.id, group: fb.group, sid: fb.sid, status: "done", message });
      changed = true;
    };
    if (fb.verdict === "unpick") {
      const finDir = path.join(HIGGS, "final", finalBatch);
      const fins = listDir(finDir)
        .filter((f) => f.endsWith(`_${fb.sid}.wav`))
        .sort()
        .map((f) => path.join(finDir, f));
      const src = fb.take
        ? lineDirs(finalBatch, fb.sid)
            .map((d) => path.join(d, fb.take))
            .filter(isFile)
        : [];
      if (fins.length && (!src.length || md5(fins[0]) === md5(src[0]))) {
        const dst = path.join(ROOT, "archive", "unfinal", today(), rel(fins[0]));
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        moveFile(fins[0], dst);
        done(`Unpicked: ${rel(fins[0])} -> ${rel(dst)}`);
      } else
        done(
          fins.length
            ? `Unpicked ${fb.take}, but finals hold a different take; left ${rel(fins[0])}`
            : "Unpicked: nothing in finals",
        );
      continue;
    }
    const dirs = lineDirs(batch, fb.sid);
    if (dirs.length !== 1) continue; // no line dir: nothing to copy
    const takes = listDir(dirs[0]).sort();
    const tk =
      fb.take || (takes.includes("s2024.wav") ? "s2024.wav" : takes.length === 1 ? takes[0] : null);
    if (!tk || !takes.includes(tk)) continue; // which take? left for an agent
    fs.mkdirSync(path.join(HIGGS, "final", finalBatch), { recursive: true });
    const dst = path.join(HIGGS, "final", finalBatch, path.basename(dirs[0]) + ".wav");
    fs.copyFileSync(path.join(dirs[0], tk), dst);
    const side = path.join(dirs[0], tk.slice(0, -4) + ".txt"); // an A/B alternative carries its own text: make it the line's script text
    if (fs.existsSync(side)) {
      const text = fs.readFileSync(side, "utf8").trim();
      for (const js of new Set([
        path.join(HIGGS, batch + ".json"),
        path.join(HIGGS, finalBatch + ".json"),
      ])) {
        if (!fs.existsSync(js)) continue;
        const sc = JSON.parse(fs.readFileSync(js, "utf8"));
        for (const l of sc.lines) if (l.sid === fb.sid) l.text = text;
        fs.writeFileSync(js, JSON.stringify(sc, null, 1));
      }
    }
    done(`Final: ${tk} -> ${rel(dst)}`);
  }
  return changed;
}

/** Run a workspace script, resolving when it exits (output discarded). */
function runScript(file: string, args: string[] = []) {
  return new Promise<void>((resolve) => {
    const p = spawn(file, args, {
      cwd: ROOT,
      env: { ...process.env, REVIEW_PORT: String(PORT) },
      stdio: "ignore",
    });
    p.on("error", () => resolve());
    p.on("exit", () => resolve());
  });
}

let autoChain = Promise.resolve(); // one action at a time: finalize scans all feedback
function runAuto(rec: Rec) {
  autoChain = autoChain.then(async () => {
    try {
      const kind = autoKind(rec);
      if (kind === "final") {
        const backup = path.join(ROOT, "scripts", "backup_finals.sh");
        if (finalize() && fs.existsSync(backup)) await runScript(backup); // mirror finals into the mod folder
      } else if (kind === "redo") {
        const script = path.join(ROOT, "scripts", "line_job.sh");
        if (!fs.existsSync(script)) return;
        postEvent({
          feedback_id: rec.id,
          group: rec.group,
          sid: rec.sid,
          status: "queued",
          message: "Queued: regenerating with the edited text",
        });
        await runScript(script, [rec.sid, rec.group.slice(6), rec.sid, rec.suggested_text, rec.id]);
      }
    } catch (e) {
      console.error(`auto action failed for ${rec.id}:`, e);
    }
  });
}

// ---- change watcher -> SSE ----

const clients = new Set<http.ServerResponse>();
let sigs = new Map<string, string>();

function snapshot() {
  const s = new Map<string, string>();
  for (const gid of groupIds()) s.set(gid, treeSig(groupPaths(gid)).join(","));
  for (const [k, p] of [
    ["feedback", FEEDBACK],
    ["events", EVENTS],
    ["jobs", JOBS],
    ["run", RUNLOG],
    ["page", INDEX],
  ])
    s.set(k, treeSig([p]).join(","));
  return s;
}

function watch() {
  let next: Map<string, string>;
  try {
    next = snapshot();
  } catch (e) {
    console.error("watch error:", e);
    return;
  }
  const changed = [...new Set([...next.keys(), ...sigs.keys()])]
    .filter((k) => next.get(k) !== sigs.get(k))
    .sort();
  sigs = next;
  if (!changed.length) return;
  const msg = `event: change\ndata: ${dumps({ changed, ts: now() })}\n\n`;
  for (const c of clients) c.write(msg);
}

// ---- HTTP ----

function sendJson(res: http.ServerResponse, obj: unknown, code = 200) {
  const body = Buffer.from(dumps(obj));
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendAudio(req: http.IncomingMessage, res: http.ServerResponse, relPath: string) {
  let p = "";
  try {
    p = fs.realpathSync(path.join(ROOT, relPath));
  } catch {}
  if (
    !p ||
    ![HIGGS, TEST].some((b) => p.startsWith(b + path.sep)) ||
    !p.endsWith(".wav") ||
    !isFile(p)
  )
    return sendJson(res, { error: "forbidden or missing" }, 404);
  const size = fs.statSync(p).size;
  let start = 0,
    end = size - 1,
    code = 200;
  const headers: Record<string, string | number> = {
    "Content-Type": "audio/wav",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
  if (m && (m[1] || m[2])) {
    if (m[1]) [start, end] = [Number(m[1]), Math.min(m[2] ? Number(m[2]) : end, end)];
    else start = Math.max(0, size - Number(m[2]));
    if (start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${size}`, "Content-Length": 0 });
      return res.end();
    }
    code = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = end - start + 1;
  res.writeHead(code, headers);
  fs.createReadStream(p, { start, end }).pipe(res);
}

function stream(res: http.ServerResponse) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store" });
  res.write("retry: 2000\n\n");
  clients.add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  res.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

function handleGet(req: http.IncomingMessage, res: http.ServerResponse, u: URL) {
  const q = u.searchParams;
  switch (u.pathname) {
    case "/":
    case "/index.html": {
      const body = fs.readFileSync(INDEX);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": body.length,
        "Cache-Control": "no-store",
      });
      return res.end(body);
    }
    case "/api/groups": {
      const valid = new Set(groupIds());
      const ids = q.has("ids") ? q.get("ids")!.split(",") : [...valid];
      return sendJson(
        res,
        ids
          .filter((g) => valid.has(g))
          .map((g) => ({ ...buildGroup(g), activity: Number(treeSig(groupPaths(g))[0]) / 1e9 })),
      );
    }
    case "/api/feedback":
      return sendJson(res, statuses(readJsonl(FEEDBACK), readJsonl(EVENTS)));
    case "/api/pending":
      return sendJson(res, pending());
    case "/api/linestatus":
      return sendJson(res, lineStates(readJsonl(FEEDBACK), readJsonl(EVENTS)));
    case "/api/events":
      return sendJson(res, readJsonl(EVENTS).slice(-Number(q.get("n") || 30)));
    case "/api/jobs":
      return sendJson(res, jobs());
    case "/api/run":
      return sendJson(res, runStatus());
    case "/api/stream":
      return stream(res);
  }
  if (u.pathname.startsWith("/audio/"))
    return sendAudio(req, res, decodeURIComponent(u.pathname.slice(7)));
  sendJson(res, { error: "not found" }, 404);
}

function handlePost(res: http.ServerResponse, u: URL, data: Rec) {
  if (u.pathname === "/api/feedback") {
    if (!data.group || !data.sid || !data.verdict)
      return sendJson(res, { error: "group, sid, verdict required" }, 400);
    const rec = {
      id: crypto.randomUUID().replace(/-/g, "").slice(0, 10),
      ts: now(),
      group: data.group,
      n: data.n ?? null,
      sid: data.sid,
      take: data.take || null,
      verdict: data.verdict,
      comment: data.comment ?? "",
      suggested_text: data.suggested_text || null,
      status: "new",
    };
    appendJsonl(FEEDBACK, rec);
    if (autoKind(rec)) runAuto(rec);
    return sendJson(res, rec);
  }
  if (u.pathname === "/api/delete") return sendJson(res, ...deleteTake(data.path || ""));
  if (u.pathname === "/api/event") {
    if (!STATUSES.has(data.status))
      return sendJson(res, { error: `status must be one of ${dumps([...STATUSES].sort())}` }, 400);
    const rec: Rec = { ts: now() };
    for (const k of ["feedback_id", "group", "sid", "status", "message"])
      if (k in data) rec[k] = data[k];
    appendJsonl(EVENTS, rec);
    return sendJson(res, rec);
  }
  sendJson(res, { error: "not found" }, 404);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || "/", "http://localhost");
  res.on("error", () => {});
  try {
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        let data: Rec;
        try {
          data = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        } catch {
          return sendJson(res, { error: "bad json" }, 400);
        }
        try {
          handlePost(res, u, data);
        } catch (e) {
          console.error(e);
          if (!res.headersSent) sendJson(res, { error: String(e) }, 500);
        }
      });
    } else handleGet(req, res, u);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) sendJson(res, { error: String(e) }, 500);
  }
});

sigs = snapshot();
setInterval(watch, 1000);
setTimeout(() => runAuto({ group: "batch:", verdict: "pick" }), 1000); // picks made while the server was down
server.listen(PORT, "127.0.0.1", () =>
  console.log(`Voice review: http://127.0.0.1:${PORT}/  (pid ${process.pid}, Ctrl+C to stop)`),
);
