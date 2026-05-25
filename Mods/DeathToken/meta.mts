import type { MetaType } from "../../src/meta-type.mts";
import { addDeathTokenItem } from "./addDeathTokenItem.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";

export const meta: MetaType = {
  description: `
Grants a Death Token item to Skif's inventory each time he dies.[h1][/h1]
Tokens stack and persist as quest items, giving you a running count of deaths across your playthrough.[h1][/h1]
`,
  changenote: "Initial release",
  structTransformers: [addDeathTokenItem, transformQuestNodePrototypes],
};
