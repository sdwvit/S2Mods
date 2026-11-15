import { parseArgs, styleText } from "node:util";
import type { Result } from "./simulate.mts";

/**
 * LairWars offline A-Life simulation, without the game.
 *   node Mods/LairWars/sim/run.mts [--days 10] [--rank 1] [--seed 1] [--runs 1]
 * Runs under both offline fight rules (vanilla dice, ttk exe patch) and prints them side by side.
 * --rank: player rank tier 0-3 (Newbie, Experienced, Veteran, Master). --runs: average over seeds seed..seed+runs-1.
 * Rules live in rules.mts.
 */
const { values } = parseArgs({
  options: {
    days: { type: "string", default: "10" },
    rank: { type: "string", default: "1" },
    seed: { type: "string", default: "1" },
    runs: { type: "string", default: "1" },
    "even-sizes": { type: "string" },
    "s4-solo": { type: "boolean" },
    "s4-safe": { type: "boolean" },
    "captured-share": { type: "string" },
    bases: { type: "string" },
    "bases-per-region": { type: "boolean" },
    buff: { type: "string" },
    "captured-refill": { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});
if (values.help) {
  console.log(`Usage: node Mods/LairWars/sim/run.mts [options]

  --days N    game days to simulate (default 10)
  --rank N    player rank tier: 0 Newbie, 1 Experienced, 2 Veteran, 3 Master (default 1)
  --seed N    random seed (default 1)
  --runs N    repeat with seeds seed..seed+runs-1 and average (default 1)
  --even-sizes LO-HI  what-if: every lair block's MaxSpawnQuantity clamped into LO..HI (e.g. 6-10)
  --s4-solo   what-if: S4 species (deer, pseudogiant, chimera) expand one unit at a time
  --s4-safe   what-if: lairs that start with an S4 species can't be captured
  --captured-share X   what-if: a holder outside its starting lair gets X of the capacity roll (e.g. 0.5)
  --captured-refill M  what-if: refill cooldowns for a holder outside its starting lair are M times longer (e.g. 3)
  --bases X   what-if: every faction keeps max(1, X x its lairs) uncapturable bases (0 = one each)
  --bases-per-region  what-if: one uncapturable base per faction in each region it starts in
  --buff GROUP:SQUAD:CAMP:SPEED:WEIGHT  what-if: one faction group gets squads up to SQUAD, camps x CAMP,
              need and expansion x SPEED, OfflineCombatWeight + WEIGHT (e.g. Monolith:6:1.3:1.5:100)
  -h, --help  show this help

Every run is done twice, once per offline fight rule, side by side:
  vanilla  each side rolls rand(0..OfflineCombatWeight), higher roll wins
  ttk      the offline-combat-ttk exe patch: time to kill from HP, damage, armor (human loadouts assumed)
Rules (assumed and from the mod) live in rules.mts.`);
  process.exit(0);
}
// loaded after --help: these imports scan the game cfgs
const { loadWorld } = await import("./world.mts");
const { simulate } = await import("./simulate.mts");
const { assumed } = await import("./rules.mts");
const DAYS = Number(values.days);
const RANK_TIER = Number(values.rank);
const SEED = Number(values.seed);
const RUNS = Number(values.runs);
const EVEN = values["even-sizes"] ? (values["even-sizes"].split("-").map(Number) as [number, number]) : undefined;
const num = (v: string | undefined) => (v === undefined ? undefined : Number(v));

const t0 = Date.now();
const world = await loadWorld();
const loadMs = Date.now() - t0;
const COMBATS = ["vanilla", "ttk"] as const;
const options = {
  evenSizes: EVEN,
  s4Solo: !!values["s4-solo"],
  s4Safe: !!values["s4-safe"],
  capturedShare: num(values["captured-share"]),
  capturedRefill: num(values["captured-refill"]),
  bases: num(values.bases),
  basesPerRegion: !!values["bases-per-region"],
  buff: values.buff
    ? (([group, squad, camp, speed, weightAdd]) => ({ group, squad: +squad, camp: +camp, speed: +speed, weightAdd: +weightAdd }))(values.buff.split(":"))
    : undefined,
};
const results = Object.fromEntries(
  COMBATS.map((combat) => [
    combat,
    Array.from({ length: RUNS }, (_, r) =>
      simulate(world, { days: DAYS, rankTier: RANK_TIER, seed: SEED + r, combat, ...options }),
    ),
  ]),
) as Record<(typeof COMBATS)[number], Result[]>;

// ---- output helpers ----
const bold = (s: string) => styleText("bold", s);
const dim = (s: string) => styleText("dim", s);
const head = (s: string) => styleText(["bold", "cyan"], s);
const visible = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").length;
const pad = (s: string, w: number, right: boolean) =>
  right ? " ".repeat(Math.max(0, w - visible(s))) + s : s + " ".repeat(Math.max(0, w - visible(s)));
/** Prints rows as a table; the first row is the header. Columns after the first are right-aligned. */
function table(title: string, rows: string[][]) {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => visible(r[i] ?? ""))));
  const line = (r: string[]) => "│ " + r.map((c, i) => pad(c ?? "", widths[i], i > 0)).join(" │ ") + " │";
  const rule = (l: string, m: string, r: string) => l + widths.map((w) => "─".repeat(w + 2)).join(m) + r;
  console.log(head(title));
  console.log(rule("┌", "┬", "┐"));
  console.log(line(rows[0].map(bold)));
  console.log(rule("├", "┼", "┤"));
  rows.slice(1).forEach((r) => console.log(line(r)));
  console.log(rule("└", "┴", "┘"));
  console.log();
}
const delta = (d: number) =>
  d > 0 ? styleText("green", `+${d}`) : d < 0 ? styleText("red", String(d)) : dim("0");
