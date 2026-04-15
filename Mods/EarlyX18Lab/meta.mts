import type { MetaType } from "../../src/meta-type.mts";
import type { QuestNodePrototype } from "s2cfgtojson";
import { Struct } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";

async function transformQuestNodePrototypes(
  struct: QuestNodePrototype,
  context: MetaContext<QuestNodePrototype>,
) {
  // Remove main quest conditions from the SQ103 container so the quest starts on any tick
  if (struct.SID === "Garbage_L_Container_SQ103") {
    const fork = struct.fork();
    fork.Launchers = new Struct() as any;

    // Launcher 0: only require OnTickEvent (remove condition pin connections)
    const launcher0 = new Struct() as any;
    launcher0.Excluding = false;
    launcher0.Connections = new Struct() as any;
    const conn0 = new Struct() as any;
    conn0.SID = "Garbage_L_OnTickEvent_SQ103Start";
    conn0.Name = "";
    launcher0.Connections.addNode(conn0);
    fork.Launchers.addNode(launcher0);

    // Launcher 1 (excluding): keep the "already at GetToLab stage" guard
    const launcher1 = new Struct() as any;
    launcher1.Excluding = true;
    launcher1.Connections = new Struct() as any;
    const conn1 = new Struct() as any;
    conn1.SID = "Garbage_L_SetJournal_SQ103_Stage_GetToLab";
    conn1.Name = "";
    launcher1.Connections.addNode(conn1);
    fork.Launchers.addNode(launcher1);

    return fork;
  }

  // Disable orphaned condition nodes (strip launchers)
  if (
    struct.SID === "Garbage_L_Container_SQ103_Pin_0" ||
    struct.SID === "Garbage_L_Container_SQ103_Pin_2"
  ) {
    const fork = struct.fork();
    fork.Launchers = new Struct() as any;
    return fork;
  }
}
transformQuestNodePrototypes.files = [
  "GameLite/GameData/QuestNodePrototypes/Garbage_L.cfg",
];

export const meta: MetaType = {
  description: `
Removes the main quest progression gate from the X18 Lab side quest (SQ103).
Normally this quest only becomes available after completing E03_MQ06 and before E08_MQ01 starts.
With this mod, Diod's radio call can trigger at any point in the game.
`,
  changenote: "Initial release - remove main quest gate from SQ103 X18 Lab quest",
  structTransformers: [transformQuestNodePrototypes],
};
