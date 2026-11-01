import fs from "node:fs";
import path from "node:path";
import type { SpawnActorPrototype } from "s2cfgtojson";
import { baseCfgDir } from "../../src/base-paths.mts";
import { getCfgFiles } from "../../src/get-cfg-files.mts";
import { readFileAndGetStructs } from "../../src/read-file-and-get-structs.mts";

/**
 * Hub lairs stay out of LairWars' capturing: the `Guard*` lairs that guard a hub, and the residents' lairs
 * inside it, found as lairs vanilla marks `CanBeCaptured = false` within HUB_RADIUS of a guard lair (the
 * traders' and faction bases' camps sit 20-85 m from their guards; the nearest field camp is 135 m away).
 */
const HUB_RADIUS = 100 * 100; // 100 m in UE units (cm)

export const isGuardLairPrototype = (lairPrototypeSID: unknown) => String(lairPrototypeSID).startsWith("Guard");

/** World-map spawn actor files that hold at least one lair. */
export const lairActorFiles = (await getCfgFiles("/SpawnActorPrototypes/WorldMap_WP/", true)).filter(
  (f) =>
    f.includes("/GameData/SpawnActorPrototypes/WorldMap_WP/") &&
    fs.readFileSync(f, "utf8").includes("ESpawnType::LairSpawner"),
);

const lairActors: SpawnActorPrototype[] = [];
for (const file of lairActorFiles) {
  const structs = await readFileAndGetStructs<SpawnActorPrototype>(path.relative(path.join(baseCfgDir, "GameData"), file));
  lairActors.push(...structs.filter((s) => s.SpawnType === "ESpawnType::LairSpawner"));
}

const isGuard = (lair: SpawnActorPrototype) => isGuardLairPrototype(lair.LairPrototypeSID);
const guards = lairActors.filter(isGuard);
const distance = (a: SpawnActorPrototype, b: SpawnActorPrototype) =>
  Math.hypot(Number(a.PositionX) - Number(b.PositionX), Number(a.PositionY) - Number(b.PositionY));
const insideHub = (lair: SpawnActorPrototype) =>
  String(lair.CanBeCaptured) === "false" && guards.some((guard) => distance(lair, guard) <= HUB_RADIUS);

/** SIDs of the hub lairs (guards and residents). */
export const hubLairs = new Set(lairActors.filter((l) => isGuard(l) || insideHub(l)).map((l) => l.__internal__.rawName));
