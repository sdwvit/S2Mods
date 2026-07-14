import {
  type QuestNodePrototype,
  type QuestNodePrototypeCondition,
  type QuestNodePrototypeRandom,
  Struct,
} from "s2cfgtojson";
import { getLaunchers } from "../../src/struct-utils.mts";

/**
 * MoreSideQuestOptions — surface every repeatable side quest at once, using the
 * untouched vanilla take / complete / turn-in flow.
 *
 * Vanilla offers a random rotation of (up to 3) quests per vendor:
 *   `_Random` weighted-picks one `_If_CXX_NotAdded` guard → if its conditions pass it
 *   fires the `_Add_CXX` Technical node. Each `_Add_CXX` does two things:
 *     1. satisfies the dialog option's `Bridge <Add_CXX> Equal` condition, so the
 *        option becomes visible in the vendor's quest-pack dialog, and
 *     2. arms the quest Container's `Pin_0` condition, so confirming that option in
 *        dialog starts the corresponding sub-quest.
 *
 * To surface ALL options we keep those vanilla `_If_*_NotAdded` guards but evaluate them
 * at quest start instead of via the random rotation (which we disable — it would
 * otherwise spin forever re-rolling into already-added branches). We do that by
 * repointing each guard's now-dead `_Random` launcher to the quest `_Start` node — the
 * exact way vanilla already launches its own `*_If_1` guard. Routing through the guards
 * (rather than force-firing the Adds) preserves each quest's vanilla availability rules:
 * repeatable quests pass and get added, while one-time "special task" quests stay gated
 * behind their completion bridge so they are NOT re-offered once finished.
 *
 * For RSQ08's Duty kill quest we also drop the main-quest gate (condition group it adds
 * for E08_MQ01) so it appears regardless of main-quest progress, keeping its completion
 * guard intact.
 */
export function transformQuestNodePrototypes(struct: QuestNodePrototype) {
  // Disable the random rotation entirely (would otherwise spin once all quests are added).
  if (struct.NodeType === "EQuestNodeType::Random") {
    const fork = struct.fork() as QuestNodePrototypeRandom;
    fork.Launchers = new Struct() as QuestNodePrototypeRandom["Launchers"];
    return fork;
  }

  // Evaluate every vanilla "is this quest addable?" guard at quest start, by repointing
  // its `_Random` launcher to the quest `_Start` node.
  if (struct.NodeType === "EQuestNodeType::If" && /_If_C\d+_NotAdded(_\d+)?$/.test(struct.SID)) {
    const fork = struct.fork() as QuestNodePrototypeCondition;
    fork.Launchers = repointRandomToStart(struct.Launchers);

    // Remove E08_MQ01 main quest gate from RSQ08 Duty kill quest so it appears in rotation.
    if (struct.SID === "RSQ08_C00_ROSTOK_If_C09_NotAdded") {
      fork.Conditions = (struct as QuestNodePrototypeCondition).Conditions.filter(
        ([key]: [string, unknown]) => key !== "3",
      );
      fork.Conditions.__internal__.bpatch = false;
    }
    return fork;
  }
}

/**
 * Rebuild a guard's launchers, replacing any connection to a `*_Random` node with one
 * to the matching `*_Start` node (Random and Start share the vendor SID prefix). Keeps
 * every other launcher (e.g. the guard's self re-evaluation off its `_Add` node) intact.
 */
function repointRandomToStart(launchers: unknown) {
  const entries: { SID: string; Name: string; Excluding: boolean }[] = [];
  if (launchers instanceof Struct) {
    for (const [, launcher] of launchers.entries() as [string, any][]) {
      if (!(launcher.Connections instanceof Struct)) continue;
      for (const [, conn] of launcher.Connections.entries() as [string, any][]) {
        const isRandom = /_Random$/.test(conn.SID);
        entries.push({
          SID: isRandom ? conn.SID.replace(/_Random$/, "_Start") : conn.SID,
          Name: isRandom ? "" : conn.Name ?? "",
          Excluding: launcher.Excluding ?? false,
        });
      }
    }
  }
  return getLaunchers(entries) as QuestNodePrototypeCondition["Launchers"];
}

transformQuestNodePrototypes.files = [
  "/QuestNodePrototypes/RSQ01.cfg",
  "/QuestNodePrototypes/RSQ04.cfg",
  "/QuestNodePrototypes/RSQ05.cfg",
  "/QuestNodePrototypes/RSQ06_C00___SIDOROVICH.cfg",
  "/QuestNodePrototypes/RSQ07_C00_TSEMZAVOD.cfg",
  "/QuestNodePrototypes/RSQ08_C00_ROSTOK.cfg",
  "/QuestNodePrototypes/RSQ09_C00_MALAHIT.cfg",
  "/QuestNodePrototypes/RSQ10_C00_HARPY.cfg",
];
