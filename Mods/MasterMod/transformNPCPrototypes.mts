import { NPCPrototype, Struct } from "s2cfgtojson";
import { GunDnipro_Upgrade_HoldBreathPos75Effect } from "./transformUpgradePrototypes.mts";
/**
 * Give Technicians some extra upgrades
 */
export async function transformNPCPrototypes(struct: NPCPrototype) {
  if (struct.SID === "garpia_0" || (struct.__internal__.refkey?.toString() || "") === "garpia_0") {
    const fork = struct.fork();
    fork.Upgrades = struct.Upgrades?.fork() ?? (new Struct() as NPCPrototype["Upgrades"]);
    fork.Upgrades.__internal__.bpatch = true;
    fork.Upgrades.addNode(
      new Struct({ UpgradePrototypeSID: GunDnipro_Upgrade_HoldBreathPos75Effect, Enabled: true }),
      GunDnipro_Upgrade_HoldBreathPos75Effect,
    );
    return fork;
  }
}
transformNPCPrototypes.files = ["/NPCPrototypes.cfg"];
