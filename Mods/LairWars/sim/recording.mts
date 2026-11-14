import { execFileSync } from "node:child_process";
import { loadRelations, type WorldLair } from "./world.mts";
import { EXPANDING_FACTIONS } from "../openLairs.mts";

/**
 * A world taken from a Living Zone Tracker session recording (session_logs/session_<t>.zip): the lairs, owners,
 * capacities and populations at the session start, and what happened during it (for calibration).
 *
 * Capacities are the recorded ones and stay with the lair when its owner changes (the recording can't say what the
 * new owner's block holds). Rule values of the build that was played go in `overrides`.
 */
export type Observed = {
  hours: number;
  captures: number;
  refills: number;
  capturesPerHour: number;
  popAfterCapture: number[];
};

const read = (zip: string, name: string) =>
  execFileSync("unzip", ["-p", zip, name], { maxBuffer: 1 << 30 }).toString("utf8");

export async function loadRecording(zip: string, overrides: Record<string, number> = {}) {
  const relations = await loadRelations();
  const initial = JSON.parse(read(zip, "initial.json"));
  const lairs: WorldLair[] = [];
  const caps: Record<string, number> = {};
  for (const [id, l] of Object.entries<any>(initial.lairs)) {
    if (!l.owner) continue;
    caps[id] = l.capacity;
    lairs.push({
      id,
      x: l.x,
      y: l.y,
      region: 1,
      prototype: id,
      owner: relations.canon(l.owner),
      capturable: true,
      active: l.active !== false && l.capacity > 0,
      wild: false,
      pop: l.population,
    });
  }

  // What the session recorded: captures and refills, over its length.
  let t0 = 0;
  let t1 = 0;
  let captures = 0;
  let refills = 0;
  const popAfterCapture: number[] = [];
  const pop: Record<string, number> = Object.fromEntries(
    Object.entries<any>(initial.lairs).map(([k, l]) => [k, l.population]),
  );
  for (const line of read(zip, "actions.jsonl").split("\n")) {
    if (!line) continue;
    const a = JSON.parse(line);
    t0 ||= a.t;
    t1 = a.t;
    if (a.type !== "lair/changed") continue;
    const ch = a.payload.changes;
    if ("owner" in ch) {
      captures++;
      popAfterCapture.push(ch.population ?? pop[a.payload.uid]);
    }
    if ("population" in ch) {
      if (ch.population > (pop[a.payload.uid] ?? 0)) refills++;
      pop[a.payload.uid] = ch.population;
    }
  }
  const hours = (t1 - t0) / 3600;
  const observed: Observed = {
    hours,
    captures,
    refills,
    capturesPerHour: captures / hours,
    popAfterCapture,
  };

  const world = {
    lairs,
    capacity: (sid: string) => caps[sid] ?? 0,
    missingSizes: new Set<string>(),
    ...relations,
    expanding: new Set(EXPANDING_FACTIONS),
    overrides,
  };
  return { world, observed };
}
