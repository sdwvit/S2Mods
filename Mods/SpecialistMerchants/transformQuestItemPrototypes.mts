import type { QuestItemPrototype } from "s2cfgtojson";

import type { StructTransformer } from "../../src/meta-type.mts";

/**
 * Lab X18 electronics props are sellable loot. As EItemType::Info every trader bought them.
 * EItemType::Detector is blocked for bartenders, medics, general traders and guides, so only
 * technicians and regular stalkers buy them. Equip slot (ItemSlotType) and sorting (SortGroup)
 * are separate fields, so the props stay plain inventory items.
 */
export const transformQuestItemPrototypes: StructTransformer<QuestItemPrototype> = async (struct) => {
  if (!technicianOnlyQuestItemSIDs.has(struct.SID)) return null;
  return Object.assign(struct.fork(), { Type: "EItemType::Detector" });
};
transformQuestItemPrototypes.files = ["/QuestItemPrototypes.cfg"];

export const technicianOnlyQuestItemSIDs = new Set([
  "SQ103_CircuitBoard",
  "SQ103_BrokenDashboard",
  "SQ103_Oscilloscope",
  "SQ103_Voltpannel",
  "SQ103_Voltmeter",
  "SQ103_Powerbank",
  "SQ103_OldMonitor",
  "SQ103_DashboardPiece",
]);
