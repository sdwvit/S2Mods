import { QuestItemPrototype } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";

/**
 * Remove an essential flag from various items
 */
export const transformQuestItemPrototypes: StructTransformer<QuestItemPrototype> = async (struct) => {
  if (struct.IsQuestItem) {
    return Object.assign(struct.fork(), { IsQuestItem: false });
  }
  return null;
};
transformQuestItemPrototypes.files = ["/QuestItemPrototypes.cfg"];
