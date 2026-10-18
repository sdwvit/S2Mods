// Integration tests for the voiceover review site: the real server.mts + index.html, run against a throwaway
// workspace, with the page loaded in jsdom. Run: pnpm vitest run src/voiceover-server
import { test, beforeEach, afterEach, vi } from "vitest";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const DIR = path.dirname(fileURLToPath(import.meta.url));
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });
const SID_A = "Test_Line_A",
  SID_B = "Test_Line_B",
  SID_C = "Test_Line_C";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, what, ms = 5000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error("timed out waiting for " + what);
    await sleep(50);
  }
}
const freePort = () =>
  new Promise((res) => {
    const s = net.createServer().listen(0, () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });

// one second of 24 kHz 16-bit mono silence
function writeWav(p) {
  const data = 48000,
    b = Buffer.alloc(44 + data);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(36 + data, 4);
  b.write("WAVEfmt ", 8, "latin1");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36, "latin1");
  b.writeUInt32LE(data, 40);
  fs.writeFileSync(p, b);
}

// workspace: review/ (feedback files), higgs/test_uk.json, two lines with takes
function makeWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "review-test-"));
  fs.mkdirSync(path.join(ws, "review"));
  fs.mkdirSync(path.join(ws, "higgs_test")); // the server scans it for test:* groups
  const batch = path.join(ws, "higgs", "test_uk");
  const a = path.join(batch, "01_" + SID_A),
    b = path.join(batch, "02_" + SID_B);
  fs.mkdirSync(a, { recursive: true });
  fs.mkdirSync(b, { recursive: true });
  for (const p of [path.join(a, "s2024.wav"), path.join(a, "alt-x.wav"), path.join(b, "s2024.wav")])
    writeWav(p);
  fs.writeFileSync(path.join(a, "alt-x.txt"), "Перша лінія, інакше.\n");
  fs.writeFileSync(
    path.join(ws, "higgs", "test_uk.json"),
    JSON.stringify({
      refs: {},
      lines: [
        { n: 1, sid: SID_A, speaker: "volk", text: "Перша лінія." },
        { n: 2, sid: SID_B, speaker: "volk", text: "Друга лінія." },
      ],
    }),
  );
  // a second speaker's batch with one approved line (copy in finals, no feedback records)
  const c = path.join(ws, "higgs", "aa_uk", "01_" + SID_C);
  fs.mkdirSync(c, { recursive: true });
  fs.mkdirSync(path.join(ws, "higgs", "final", "aa_uk"), { recursive: true });
  fs.copyFileSync(path.join(b, "s2024.wav"), path.join(c, "approved.wav"));
  fs.copyFileSync(
    path.join(b, "s2024.wav"),
    path.join(ws, "higgs", "final", "aa_uk", "01_" + SID_C + ".wav"),
  );
  fs.writeFileSync(
    path.join(ws, "higgs", "aa_uk.json"),
    JSON.stringify({ refs: {}, lines: [{ n: 1, sid: SID_C, speaker: "pc", text: "Третя." }] }),
  );
  return ws;
}

class FakeEventSource {
  static last = null;
  constructor(url) {
    this.url = url;
    this.listeners = {};
    FakeEventSource.last = this;
  }
  addEventListener(t, f) {
    (this.listeners[t] ||= []).push(f);
  }
  close() {}
  emit(type, data) {
    for (const f of this.listeners[type] || []) f({ data: JSON.stringify(data) });
  }
}

let ws, server, base, dom, win, doc, navigations, beacons;

beforeEach(async () => {
  ws = makeWorkspace();
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(DIR, "server.mts"), String(port)], {
    stdio: "ignore",
    env: { ...process.env, VOICEOVER_ROOT: ws },
  });
  await waitFor(
    () =>
      fetch(base + "/api/run").then(
        (r) => r.ok,
        () => false,
      ),
    "server start",
  );

  navigations = [];
  beacons = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    if (/navigation/i.test(e.message)) navigations.push(Date.now());
    else console.error("jsdom:", e.message);
  });
  const html = await fetch(base + "/").then((r) => r.text());
  dom = new JSDOM(html, {
    url: base + "/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.__DELETE_SECS = 2;
      w.fetch = (u, o) => fetch(new URL(u, base), o);
      w.EventSource = FakeEventSource;
      w.alert = () => {};
      w.scrollTo = () => {};
      w.Element.prototype.scrollIntoView = () => {};
      w.CSS ||= {};
      w.CSS.escape ||= (s) => String(s).replace(/["\\]/g, "\\$&");
      w.navigator.sendBeacon = (u, body) => {
        beacons.push([u, body]);
        return true;
      };
      // no real playback in jsdom: pause()/play() just flip state and fire the events the page listens to
      const P = w.HTMLMediaElement.prototype;
      Object.defineProperty(P, "paused", {
        get() {
          return !this._playing;
        },
        configurable: true,
      });
      P.play = function () {
        this._playing = true;
        this.dispatchEvent(new w.Event("play"));
        return Promise.resolve();
      };
      P.pause = function () {
        const was = this._playing;
        this._playing = false;
        if (was !== false) this.dispatchEvent(new w.Event("pause"));
      };
    },
  });
  win = dom.window;
  doc = win.document;
  await waitFor(() => doc.querySelector(`.line[data-sid="${SID_A}"] .take`), "page render");
  await waitFor(() => win.eval("initialised"), "initial load finished");
});

