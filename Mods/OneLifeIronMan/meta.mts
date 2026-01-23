import { MetaContext, MetaType } from "../../src/meta-type.mts";
import { QuestNodePrototype } from "s2cfgtojson";

export const meta: MetaType = {
  description: `
This mod introduces PermaDeath for all you hardcore people.
[hr][/hr]
Deletes save on death[h1][/h1]
`,
  changenote: "Initial release",
  structTransformers: [],
};

async function transformQuestNodePrototypes(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>) {
  const subscribeToSkifDeath = struct.fork();

  subscribeToSkifDeath.NodeType = 'EQuestNodeType::OnNPCDeathEvent';

}
