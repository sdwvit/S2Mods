import { Struct, UpgradePrototype } from "s2cfgtojson";
import { EntriesTransformer } from "../../src/meta-type.mts";

let once = false;

export const GunDnipro_Upgrade_HoldBreathPos75Effect = "GunDnipro_Upgrade_HoldBreathPos75Effect";
/**
 * Unlocks blocking upgrades.
 */
export const transformUpgradePrototypes: EntriesTransformer<UpgradePrototype> = async (struct) => {
  if (struct.SID === "empty") {
    return Object.assign(struct.fork(), {
      RepairCostModifier: `0.02f`,
    });
  }
  const extraStructs = [];
  if (!once) {
    once = true;
    const dniproHoldBreath = new Struct(`
      ${GunDnipro_Upgrade_HoldBreathPos75Effect} : struct.begin {refkey=[0]}
         SID = ${GunDnipro_Upgrade_HoldBreathPos75Effect}
         Text = sid_upgrades_GunG37_Upgrade_Stock_2_2_name
         Hint = sid_upgrades_GunG37_Upgrade_Stock_2_2_description
         Image = Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/PDA/Upgrades/Weapons/Assault/G37/Stock/Upgrade/T_GP_upgr_11.T_GP_upgr_11'
         Icon = Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/PDA/Upgrades/Icons/T_PDA_Upgrades_Icon_Breath-holding.T_PDA_Upgrades_Icon_Breath-holding'
         BaseCost = 8200
         HorizontalPosition = 2
         VerticalPosition = EUpgradeVerticalPosition::Down
         UpgradeTargetPart = EUpgradeTargetPartType::Stock
         EffectPrototypeSIDs : struct.begin
            [0] = HoldBreathPos75Effect
         struct.end
         ConnectionLines : struct.begin
            [0] = EConnectionLineState::Top
         struct.end
      struct.end
    `) as UpgradePrototype;
    extraStructs.push(dniproHoldBreath);
  }
  const fork = struct.fork();
  if (struct.BlockingUpgradePrototypeSIDs?.entries().length) {
    Object.assign(fork, {
      BlockingUpgradePrototypeSIDs: struct.BlockingUpgradePrototypeSIDs.map(() => "empty"),
    });
    fork.BlockingUpgradePrototypeSIDs.__internal__.bpatch = true;
  }
  if (struct.InterchangeableUpgradePrototypeSIDs?.entries().length /*&& !struct.AttachPrototypeSIDs?.entries().length*/) {
    Object.assign(fork, {
      InterchangeableUpgradePrototypeSIDs: struct.InterchangeableUpgradePrototypeSIDs.map(() => "empty"),
    });
    fork.InterchangeableUpgradePrototypeSIDs.__internal__.bpatch = true;
  }
  if (fork.entries().length) {
    extraStructs.push(fork);
  }
  return extraStructs;
};
transformUpgradePrototypes.files = ["/UpgradePrototypes.cfg"];