afterEach(async () => {
  await sleep(400); // let the page finish its post-send refresh before the window goes away
  win?.close();
  server?.kill();
  await sleep(100);
  fs.rmSync(ws, { recursive: true, force: true });
});

const line = (sid) => doc.querySelector(`.line[data-sid="${sid}"]`);
const take = (sid, file) =>
  [...line(sid).querySelectorAll(".take")].find((t) => t.dataset.file === file);
const feedback = () => {
  try {
    return fs
      .readFileSync(path.join(ws, "review", "feedback.jsonl"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
  } catch {
    return [];
  }
};
const takeFile = (f) => path.join(ws, "higgs", "test_uk", "01_" + SID_A, f);
const refreshGroups = () => FakeEventSource.last.emit("change", { changed: ["batch:test_uk"] });

test("one list: all batches together, open lines first, approved lines hidden by default", () => {
  assert.equal(doc.querySelectorAll("details.group").length, 1);
  const order = [...doc.querySelectorAll(".line")].map((l) => l.dataset.sid);
  assert.deepEqual(order, [SID_A, SID_B, SID_C]); // aa_uk sorts first by name, but its line is approved
  assert.ok(line(SID_C).classList.contains("hasfinal"));
  assert.ok(doc.body.classList.contains("hidegood"), "approved lines hidden by default");
  const css = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("");
  assert.match(css, /body\.hidegood \.line:is\(\.good, \.hasfinal\)/);
});

test("line form has only the comment box and Apply", () => {
  const visible = [...line(SID_A).querySelector(".form").children].filter((c) => !c.hidden);
  assert.deepEqual(
    visible.map((c) => c.tagName + "." + c.className),
    ["TEXTAREA.cmt", "BUTTON.apply"],
  );
  assert.equal(line(SID_A).querySelector(".form select"), null);
});

test("delete waits for the countdown, then moves the file and the take disappears", async () => {
  const te = take(SID_A, "alt-x.wav");
  te.querySelector("button.del").click();
  assert.ok(te.classList.contains("deleting"));
  assert.match(te.querySelector("button.del").textContent, /restore 2/);
  await sleep(1200);
  assert.ok(fs.existsSync(takeFile("alt-x.wav")), "file must survive the first second");
  assert.ok(te.isConnected && !te.hidden, "take must stay on screen during the countdown");
  assert.match(te.querySelector("button.del").textContent, /restore 1/);
  await waitFor(() => !fs.existsSync(takeFile("alt-x.wav")), "file moved after countdown", 3000);
  const moved = fs
    .readdirSync(path.join(ws, "archive", "deleted"), { recursive: true })
    .map(String);
  assert.ok(
    moved.some((p) => p.endsWith("alt-x.wav")) && moved.some((p) => p.endsWith("alt-x.txt")),
    "wav + sidecar archived",
  );
  refreshGroups();
  await waitFor(() => !take(SID_A, "alt-x.wav"), "take removed from page");
});

test("restore within the countdown keeps the take", async () => {
  const te = take(SID_A, "alt-x.wav");
  te.querySelector("button.del").click();
  await sleep(500);
  te.querySelector("button.del").click();
  assert.ok(!te.classList.contains("deleting"));
  assert.equal(te.querySelector("button.del").textContent, "✕ delete");
  await sleep(2500);
  assert.ok(fs.existsSync(takeFile("alt-x.wav")));
  assert.ok(te.isConnected && !te.hidden);
});

test("a pending page update does not reload the page (and send the delete) during the countdown", async () => {
  win.eval("pageStale = true"); // index.html changed on the server since load
  const te = take(SID_A, "alt-x.wav");
  te.querySelector("audio").play();
  te.querySelector("button.del").click(); // pauses the take → the page checks for a reload
  await sleep(1200);
  assert.equal(navigations.length, 0, "no reload while the restore button counts down");
  assert.equal(beacons.length, 0, "no delete sent early");
  assert.ok(fs.existsSync(takeFile("alt-x.wav")));
  await waitFor(() => navigations.length > 0, "reload after the countdown", 3000);
});

test("pick only chooses the take; Apply sends it, marks the take picked and the line good", async () => {
  const le = line(SID_A),
    te = take(SID_A, "alt-x.wav");
  te.querySelector("button.tpick").click();
  assert.ok(te.classList.contains("staged"));
  assert.equal(te.querySelector("button.tpick").textContent, "✓ chosen");
  assert.equal(le.querySelector(".apply").textContent, "Apply: pick");
  await sleep(300);
  assert.equal(feedback().length, 0, "nothing sent before Apply");
  le.querySelector(".apply").click();
  await waitFor(() => te.classList.contains("picked"), "take marked picked");
  assert.ok(le.classList.contains("good"));
  assert.ok(!te.classList.contains("staged"));
  assert.equal(te.querySelector("button.tpick").textContent, "★ picked");
  const fb = feedback();
  assert.equal(fb.length, 1);
  assert.deepEqual([fb[0].verdict, fb[0].take, fb[0].sid], ["pick", "alt-x.wav", SID_A]);
});

test("clicking the chosen take again clears the choice", async () => {
  const le = line(SID_A),
    b = take(SID_A, "alt-x.wav").querySelector("button.tpick");
  b.click();
  b.click();
  assert.equal(b.textContent, "✓ pick");
  assert.equal(le.querySelector(".apply").textContent, "Apply");
  le.querySelector(".apply").click();
  await sleep(300);
  assert.equal(feedback().length, 0);
});

test("clicking a picked take unpicks it", async () => {
  const le = line(SID_A),
    te = take(SID_A, "alt-x.wav"),
    b = te.querySelector("button.tpick");
  b.click();
  le.querySelector(".apply").click();
  await waitFor(() => te.classList.contains("picked"), "picked");
  b.click();
  await waitFor(() => !te.classList.contains("picked"), "unpicked");
  assert.equal(b.textContent, "✓ pick");
  assert.ok(!line(SID_A).classList.contains("good"));
  assert.deepEqual(
    feedback().map((f) => [f.verdict, f.take]),
    [
      ["pick", "alt-x.wav"],
      ["unpick", "alt-x.wav"],
    ],
  );
});

test("labels keep their space: the new badge is hidden, not removed, and the agent note stays after a reply", async () => {
  const te = take(SID_A, "alt-x.wav");
  assert.ok(te.querySelector(".nw"), "badge element exists");
  const css = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("");
  assert.match(css, /\.take \.nw \{ visibility:hidden/);
  assert.doesNotMatch(css, /\.take \.nw \{ display:none/);
});

test("there is no mark-good button: a line becomes good only through a pick", () => {
  assert.equal(doc.querySelector(".qgood"), null);
  assert.ok(!line(SID_B).classList.contains("good"));
});

test("✎ on a take, then Enter, sends a redo about that take", async () => {
  const le = line(SID_A),
    cmt = le.querySelector(".cmt");
  take(SID_A, "alt-x.wav").querySelector("button.tnote").click();
  assert.match(cmt.placeholder, /alt-x/);
  cmt.value = "lower pitch";
  cmt.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await waitFor(() => feedback().length === 1, "feedback saved");
  assert.deepEqual((({ verdict, take, comment }) => ({ verdict, take, comment }))(feedback()[0]), {
    verdict: "redo",
    take: "alt-x.wav",
    comment: "lower pitch",
  });
  await waitFor(() => cmt.value === "" && !/alt-x/.test(cmt.placeholder), "form reset");
});

test("pick + Apply folds the line away with the approved lines and moves on", async () => {
  const le = line(SID_A);
  le.click();
  take(SID_A, "alt-x.wav").querySelector("button.tpick").click();
  le.querySelector(".apply").click();
  await waitFor(() => le.classList.contains("good"), "line good");
  assert.ok(
    !le.classList.contains("sticky") && !le.classList.contains("cur"),
    "no longer pinned on screen",
  );
  assert.equal(win.getComputedStyle(le).display, "none", "hidden while good lines are hidden");
  assert.deepEqual(
    feedback().map((f) => f.verdict),
    ["pick"],
  );
});

test("Apply with an empty comment sends nothing", async () => {
  line(SID_B).querySelector(".apply").click();
  await sleep(300);
  assert.equal(feedback().length, 0);
});

test("agent activity lists only jobs in progress: running first, then queued; finished events and dead jobs are hidden", async () => {
  const jobs = path.join(ws, "review", "jobs");
  fs.mkdirSync(jobs);
  // live jobs shaped like scripts/line_job.sh: bash -c '...' _ <batch> <sid> <text> ...
  const live = (sid) =>
    spawn(
      "bash",
      ["-c", "sleep 30; true", "_", "test_uk", sid, "Text for " + sid, "fb1", "--alt", "x"],
      { stdio: "ignore" },
    );
  const pa = live(SID_A),
    pb = live(SID_B);
  try {
    fs.writeFileSync(path.join(jobs, SID_A + ".pid"), String(pa.pid));
    fs.writeFileSync(path.join(jobs, SID_B + ".pid"), String(pb.pid));
    fs.writeFileSync(path.join(jobs, SID_C + ".pid"), "999999999"); // stale pid file
    fs.writeFileSync(
      path.join(ws, "review", "agent_events.jsonl"),
      [
        {
          ts: "t1",
          group: "batch:test_uk",
          sid: SID_A,
          status: "regenerated",
          message: "old take done",
        },
        {
          ts: "t2",
          group: "batch:test_uk",
          sid: SID_B,
          status: "working",
          feedback_id: "fb2",
          message: "Regenerating B",
        },
        { ts: "t3", group: "batch:aa_uk", sid: SID_C, status: "done", message: "Final C" },
      ]
        .map((e) => JSON.stringify(e))
        .join("\n") + "\n",
    );
    FakeEventSource.last.emit("change", { changed: ["events", "jobs"] });
    const feed = doc.querySelector("#feed");
    await waitFor(() => feed.querySelectorAll("div").length === 2, "two jobs listed");
    const rows = [...feed.querySelectorAll("div")].map((d) =>
      d.textContent.replace(/\s+/g, " ").trim(),
    );
    assert.match(rows[0], /^working t2 batch:test_uk Test_Line_B #fb2 ?Regenerating B$/);
    assert.match(rows[1], /^queued batch:test_uk Test_Line_A ?Text for Test_Line_A$/);
    assert.ok(!feed.textContent.includes("Final C") && !feed.textContent.includes("old take done"));
    assert.equal(doc.querySelector("#feedbox summary").textContent, "Agent activity (2)");

    pa.kill();
    pb.kill();
    await waitFor(() => pa.exitCode !== null || pa.signalCode, "job A gone");
    await waitFor(() => pb.exitCode !== null || pb.signalCode, "job B gone");
    FakeEventSource.last.emit("change", { changed: ["jobs"] });
    await waitFor(() => feed.textContent.includes("no jobs in progress"), "empty list");
    assert.equal(doc.querySelector("#feedbox summary").textContent, "Agent activity");
  } finally {
    pa.kill();
    pb.kill();
  }
});

// ---- server-side actions: picks are finalized and edited text is regenerated without an agent ----
function installScripts() {
  const sd = path.join(ws, "scripts");
  fs.mkdirSync(sd, { recursive: true });
  const stub = (name, body) => {
    fs.writeFileSync(path.join(sd, name), "#!/usr/bin/env bash\n" + body + "\n");
    fs.chmodSync(path.join(sd, name), 0o755);
  };
  stub("backup_finals.sh", 'cd "$(dirname "$0")/.."; echo backup >> scripts/backup.log');
  stub("line_job.sh", 'cd "$(dirname "$0")/.."; printf "%s\\n" "$@" > scripts/line_job.args');
}
const events = () => {
  try {
    return fs
      .readFileSync(path.join(ws, "review", "agent_events.jsonl"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
  } catch {
    return [];
  }
};
const postFeedback = (body) =>
  fetch(base + "/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
const finalA = () => path.join(ws, "higgs", "final", "test_uk", "01_" + SID_A + ".wav");

test("server finalizes a pick: the take is copied to finals, a done event is posted, finals are backed up", async () => {
  installScripts();
  const le = line(SID_A),
    te = take(SID_A, "alt-x.wav");
  te.querySelector("button.tpick").click();
  le.querySelector(".apply").click();
  await waitFor(() => fs.existsSync(finalA()), "final copy", 8000);
  assert.deepEqual(fs.readFileSync(finalA()), fs.readFileSync(takeFile("alt-x.wav")));
  const id = feedback()[0].id;
  const ev = await waitFor(() => events().find((e) => e.feedback_id === id), "done event");
  assert.equal(ev.status, "done");
  assert.match(ev.message, /^Final: alt-x\.wav -> higgs\/final\/test_uk\/01_Test_Line_A\.wav$/);
  await waitFor(() => fs.existsSync(path.join(ws, "scripts", "backup.log")), "backup ran");
  // the A/B alternative's text becomes the line's script text
  const sc = JSON.parse(fs.readFileSync(path.join(ws, "higgs", "test_uk.json"), "utf8"));
  assert.equal(sc.lines.find((l) => l.sid === SID_A).text, "Перша лінія, інакше.");
});

test("server unpicks: the final copy moves to archive/unfinal", async () => {
  installScripts();
  const le = line(SID_A),
    te = take(SID_A, "alt-x.wav"),
    b = te.querySelector("button.tpick");
  b.click();
  le.querySelector(".apply").click();
  await waitFor(() => fs.existsSync(finalA()), "final copy", 8000);
  await waitFor(() => te.classList.contains("picked"), "picked");
  await waitFor(() => events().length === 1, "pick done event");
  b.click();
  await waitFor(() => feedback().some((f) => f.verdict === "unpick"), "unpick sent");
  await waitFor(() => !fs.existsSync(finalA()), "final copy moved", 8000);
  const moved = fs
    .readdirSync(path.join(ws, "archive", "unfinal"), { recursive: true })
    .map(String);
  assert.ok(moved.some((p) => p.endsWith("01_" + SID_A + ".wav")));
  const ev = await waitFor(
    () => events().find((e) => /^Unpicked/.test(e.message || "")),
    "unpick event",
  );
  assert.equal(ev.status, "done");
  assert.equal(
    events().filter((e) => /^Final:/.test(e.message)).length,
    1,
    "the pick was finalized once",
  );
});

test("edited text with no comment is queued and regenerated by the server", async () => {
  installScripts();
  const rec = await postFeedback({
    group: "batch:test_uk",
    sid: SID_B,
    n: 2,
    verdict: "apply_text",
    comment: "",
    suggested_text: "Нова друга лінія.",
  });
  const argsFile = path.join(ws, "scripts", "line_job.args");
  await waitFor(() => fs.existsSync(argsFile), "line_job.sh called");
  assert.deepEqual(fs.readFileSync(argsFile, "utf8").trim().split("\n"), [
    SID_B,
    "test_uk",
    SID_B,
    "Нова друга лінія.",
    rec.id,
  ]);
  const ev = events().find((e) => e.feedback_id === rec.id);
  assert.equal(ev.status, "queued");
});

test("anything with a comment, and redo, is left for the agent", async () => {
  installScripts();
  await postFeedback({
    group: "batch:test_uk",
    sid: SID_B,
    verdict: "apply_text",
    comment: "slower please",
    suggested_text: "Нова.",
  });
  await postFeedback({
    group: "batch:test_uk",
    sid: SID_B,
    verdict: "redo",
    take: "s2024.wav",
    comment: "lower pitch",
  });
  await postFeedback({ group: "test:x", sid: SID_B, verdict: "pick", take: "s2024.wav" });
  await sleep(1500);
  assert.ok(!fs.existsSync(path.join(ws, "scripts", "line_job.args")), "no regeneration started");
  assert.deepEqual(events(), [], "no events posted");
});

test("/api/pending lists only what an agent has to do", async () => {
  installScripts();
  const pick = await postFeedback({
    group: "batch:test_uk",
    sid: SID_A,
    verdict: "pick",
    take: "s2024.wav",
    comment: "",
  });
  const pickNote = await postFeedback({
    group: "batch:test_uk",
    sid: SID_B,
    verdict: "pick",
    take: "s2024.wav",
    comment: "add annoyance",
  });
  const redo = await postFeedback({
    group: "batch:test_uk",
    sid: SID_B,
    verdict: "redo",
    comment: "lower pitch",
  });
  await waitFor(
    () => events().filter((e) => /^Final:/.test(e.message)).length === 2,
    "both picks finalized",
    8000,
  );
  const ids = () =>
    fetch(base + "/api/pending")
      .then((r) => r.json())
      .then((l) => l.map((f) => f.id).sort());
  assert.deepEqual(
    await ids(),
    [pickNote.id, redo.id].sort(),
    "plain pick handled; the pick note and the redo wait for an agent",
  );
  assert.ok(!(await ids()).includes(pick.id));
  await fetch(base + "/api/event", {
    method: "POST",
    body: JSON.stringify({
      feedback_id: redo.id,
      status: "queued",
      message: "Queued: 3 alternatives",
    }),
  });
  assert.deepEqual(await ids(), [pickNote.id]);
});
