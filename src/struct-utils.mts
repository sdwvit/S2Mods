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

export const getLaunchers = (
  sids_names: (
    | DeeplyPartial<QuestNodePrototypeConnectionsItem>
    | DeeplyPartial<QuestNodePrototypeConnectionsItem>[]
  )[],
) => {
  const Launchers = new Struct() as QuestNodePrototypeLaunchers;

  sids_names.map((questNodePrototypeConnectionsItemOrItems) => {
    const connections = new Struct() as QuestNodePrototypeLaunchersItem;
    connections.Excluding = false;
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
  return contextArr
    .filter((s) =>
      s.Launchers?.entries?.().some(([, l]) =>
        l.Connections.entries().some(([, c]) => c.SID === SID),
      ),
    )
    .map((s) => s.SID);
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
