// SQLite store for the review site's static records (review/review.sqlite): the user's notes (feedback), the history
// of events on lines and notes (events) and the agent's runs (runs). Nothing here says what is happening now: that is
// the job queue (queue.mts, table jobs), the only source for queued/running/held state.
// Older stores are migrated on open: tables that kept each record as a JSON blob, and before them the append-only
// files feedback.jsonl, agent_events.jsonl and agent_runs.jsonl (imported once, then renamed to <name>.jsonl.imported).
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type Rec = Record<string, any>;
export type Table = "feedback" | "events" | "runs";

type Col = { name: string; field: string; type: string; json?: boolean; bool?: boolean };
const col = (name: string, type = "TEXT", field = name): Col => ({ name, field, type });
/** Columns in record-field order; `group` is a reserved word in SQL, so its column is `grp`. */
const SCHEMA: Record<Table, { key: string; cols: Col[] }> = {
  feedback: {
    key: "rowid",
    cols: [
      { ...col("id"), type: "TEXT PRIMARY KEY" },
      col("ts"),
      col("grp", "TEXT", "group"),
      col("n", "INTEGER"),
      col("sid"),
      col("take"),
      col("verdict"),
      col("comment"),
      col("suggested_text"),
    ],
  },
  events: {
    key: "seq",
    cols: [
      { ...col("seq"), type: "INTEGER PRIMARY KEY" },
      col("ts"),
      col("feedback_id"),
      col("grp", "TEXT", "group"),
      col("sid"),
      col("status"),
      col("message"),
    ],
  },
  runs: {
    key: "seq",
    cols: [
      { ...col("seq"), type: "INTEGER PRIMARY KEY" },
      col("ts"),
      { ...col("feedback_ids"), json: true },
      { ...col("sids"), json: true },
      col("model"),
      col("cost_usd", "REAL"),
      col("turns", "INTEGER"),
      col("duration_ms", "INTEGER"),
      { ...col("ok", "INTEGER"), bool: true },
      col("session_id"),
      col("result"),
    ],
  },
};
const LEGACY: Record<Table, string> = {
  feedback: "feedback.jsonl",
  events: "agent_events.jsonl",
  runs: "agent_runs.jsonl",
};
const fieldsOf = (t: Table) => SCHEMA[t].cols.filter((c) => c.name !== "seq");

export function openStore(reviewDir: string) {
  fs.mkdirSync(reviewDir, { recursive: true });
  const db = new DatabaseSync(path.join(reviewDir, "review.sqlite"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  const create = (t: Table, name: string = t) =>
    db.exec(
      `CREATE TABLE IF NOT EXISTS ${name} (${SCHEMA[t].cols.map((c) => `${c.name} ${c.type}`).join(", ")})`,
    );

  function add(t: Table, rec: Rec) {
    const cols = fieldsOf(t);
    const vals = cols.map((c) => {
      const v = rec[c.field];
      if (v === undefined || v === null) return null;
      if (c.json) return JSON.stringify(v);
      if (c.bool) return v ? 1 : 0;
      return typeof v === "object" ? JSON.stringify(v) : v;
    });
    db.prepare(
      `INSERT INTO ${t} (${cols.map((c) => c.name).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    ).run(...vals);
  }
  /** Records in insertion order, as the API returns them: empty fields left out. */
  function all(t: Table, where = "", ...args: (string | number)[]): Rec[] {
    const cols = fieldsOf(t);
    return db
      .prepare(`SELECT * FROM ${t} ${where} ORDER BY ${SCHEMA[t].key}`)
      .all(...args)
      .map((row: Rec) => {
        const r: Rec = {};
        for (const c of cols) {
          const v = row[c.name];
          if (v === null || v === undefined) {
            if (t === "feedback") r[c.field] = c.name === "comment" ? "" : null; // notes always carry every field
            continue;
          }
          r[c.field] = c.json ? JSON.parse(String(v)) : c.bool ? !!v : v;
        }
        return r;
      });
  }
  /** Changes whenever a row is added or removed (also by another connection), for the change watcher. */
  const sig = (t: Table) => {
    const r = db.prepare(`SELECT count(*) AS n, coalesce(max(rowid), 0) AS m FROM ${t}`).get()!;
    return `${r.n},${r.m}`;
  };

  for (const t of Object.keys(SCHEMA) as Table[]) {
    const old = db.prepare(`PRAGMA table_info(${t})`).all() as Rec[];
    if (old.some((c) => c.name === "data")) {
      // a JSON-blob table from before: move its records into the columns
      db.exec("BEGIN");
      db.exec(`ALTER TABLE ${t} RENAME TO ${t}_blobs`);
      create(t);
      for (const r of db.prepare(`SELECT data FROM ${t}_blobs ORDER BY seq`).all() as Rec[])
        add(t, JSON.parse(String(r.data)));
      db.exec(`DROP TABLE ${t}_blobs`);
      db.exec("COMMIT");
    } else create(t);
  }
  db.exec("CREATE INDEX IF NOT EXISTS events_line ON events (grp, sid, seq)");
  db.exec("CREATE INDEX IF NOT EXISTS events_feedback ON events (feedback_id, seq)");

  for (const [t, file] of Object.entries(LEGACY) as [Table, string][]) {
    const p = path.join(reviewDir, file);
    if (!fs.existsSync(p) || sig(t) !== "0,0") continue;
    const recs = fs
      .readFileSync(p, "utf8")
      .split("\n")
      .flatMap((ln) => {
        try {
          return ln.trim() ? [JSON.parse(ln)] : [];
        } catch {
          return [];
        }
      });
    db.exec("BEGIN");
    for (const r of recs) add(t, r);
    db.exec("COMMIT");
    fs.renameSync(p, p + ".imported");
    console.log(`imported ${recs.length} records from ${file} into review.sqlite`);
  }

  return { db, add, all, sig, close: () => db.close() };
}
