import { Struct } from "s2cfgtojson";
import type { QuestItemPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { WARD_BADGE_SID } from "./transformItemGenerators.mts";

let once = false;

/**
 * A droppable, sellable copy of the vanilla Ward badge (`VartaDogtag`). It keeps the original's
 * name, description and icon through `LocalizationSID`; only `IsQuestItem` changes, the same way
 * vanilla's sellable PDAs in this file do it.
 */
export const transformQuestItemPrototypes: StructTransformer<QuestItemPrototype> = (struct) => {
  if (once || struct.SID !== "VartaDogtag") return null;
  once = true;
  const badge = new Struct() as QuestItemPrototype;
  badge.SID = WARD_BADGE_SID;
  badge.LocalizationSID = "VartaDogtag";
  badge.IsQuestItem = false;
  badge.__internal__.rawName = WARD_BADGE_SID;
  badge.__internal__.refkey = "VartaDogtag";
  badge.__internal__.isRoot = true;
  return [badge];
};

transformQuestItemPrototypes.files = ["/QuestItemPrototypes.cfg"];
