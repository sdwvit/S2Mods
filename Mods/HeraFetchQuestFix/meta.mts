import type { MetaType } from "../../src/meta-type.mts";
import type { QuestNodePrototype } from "s2cfgtojson";
import { Struct } from "s2cfgtojson";
import type {
  QuestNodePrototypeConnections,
  QuestNodePrototypeConnectionsItem,
  QuestNodePrototypeLaunchers,
  QuestNodePrototypeLaunchersItem,
} from "s2cfgtojson";

export const meta: MetaType<QuestNodePrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Fixes the vanilla bug where Hera's package delivery quest (RSQ07_C05_B_B) doesn't formally complete after turn-in.
[hr][/hr]
[h3]Problem:[/h3]
After delivering the package and receiving money, the quest stays active with a “Return to Hera” marker. Hera won't offer new jobs or allow cancellation.
[h3]Fix:[/h3]
Removes circular node references in the quest's turn-in flow that prevented proper completion.
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer(struct: QuestNodePrototype) {
  if (struct.SID === "RSQ07_C05_B_B_Technical_18") {
    // Original: Launchers [0]=SetDialog (circular back-ref), [1]=Technical_4
    // Fix: Remove circular SetDialog reference, keep only Technical_4
    const fork = struct.fork();
    fork.Launchers = makeLaunchers([
      { Excluding: false, SID: "RSQ07_C05_B_B_Technical_4", Name: "" },
    ]);
    return fork;
  }

  if (struct.SID === "RSQ07_C05_B_B_Technical_20") {
    // Original: Launchers [0]=SetDialog (circular), [1-3]=Excluding NPC events, [4]=Technical_4
    // Fix: Remove circular SetDialog reference, keep NPC event excludes and Technical_4
    const fork = struct.fork();
    fork.Launchers = makeLaunchers([
      { Excluding: true, SID: "RSQ07_C05_B_B_OnNPCCreateEvent_BP_SquadPlaceholder_B_B_C05_V2", Name: "" },
      { Excluding: true, SID: "RSQ07_C05_B_B_OnNPCCreateEvent_BP_SquadPlaceholder_B_B_C05_V3", Name: "" },
      { Excluding: true, SID: "RSQ07_C05_B_B_OnNPCCreateEvent_BP_SquadPlaceholder_B_B_C05_V4", Name: "" },
      { Excluding: false, SID: "RSQ07_C05_B_B_Technical_4", Name: "" },
    ]);
    return fork;
  }

  return null;
}

structTransformer.files = ["/QuestNodePrototypes/RSQ07_C05_B_B.cfg"];

function makeLaunchers(
  items: { Excluding: boolean; SID: string; Name: string }[],
) {
  const launchers = new Struct() as QuestNodePrototypeLaunchers;
  for (const item of items) {
    const launcherItem = new Struct() as QuestNodePrototypeLaunchersItem;
    launcherItem.Excluding = item.Excluding;
    launcherItem.Connections = new Struct() as QuestNodePrototypeConnections;
    const connection = new Struct({
      SID: item.SID,
      Name: item.Name,
    }) as QuestNodePrototypeConnectionsItem;
    launcherItem.Connections.addNode(connection);
    launchers.addNode(launcherItem);
  }
  return launchers;
}
