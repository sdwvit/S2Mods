import { QuestNodePrototypeConditions, QuestNodePrototypeConditionsItem, QuestNodePrototypeLaunchers, Struct } from "s2cfgtojson";

export const getLaunchers = (sids_names: { SID: string; Name: string | number }[]) => {
  return new Struct(
    Object.fromEntries(sids_names.map(({ SID, Name }, i) => [i, { Excluding: false, Connections: { 0: { SID, Name } } }])),
  ) as QuestNodePrototypeLaunchers;
};

export const getConditions = (conditions: Partial<QuestNodePrototypeConditionsItem>[]) =>
  Object.assign(
    new Struct(
      Object.fromEntries(
        conditions.map((condition, i) => {
          return [i, new Struct({ 0: new Struct(condition) })];
        }),
      ),
    ) as QuestNodePrototypeConditions,
    { ConditionCheckType: "EConditionCheckType::And" },
  ).fork(true);
