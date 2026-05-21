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

function resolveReroutedConnections(
  connection: QuestNodePrototypeConnectionsItem,
  context: MetaContext<QuestNodePrototype>,
  toReroute: Set<string>,
  visited = new Set<string>(),
): QuestNodePrototypeConnectionsItem[] {
  if (!toReroute.has(connection.SID)) {
    return [connection.fork()];
  }

  if (visited.has(connection.SID)) {
    return [];
  }

  const reroutedStruct = context.structsById[connection.SID];
  if (!reroutedStruct?.Launchers) {
    return [];
  }

  visited.add(connection.SID);

  const resolvedConnections: QuestNodePrototypeConnectionsItem[] = [];
  const seenConnectionKeys = new Set<string>();

  reroutedStruct.Launchers.forEach?.(([, launcher]) => {
    launcher.Connections.forEach(([, nestedConnection]) => {
      for (const resolvedConnection of resolveReroutedConnections(
        nestedConnection,
        context,
        toReroute,
        visited,
      )) {
        const key = `${resolvedConnection.SID}\u0000${resolvedConnection.Name ?? ""}`;
        if (seenConnectionKeys.has(key)) {
          continue;
        }
        seenConnectionKeys.add(key);
        resolvedConnections.push(resolvedConnection);
      }
    });
  });

  visited.delete(connection.SID);

  return resolvedConnections;
}

/**
 * Rewires quest-node launcher connections so `struct` can be bypassed.
 *
 * Example before rerouting:
 * `someNode -> struct -> targetNode`
 *
 * Here `someNode` means any node returned by `getDependants(struct.SID, context.array)`.
 * The function patches `someNode` so it no longer launches `struct`. Instead, `someNode` gets
 * copies of `struct`'s launcher connections to `targetNode`.
 * The forked copy of `struct` has its `Launchers` cleared, so `struct` itself no longer launches
 * anything in the returned patch.
 *
 * Example after rerouting:
 * `someNode -> targetNode`
 *
 * If one of `struct`'s launcher targets is also in `toReroute`, the function follows that node's
 * launchers until it reaches targets that are not in `toReroute`, then copies those final targets
 * onto `someNode` instead.
 *
 * @param struct The node to bypass. Nodes that launch this node are patched to launch
 *   its targets instead, and this node's own `Launchers` are cleared.
 * @param context Lookup context for all quest nodes in the current transform pass, including
 *   `array` for finding upstream dependants and `structsById` for patching resolved nodes.
 * @param toReroute Node SIDs that should be bypassed when resolving `struct`'s launcher targets.
 *   Direct dependants of `struct` that are also in this set are skipped, because their own call to
 *   `rerouteQuestNode` is expected to patch them separately.
 * @param extraDependantsByParentSID Optional extra dependant SIDs keyed by rerouted parent SID.
 *   Use this when some edges are implicit or are not discoverable from launcher connections alone.
 */
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

  const dependants = new Set(getDependants(struct.SID, context.array).map((s) => s.SID));
  const extras = extraDependantsByParentSID[struct.SID];
  if (extras) {
    extras.forEach((sid) => dependants.add(sid));
  }

  for (const dependantSID of dependants) {
    if (toReroute.has(dependantSID)) {
      continue;
    }

    const dependant = context.structsById[dependantSID];
    const dependantFork = dependant.fork();
    dependantFork.Launchers = dependant.Launchers.fork();
    let nextIndex = nextIndexByDependant.get(dependantSID) ?? dependant.Launchers.entries().length;
    struct.Launchers.forEach?.(([, l]) => {
      const launcher = l.fork();
      launcher.Connections = new Struct() as any;
      const seenConnectionKeys = new Set<string>();

      l.Connections.forEach(([, connection]) => {
        for (const resolvedConnection of resolveReroutedConnections(connection, context, toReroute)) {
          const key = `${resolvedConnection.SID}\u0000${resolvedConnection.Name ?? ""}`;
          if (seenConnectionKeys.has(key)) {
            continue;
          }
          seenConnectionKeys.add(key);
          launcher.Connections.addNode(resolvedConnection);
        }
      });

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