const avg = (rs: Result[], f: (r: Result) => number) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
const fmt = (n: number, digits = 0) => n.toFixed(digits);

const r0 = results.vanilla[0];
const realHours = r0.realSeconds / 3600;
const RANK = ["Newbie", "Experienced", "Veteran", "Master"][RANK_TIER];
const whatIfs = Object.entries(options)
  .filter(([, v]) => v !== undefined && v !== false)
  .map(([k, v]) => (v === true ? k : `${k}=${typeof v === "object" ? Object.values(v).join(":") : v}`));

console.log(
  bold(`LairWars simulation: ${DAYS} game days`) +
    ` (${fmt(realHours, 1)} h real at ${assumed.gameTimeScale}x), player rank ${RANK}, seed ${SEED}` +
    (RUNS > 1 ? `..${SEED + RUNS - 1} (averaged)` : "") +
    (whatIfs.length ? `, what-if: ${styleText("yellow", whatIfs.join(", "))}` : ""),
);
console.log(
  dim(
    `World: ${world.lairs.length} lairs (${world.lairs.filter((l) => l.wild).length} wild, ${world.lairs.filter((l) => !l.capturable).length} hub), ${world.lairs.filter((l) => l.active).length} active, ${world.missingSizes.size} lair/faction pairs without a block. Loaded in ${loadMs} ms.`,
  ),
);
console.log();

