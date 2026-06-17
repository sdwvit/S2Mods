import fs from "node:fs";
import path from "node:path";
import type {
  QuestNodePrototype,
  QuestNodePrototypeItemAdd,
  QuestNodePrototypeSetItemGenerator,
} from "s2cfgtojson";
import type { MetaContext, StructTransformer } from "../../src/meta-type.mts";
import { baseCfgDir } from "../../src/base-paths.mts";

// Lazily-built index of SpawnActorPrototypes: GUID -> .cfg file path. Spawn actors
// are stored one-per-file named after their GUID, which is what TargetQuestGuid
// references. Built once on first lookup so we only pay the directory walk if a
// candidate node actually needs a spawn-type check.
let spawnActorPathByGuid: Map<string, string> | null = null;

const getSpawnActorIndex = (): Map<string, string> => {
  if (spawnActorPathByGuid) {
    return spawnActorPathByGuid;
  }
  const index = new Map<string, string>();
  const root = path.join(baseCfgDir, "GameData", "SpawnActorPrototypes");
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".cfg")) {
        index.set(entry.name.slice(0, -".cfg".length), full);
      }
    }
  };
  if (fs.existsSync(root)) {
    walk(root);
  }
  spawnActorPathByGuid = index;
  return index;
};

const spawnTypeByGuid = new Map<string, string | null>();

const getSpawnType = (guid: string): string | null => {
  if (spawnTypeByGuid.has(guid)) {
    return spawnTypeByGuid.get(guid)!;
  }
  const file = getSpawnActorIndex().get(guid);
  const spawnType = file
    ? (fs.readFileSync(file, "utf8").match(/SpawnType\s*=\s*(ESpawnType::\w+)/)?.[1] ?? null)
    : null;
  spawnTypeByGuid.set(guid, spawnType);
  return spawnType;
};

/**
 * Defensive fix for disappearing quest PDAs (e.g. Garbage_L_Factory_Camp StrangePDA).
 *
 * A quest corpse's loot is built by a `SetItemGenerator` node and the PDA is added
 * on top by a one-shot `ItemAdd`. When the `SetItemGenerator` node carries
 * `ReplaceInventory = true`, anything that re-fires it (or a refreshing generator
 * bucket) wipes the body's inventory and takes the quest-placed PDA with it.
 *
 * For any `SetItemGenerator` node whose target body is also given a PDA via an
 * `ItemAdd` node in the same quest, flip `ReplaceInventory` to false so the generator
 * merges into — rather than overwrites — the corpse inventory and the PDA survives.
 */
const isPdaItemAdd = (node: QuestNodePrototype): node is QuestNodePrototypeItemAdd =>
  node.NodeType === "EQuestNodeType::ItemAdd" &&
  typeof (node as QuestNodePrototypeItemAdd).ItemSID === "string" &&
  (node as QuestNodePrototypeItemAdd).ItemSID.includes("PDA");

// filePath -> set of TargetQuestGuids that receive a PDA via an ItemAdd node.
const pdaBodiesByFile = new Map<string, Set<string>>();

const getPdaBodies = (context: MetaContext<QuestNodePrototype>): Set<string> => {
  let bodies = pdaBodiesByFile.get(context.filePath);
  if (!bodies) {
    bodies = new Set();
    for (const node of context.array) {
      if (isPdaItemAdd(node) && node.TargetQuestGuid) {
        bodies.add(node.TargetQuestGuid);
      }
    }
    pdaBodiesByFile.set(context.filePath, bodies);
  }
  return bodies;
};

export const transformQuestNodePDANodes: StructTransformer<QuestNodePrototype> = (struct, context) => {
  if (struct.NodeType !== "EQuestNodeType::SetItemGenerator") {
    return;
  }
  const node = struct as QuestNodePrototypeSetItemGenerator;
  // Nothing to fix if it already merges instead of replacing.
  if (!node.ReplaceInventory || !node.TargetQuestGuid) {
    return;
  }
  if (!getPdaBodies(context).has(node.TargetQuestGuid)) {
    return;
  }
  // Only protect actual character corpses/objects. Item containers (stashes) are
  // genuinely meant to be (re)filled by their generator and aren't part of the
  // disappearing-PDA bug, so leave them untouched.
  if (getSpawnType(node.TargetQuestGuid) === "ESpawnType::ItemContainer") {
    return;
  }

  const fork = struct.fork() as QuestNodePrototypeSetItemGenerator;
  fork.ReplaceInventory = false;
  return fork;
};
transformQuestNodePDANodes.files = ["/QuestNodePrototypes/"];
transformQuestNodePDANodes.contains = true;
