import { Struct } from "s2cfgtojson";
import type { WeaponGeneralSetupPrototype } from "s2cfgtojson";
import {
  forkThreeLineSetupWithVisibleScope,
  wholePreinstalledList,
} from "../UberToz/threeLineScope.mts";
import { SCOPE_SID } from "./consts.mts";

/** The Three-Line's own scope entry. Drahunka shares its skeleton, so the sockets and the weapon icon overlay apply as they are. */
const drahunkaScope = new Struct({
  AttachPrototypeSID: SCOPE_SID,
  Socket: "X4ScopeSocket",
  IconPosX: 60,
  IconPosY: 0,
  AimMuzzleVFXSocket: "X4ScopeMuzzle",
  AimShellShutterVFXSocket: "X4ScopeShells",
  WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/ThreeLine/T_inv_w_threeline_en_x4scope_1.T_inv_w_threeline_en_x4scope_1'`,
});

/**
 * Drahunka (GunGonta_SP_GS) copies the Three-Line's attachment list minus the PU scope. Puts the scope back
 * and spawns new Drahunkas with it mounted. The Three-Line's built-in scope becomes a regular, visible
 * attachment, so owners of an existing Drahunka can take one off a Three-Line.
 *
 * The Three-Line patch and the scope item are shared with UberToz (../UberToz/threeLineScope.mts).
 */
export function transformWeaponGeneralSetupPrototypes(struct: WeaponGeneralSetupPrototype) {
  if (struct.SID === "GunGonta_SP_GS") {
    const fork = struct.fork();
    fork.CompatibleAttachments = new Struct() as any;
    fork.CompatibleAttachments.__internal__.bpatch = true;
    fork.CompatibleAttachments.addNode(drahunkaScope, SCOPE_SID);
    fork.PreinstalledAttachmentsItemPrototypeSIDs = wholePreinstalledList(struct);
    fork.PreinstalledAttachmentsItemPrototypeSIDs.addNode(
      new Struct({ AttachSID: SCOPE_SID, bHiddenInInventory: false }),
    );
    return fork;
  }
  if (struct.SID === "GunThreeLine_SP_GS") {
    return forkThreeLineSetupWithVisibleScope(struct);
  }
  return null;
}

transformWeaponGeneralSetupPrototypes.files = ["/WeaponGeneralSetupPrototypes.cfg"];
