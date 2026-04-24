import type { Struct } from "s2cfgtojson";
import type { MetaType, StructTransformer } from "../../src/meta-type.mts";

const transformPrototypes: StructTransformer<Struct> = (struct) => {
  const s = struct as any;
  const hasQuestItem = s.IsQuestItem;
  const hasQuestItemPrototype = s.IsQuestItemPrototype;

  if (!hasQuestItem && !hasQuestItemPrototype) return null;

  const fork = struct.fork() as any;
  if (hasQuestItem) fork.IsQuestItem = false;
  if (hasQuestItemPrototype) fork.IsQuestItemPrototype = false;
  return fork;
};
transformPrototypes.files = [
  "/QuestItemPrototypes.cfg",
  "/ArtifactPrototypes.cfg",
  "/WeaponPrototypes.cfg",
  "/ConsumablePrototypes.cfg",
];

export const meta: MetaType<Struct> = {
  description: `Marks all quest items as non-quest, allowing you to drop, sell, and trade them freely.
[h3][/h3]
[hr][/hr]
[h3]Affected items:[/h3]
[list]
 [*] Quest Items (PDAs, keys, notes, etc.)
 [*] Quest Artifacts
 [*] Artifacts
 [*] Unique Weapons
 [*] Consumables
[/list]`,
  changenote: "Initial release",
  structTransformers: [transformPrototypes] as any,
};