// ---- summary ----
const c = (rs: Result[], k: keyof Result["counters"]) => avg(rs, (r) => r.counters[k]);
const summary: Array<[string, (rs: Result[]) => string]> = [
  ["Alive at end", (rs) => fmt(avg(rs, (r) => r.end.reduce((s, l) => s + l.pop, 0)))],
  ["Lair places at start", (rs) => fmt(avg(rs, (r) => r.start.reduce((s, l) => s + l.cap, 0)))],
  ["Squads sent", (rs) => fmt(c(rs, "squads"))],
  ["Units per squad", (rs) => fmt(c(rs, "squadUnits") / Math.max(1, c(rs, "squads")), 1)],
  ["Battles", (rs) => fmt(c(rs, "battles"))],
  ["Attackers won", (rs) => fmt((100 * c(rs, "attackerWins")) / Math.max(1, c(rs, "battles"))) + "%"],
  ["Captures", (rs) => fmt(c(rs, "captures"))],
  ["Captures per real hour", (rs) => fmt(c(rs, "captures") / realHours, 1)],
  ["Battle deaths", (rs) => fmt(c(rs, "battleDeaths"))],
  ["Culled (unit cap)", (rs) => fmt(c(rs, "culled"))],
  ["Refills", (rs) => fmt(c(rs, "refilled"))],
];
table("Summary", [["", ...COMBATS], ...summary.map(([name, f]) => [name, ...COMBATS.map((k) => f(results[k]))])]);

// ---- territory ----
/** Lairs per faction group at the start and end, and deaths, averaged over runs. */
function territory(rs: Result[]) {
  const out = new Map<string, { l0: number; l1: number; deaths: number }>();
  const get = (g: string) => out.get(g) ?? (out.set(g, { l0: 0, l1: 0, deaths: 0 }), out.get(g)!);
  for (const r of rs) {
    r.start.forEach((s) => (get(s.group).l0 += 1 / rs.length));
    r.end.forEach((e) => (get(e.group).l1 += 1 / rs.length));
    for (const [g, d] of Object.entries(r.deathsByGroup)) get(g).deaths += d / rs.length;
  }
  return out;
}
const terr = Object.fromEntries(COMBATS.map((k) => [k, territory(results[k])])) as Record<
  (typeof COMBATS)[number],
  ReturnType<typeof territory>
>;
const groupNames = [...new Set(COMBATS.flatMap((k) => [...terr[k].keys()]))].filter((g) =>
  COMBATS.some((k) => (terr[k].get(g)?.l0 ?? 0) + (terr[k].get(g)?.l1 ?? 0) > 0),
);
const change = (g: string, k: (typeof COMBATS)[number]) => {
  const t = terr[k].get(g);
  return t ? Math.round(t.l1) - Math.round(t.l0) : 0;
};
groupNames.sort((a, b) => COMBATS.reduce((s, k) => s + change(b, k) - change(a, k), 0));
table("Territory: lairs held (start -> end per fight rule) and deaths", [
  ["Faction", "Start", ...COMBATS.flatMap((k) => [`${k} end`, "change", "deaths"])],
  ...groupNames.map((g) => [
    g,
    fmt(terr.vanilla.get(g)?.l0 ?? 0),
    ...COMBATS.flatMap((k) => {
      const t = terr[k].get(g);
      return [fmt(t?.l1 ?? 0), delta(change(g, k)), fmt(t?.deaths ?? 0)];
    }),
  ]),
]);

// ---- region tiers ----
const tiers = [0, 1, 2, 3, 4];
const regionRows: string[][] = [];
for (let region = 1; region <= 4; region++) {
  const count = (snap: Result["start"], s: number) => snap.filter((l) => l.region === region && l.s === s).length;
  regionRows.push([
    `R${region}`,
    ...tiers.map((s) => {
      const start = count(r0.start, s);
      const ends = COMBATS.map((k) => Math.round(avg(results[k], (r) => count(r.end, s))));
      return `${dim(String(start))} → ${ends.map((e) => (e > start ? styleText("green", String(e)) : e < start ? styleText("red", String(e)) : String(e))).join(dim(" / "))}`;
    }),
  ]);
}
table("Lairs by species tier per region tier: start → vanilla / ttk (S0 humans, S1 tushkan..zombie, S4 deer, pseudogiant, chimera)", [
  ["Region", ...tiers.map((s) => `S${s}`)],
  ...regionRows,
]);

console.log(dim("Assumed rules (not from the game files): " + JSON.stringify(assumed)));
