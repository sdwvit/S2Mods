import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

/**
 * Fits the unknown expansion rate against Living Zone Tracker recordings: replays each recorded session's start
 * (lairs, owners, capacities, populations) for its real length under the rules of the build that was played, and
 * compares captures per hour and the squad size that holds a captured lair.
 *
 *   node Mods/LairWars/sim/calibrate.mts [--dir "<install>/session_logs"] [--min-hours 0.4] [--seeds 3]
 *
 * Sessions are taken from the 447-lair builds (before the wild lairs: well under the unit cap, so no culling),
 * at least --min-hours long. Rule values of those builds: cap 4000/3900, refill cooldowns 40 s / 120 s (the
 * recorded refill gaps bottom out at 39 s).
 */
const { values } = parseArgs({
  options: {
    dir: {
      type: "string",
      default: "/home/sdwvit/MX500-900/SteamLibrary/steamapps/common/Living Zone Tracker/session_logs",
    },
    "min-hours": { type: "string", default: "0.4" },
    seeds: { type: "string", default: "3" },
    help: { type: "boolean", short: "h" },
  },
});
if (values.help) {
  console.log(`Usage: node Mods/LairWars/sim/calibrate.mts [options]

  --dir PATH       Living Zone Tracker session_logs folder (default: the local install)
  --min-hours N    skip recordings shorter than this (default 0.4)
  --seeds N        simulation seeds per recording (default 3)
  -h, --help       show this help`);
  process.exit(0);
}
// loaded after --help: these imports scan the game cfgs
const { loadRecording } = await import("./recording.mts");
const { simulate } = await import("./simulate.mts");
const { assumed } = await import("./rules.mts");
const SESSION_LOGS = values.dir!;
const MIN_HOURS = Number(values["min-hours"]);
const SEEDS = Number(values.seeds);
const OLD_BUILD = {
  triggerExtinction: 4000,
  stopExtinction: 3900,
  partialWipeRefillCooldown: 40,
  fullWipeRefillCooldown: 120,
};

const sessions = [];
for (const f of fs
  .readdirSync(SESSION_LOGS)
  .filter((f) => f.endsWith(".zip"))
  .sort()) {
  const zip = path.join(SESSION_LOGS, f);
  let rec;
  try {
    rec = await loadRecording(zip, OLD_BUILD);
  } catch {
    continue; // incomplete recording
  }
  if (
    rec.world.lairs.length < 400 ||
    rec.world.lairs.length > 500 ||
    rec.observed.hours < MIN_HOURS
  )
    continue;
  sessions.push({ f, ...rec });
}
const obsHours = sessions.reduce((s, x) => s + x.observed.hours, 0);
const obsCaps = sessions.reduce((s, x) => s + x.observed.captures, 0);
const obsPop = sessions.flatMap((x) => x.observed.popAfterCapture);
const median = (a: number[]) => (a.length ? [...a].sort((p, q) => p - q)[a.length >> 1] : NaN);
console.log(
  `Recorded: ${sessions.length} sessions, ${obsHours.toFixed(2)} h, ${obsCaps} captures = ${(obsCaps / obsHours).toFixed(1)}/h, median holders after capture ${median(obsPop)}`,
);
for (const s of sessions)
  console.log(`  ${s.f}: ${s.observed.hours.toFixed(2)} h, ${s.observed.captures} captures`);

const grid: Array<Partial<typeof assumed>> = [
  ...[1, 0.3, 0.1].map((p) => ({
    checkUnit: "gameMinutes" as const,
    expansionMode: "perLair" as const,
    expansionChance: p,
  })),
  ...[1, 2].map((n) => ({
    checkUnit: "gameMinutes" as const,
    expansionMode: "global" as const,
    expansionsPerCheck: n,
  })),
  ...[0.0005, 0.0003].map((p) => ({ expansionMode: "perLair" as const, expansionChance: p })),
  ...[0.01, 0.001].map((p) => ({ expansionMode: "perLair" as const, expansionChance: p })),
  ...[1].map((n) => ({ expansionMode: "global" as const, expansionsPerCheck: n })),
  ...[0.01, 0.005, 0.003, 0.002].map((p) => ({ expansionMode: "perFaction" as const, factionChance: p })),
];
const base = { ...assumed };
console.log("\nSimulated (same sessions, same lengths):");
for (const g of grid) {
  Object.assign(assumed, base, g);
  let caps = 0;
  let battles = 0;
  const pops: number[] = [];
  for (const s of sessions) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = simulate(s.world as any, {
        days: (s.observed.hours * 3600 * assumed.gameTimeScale) / 86400,
        rankTier: 1,
        seed,
      });
      caps += r.counters.captures;
      battles += r.counters.battles;
      for (const e of r.events)
        if (e.kind !== "battle") pops.push(r.end.find((l) => l.id === e.lair)!.pop);
    }
  }
  const n = SEEDS;
  console.log(
    `  ${JSON.stringify(g).padEnd(52)} captures ${(caps / n / obsHours).toFixed(1).padStart(7)}/h   battles ${(battles / n / obsHours).toFixed(0).padStart(5)}/h   median holders at end ${median(pops)}`,
  );
}
Object.assign(assumed, base);
