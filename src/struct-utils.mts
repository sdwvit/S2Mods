import { type QuestNodePrototype, Struct } from "s2cfgtojson";
import type {
  DialogPrototypeConditions,
  DialogPrototypeConditionsItem,
  DialogPrototypeConditionsItemItem,
  QuestNodePrototypeConditions,
  QuestNodePrototypeConditionsItem,
  QuestNodePrototypeConditionsItemItem,
  QuestNodePrototypeConnections,
  QuestNodePrototypeConnectionsItem,
  QuestNodePrototypeLaunchers,
  QuestNodePrototypeLaunchersItem,
} from "s2cfgtojson";
import type { DeeplyPartial } from "./consts.mts";
import type { MetaContext } from "./meta-type.mts";

export const getLaunchers = (
  sids_names: ((
    | DeeplyPartial<QuestNodePrototypeConnectionsItem>
    | DeeplyPartial<QuestNodePrototypeConnectionsItem>[]
  ) & { Excluding?: boolean })[],
) => {
  const Launchers = new Struct() as QuestNodePrototypeLaunchers;

  sids_names.map((questNodePrototypeConnectionsItemOrItems) => {
    const connections = new Struct() as QuestNodePrototypeLaunchersItem;
    connections.Excluding = questNodePrototypeConnectionsItemOrItems.Excluding ?? false;
    connections.Connections = new Struct() as QuestNodePrototypeConnections;
    if (Array.isArray(questNodePrototypeConnectionsItemOrItems)) {
      questNodePrototypeConnectionsItemOrItems.forEach((item) => {
        connections.Connections.addNode(new Struct(item) as QuestNodePrototypeConnectionsItem);
      });
    } else {
      const connection = new Struct({
        SID: questNodePrototypeConnectionsItemOrItems.SID,
        Name: questNodePrototypeConnectionsItemOrItems.Name ?? "",
      }) as QuestNodePrototypeConnectionsItem;

      connections.Connections.addNode(connection);
    }

    Launchers.addNode(connections);
  });

  return Launchers;
};

export function getDependants(SID: string, contextArr: QuestNodePrototype[]) {
  return contextArr.filter((s) => {
    let hasDependant = false;
    s.Launchers?.forEach?.(([, l]) => {
      l.Connections.forEach(([, c]) => {
        if (c.SID === SID) {
          hasDependant = true;
        }
      });
    });
    return hasDependant;
  });
}

export function getDialogPrototypeConditions(
  conditionOrConditions:
    | DeeplyPartial<DialogPrototypeConditionsItemItem>[]
    | DeeplyPartial<DialogPrototypeConditionsItemItem>,
) {
  const dialogPrototypeConditions = new Struct() as DialogPrototypeConditions;
  const dialogPrototypeConditionsItem = new Struct() as DialogPrototypeConditionsItem;
  if (Array.isArray(conditionOrConditions)) {
    conditionOrConditions.forEach((condition) =>
      dialogPrototypeConditionsItem.addNode(
        new Struct(condition) as DialogPrototypeConditionsItemItem,
      ),
    );
  } else {
    dialogPrototypeConditionsItem.addNode(
      new Struct(conditionOrConditions) as DialogPrototypeConditionsItemItem,
    );
  }
  dialogPrototypeConditions.addNode(dialogPrototypeConditionsItem);
  return dialogPrototypeConditions;
}

export function getConditions(
  conditions:
    | DeeplyPartial<QuestNodePrototypeConditionsItemItem>
    | DeeplyPartial<QuestNodePrototypeConditionsItemItem>[],
) {
  const questNodePrototypeConditions = new Struct() as QuestNodePrototypeConditions;
  questNodePrototypeConditions.ConditionCheckType = "EConditionCheckType::And";
  const questNodePrototypeConditionsItem = new Struct() as QuestNodePrototypeConditionsItem;
  if (Array.isArray(conditions)) {
    conditions.forEach((condition) =>
      questNodePrototypeConditionsItem.addNode(new Struct(condition)),
    );
  } else {
    questNodePrototypeConditionsItem.addNode(new Struct(conditions));
  }
  questNodePrototypeConditions.addNode(questNodePrototypeConditionsItem);
  return questNodePrototypeConditions;
}

const nextIndexByDependant = new Map<string, number>();

export function rerouteQuestNode(
  struct: QuestNodePrototype,
  context: MetaContext<QuestNodePrototype>,
  toReroute: Set<string>,
  extraDependantsByParentSID: Record<string, string[]> = {},
) {
  if (!struct.Launchers) {
    return;
  }

  const structFork = struct.fork();
  structFork.Launchers = new Struct() as any;
  const structs = [structFork];

  const traversedReroutes = new Set<string>();
  let dependants = new Set([struct.SID]);

  while (dependants.intersection(toReroute).size) {
    for (const dependantSID of dependants) {
      if (toReroute.has(dependantSID)) {
        traversedReroutes.add(dependantSID);
      }
      dependants.delete(dependantSID);
      dependants = dependants.union(
        new Set(getDependants(dependantSID, context.array).map((s) => s.SID)),
      );
    }
  }

  for (const sid of traversedReroutes) {
    const extras = extraDependantsByParentSID[sid];
    if (extras) {
      dependants = dependants.union(new Set(extras));
    }
  }

  for (const dependantSID of dependants) {
    const dependant = context.structsById[dependantSID];
    const dependantFork = dependant.fork();
    dependantFork.Launchers = dependant.Launchers.fork();
    let nextIndex = nextIndexByDependant.get(dependantSID) ?? dependant.Launchers.entries().length;
    struct.Launchers.forEach?.(([, l]) => {
      const launcher = l.fork();
      launcher.Connections ||= l.Connections.filter(([, c]) => !toReroute.has(c.SID));
      if (!launcher.Connections.entries().length) {
        return;
      }
      dependant.Launchers.forEach(([k, l]) =>
        l.Connections.forEach(([k2, c]) => {
          if (c.SID === struct.SID) {
            dependantFork.Launchers[k] ||= new Struct().fork() as any;
            dependantFork.Launchers[k].Connections ||= new Struct().fork() as any;
            dependantFork.Launchers[k].Connections[k2] = new Struct() as any;
          }
        }),
      );
      dependantFork.Launchers.addNode(launcher, nextIndex++);
    });
    nextIndexByDependant.set(dependantSID, nextIndex);
    structs.push(dependantFork);
  }

  return structs;
}
