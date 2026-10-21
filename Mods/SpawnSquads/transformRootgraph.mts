import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { QUEST_SID, RANK, SQUADS } from "./squads.mts";

function root(sid: string, fields: Record<string, unknown>): Struct {
  const s = Struct.fromJson({ SID: sid, ...fields }) as unknown as Struct;
  s.__internal__.rawName = sid;
  s.__internal__.isRoot = true;
  return s;
}

/**
 * Starts the SpawnSquads quest from `rootgraph_Start` (the LairWarTest / DecoupledRanks pattern)
 * and adds one repeatable ConsoleCommand chain per squad: `SpawnSquad<Faction>[Friendly]` spawns
 * the first member and launches `<SID>_2` .. `<SID>_5`, one XSpawnObjBySID each. The head node has
 * no launchers; it runs only from `XStartQuestNodeBySID`.
 */
export const transformRootgraph: StructTransformer<Struct> = (struct) => {
  if (String(struct.SID) !== "rootgraph_Start") return null;

  const run = root(`rootgraph_run_${QUEST_SID}`, {
    QuestSID: "rootgraph",
    NodeType: "EQuestNodeType::ConsoleCommand",
    ConsoleCommand: `XStartQuestBySID ${QUEST_SID}`,
    Launchers: getLaunchers([{ SID: "rootgraph_Start" }]),
  });

  const squads = SQUADS.flatMap(({ sid, members }) =>
    members.map(({ prototypeSID, x, y, z, yaw }, i) =>
      root(i === 0 ? sid : `${sid}_${i + 1}`, {
        QuestSID: QUEST_SID,
        NodeType: "EQuestNodeType::ConsoleCommand",
        Repeatable: true,
        ...(i > 0 && { Launchers: getLaunchers([{ SID: i === 1 ? sid : `${sid}_${i}` }]) }),
        ConsoleCommand: `XSpawnObjBySID ${prototypeSID} ${RANK} 0 ${x} ${y} ${z} 0 ${yaw} 0`,
      }),
    ),
  );

  return [run, ...squads];
};

transformRootgraph.files = ["/QuestNodePrototypes/rootgraph.cfg"];

/** A quest SID missing from QuestPrototypes can never start. */
export const transformQuestPrototypes: StructTransformer<Struct> = (struct) => {
  if (String(struct.SID) !== "rootgraph") return null;
  return root(QUEST_SID, { DLC: "None" });
};

transformQuestPrototypes.files = ["/QuestPrototypes/rootgraph.cfg"];
