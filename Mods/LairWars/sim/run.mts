import fs from "node:fs";
import { parseArgs } from "node:util";
import { loadWorld } from "./world.mts";
import { simulate, type Result } from "./simulate.mts";
import { assumed } from "./rules.mts";

/**
 * LairWars offline A-Life simulation, without the game.
 *
 *   node Mods/LairWars/sim/run.mts [--days 10] [--rank 1] [--seed 1] [--runs 1] [--json out.json]
 *
 * --rank: player rank tier 0-3 (Newbie, Experienced, Veteran, Master). --runs: repeat with seeds seed..seed+runs-1
 * and report the average. --set key=value overrides an assumed rule (rules.mts `assumed`), e.g. --set travelSpeed=3.
 */
const { values } = parseArgs({
  options: {
    days: { type: "string", default: "10" },
    rank: { type: "string", default: "1" },
    seed: { type: "string", default: "1" },
    runs: { type: "string", default: "1" },
    json: { type: "string" },
    set: { type: "string", multiple: true },
  },
});
for (const kv of values.set ?? []) {
  const [k, v] = kv.split("=");
  if (!(k in assumed)) throw new Error(`unknown assumed rule: ${k}`);
  (assumed as any)[k] = isNaN(Number(v))
    ? v === "true"
      ? true
      : v === "false"
        ? false
        : v
    : Number(v);
}

const t0 = Date.now();
const world = await loadWorld();
const loadMs = Date.now() - t0;
const days = Number(values.days);
const runs = Number(values.runs);
const results: Result[] = [];
for (let r = 0; r < runs; r++)
  results.push(
    simulate(world, { days, rankTier: Number(values.rank), seed: Number(values.seed) + r }),
  );

const avg = (f: (r: Result) => number) => results.reduce((s, r) => s + f(r), 0) / results.length;
const r0 = results[0];
const realHours = r0.realSeconds / 3600;
const RANK = ["Newbie", "Experienced", "Veteran", "Master"][Number(values.rank)];

const lines: string[] = [];
const say = (s = "") => lines.push(s);
say(
  `LairWars simulation: ${days} game days (${realHours.toFixed(1)} h real at ${assumed.gameTimeScale}x), player rank ${RANK}, ${runs} run(s)`,
);
say(
  `World: ${world.lairs.length} lairs (${world.lairs.filter((l) => l.wild).length} wild, ${world.lairs.filter((l) => !l.capturable).length} hub), ${world.lairs.filter((l) => l.active).length} active. Loaded in ${loadMs} ms.`,
);
const zeroStart = r0.start.filter((l, i) => world.lairs[i].active && l.cap === 0);
if (zeroStart.length)
  say(
    `Active lairs with no size block for their starting owner (stay empty until taken): ${zeroStart.length}, e.g. ${zeroStart
      .slice(0, 5)
      .map((l) => `${world.lairs.find((w) => w.id === l.id)!.prototype}/${l.owner}`)
      .join(", ")}`,
  );
say(
  `Lair/faction pairs without a block (that faction can't move in there): ${world.missingSizes.size}`,
);
say();
const c = (k: keyof Result["counters"]) => avg((r) => r.counters[k]);
say(
  `Alive at start ${avg((r) => r.start.reduce((s, l) => s + l.pop, 0)).toFixed(0)}, at end ${avg((r) => r.end.reduce((s, l) => s + l.pop, 0)).toFixed(0)} (cap ${r0.start.reduce((s, l) => s + l.cap, 0)} lair places)`,
);
say(
  `Squads sent ${c("squads").toFixed(0)} (${(c("squadUnits") / Math.max(1, c("squads"))).toFixed(1)} units each), no target ${c("noTarget").toFixed(0)}`,
);
say(
  `Captures ${c("captures").toFixed(1)} = ${(c("captures") / realHours).toFixed(1)} per real hour (${c("emptyTakes").toFixed(1)} empty lairs taken, ${c("attackerWins").toFixed(1)} won in battle)`,
);
say(
  `Battles ${c("battles").toFixed(0)}, attackers won ${((100 * c("attackerWins")) / Math.max(1, c("battles"))).toFixed(0)}%, battle deaths ${c("battleDeaths").toFixed(0)}, culled ${c("culled").toFixed(0)}`,
);
say(
  `Refills ${c("refilled").toFixed(0)} one by one, ${c("respawned").toFixed(0)} respawned after full wipes, squads that found home lost ${c("returns").toFixed(0)} returns`,
);
const caps = r0.events
  .filter((e) => e.kind !== "battle")
  .map((e) => e.dist)
  .sort((a, b) => a - b);
if (caps.length)
  say(
    `Capture distance: median ${caps[caps.length >> 1].toFixed(0)} m, 90% under ${caps[Math.floor(caps.length * 0.9)].toFixed(0)} m (run 1)`,
  );

say();
say("Territory by faction group (run 1): lairs start -> end, lair places start -> end, deaths");
const groups = new Map<string, number[]>();
for (const [i, s] of r0.start.entries()) {
  const e = r0.end[i];
  const a = groups.get(s.group) ?? [0, 0, 0, 0];
  a[0]++;
  a[2] += s.cap;
  groups.set(s.group, a);
  const b = groups.get(e.group) ?? [0, 0, 0, 0];
  b[1]++;
  b[3] += e.cap;
  groups.set(e.group, b);
}
const rows = [...groups.entries()].sort((a, b) => b[1][1] - b[1][0] - (a[1][1] - a[1][0]));
for (const [g, [l0, l1, c0, c1]] of rows) {
  if (l0 === 0 && l1 === 0) continue;
  say(
    `  ${g.padEnd(13)} ${String(l0).padStart(4)} -> ${String(l1).padEnd(4)} (${l1 - l0 >= 0 ? "+" : ""}${l1 - l0})   places ${c0} -> ${c1}   deaths ${r0.deathsByGroup[g] ?? 0}`,
  );
}

say();
say("Lairs held by species tier per region at the end (run 1), start in brackets. S0 = humans.");
for (let region = 1; region <= 4; region++) {
  const count = (snap: Result["start"]) =>
    [0, 1, 2, 3, 4].map((s) => snap.filter((l) => l.region === region && l.s === s).length);
  const a = count(r0.start);
  const b = count(r0.end);
  say(`  R${region}: ${b.map((n, s) => `S${s} ${n} (${a[s]})`).join("  ")}`);
}

say();
say("Timeline (run 1): game day, alive, squads out, captures so far");
const step = Math.max(1, Math.floor(r0.timeline.length / 10));
for (let k = 0; k < r0.timeline.length; k += step) {
  const p = r0.timeline[k];
  say(
    `  day ${String(p.gameDay).padStart(5)}  alive ${String(p.alive).padStart(6)}  out ${String(p.squadsOut).padStart(4)}  captures ${p.captures}`,
  );
}
say();
say(
  "Assumed rules (not from the game files; calibrate against tracker recordings): " +
    JSON.stringify(assumed),
);
console.log(lines.join("\n"));

if (values.json) {
  fs.writeFileSync(
    values.json,
    JSON.stringify({ assumed, results: results.map(({ lairs, world, ...r }) => r) }),
  );
  console.log(`\nWrote ${values.json}`);
}
