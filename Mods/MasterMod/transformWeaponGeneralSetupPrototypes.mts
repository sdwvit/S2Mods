import { Struct, WeaponGeneralSetupPrototype } from "s2cfgtojson";
import { EntriesTransformer, MetaContext } from "../../src/meta-type.mts";
import {
  allCompatibleAttachmentDefs,
  allCompatibleAttachmentDefsByWeaponGeneralSetupPrototypeSID,
  uniqueAttachmentsToAlternatives,
} from "./basicAttachments.mts";
import { getXnCompatibleScope } from "../X16Scopes/meta.mts";

function mapUniqueAttachmentsToGeneric(
  fork: WeaponGeneralSetupPrototype,
  struct: WeaponGeneralSetupPrototype,
  context: MetaContext<WeaponGeneralSetupPrototype>,
) {
  if (struct.PreinstalledAttachmentsItemPrototypeSIDs) {
    fork.PreinstalledAttachmentsItemPrototypeSIDs = struct.PreinstalledAttachmentsItemPrototypeSIDs.filter(
      ([_k, e]) => !!uniqueAttachmentsToAlternatives[e.AttachSID],
    ).map(([_k, e]) => {
      return Object.assign(e.fork(), {
        AttachSID: uniqueAttachmentsToAlternatives[e.AttachSID],
        bHiddenInInventory: false,
      });
    });

    fork.PreinstalledAttachmentsItemPrototypeSIDs.__internal__.bskipref = false;
    fork.PreinstalledAttachmentsItemPrototypeSIDs.__internal__.bpatch = true;

    if (!fork.PreinstalledAttachmentsItemPrototypeSIDs.entries().length) {
      delete fork.PreinstalledAttachmentsItemPrototypeSIDs;
    }
  }

  /**
   * 1. If a weapon has unique attachments, make it also compatible with standard alternatives.
   * 2. Additionally, if a weapon has a parent, use parent's compatible attachments too.
   * 3. Finally, combine them all, avoiding duplicates, and not messing up the keys.
   */
  if (struct.CompatibleAttachments) {
    fork.CompatibleAttachments ??= struct.CompatibleAttachments.fork();

    struct.CompatibleAttachments.filter(([_k, e]) => !!uniqueAttachmentsToAlternatives[e.AttachPrototypeSID]).forEach(([_k, e]) => {
      const newKey = uniqueAttachmentsToAlternatives[e.AttachPrototypeSID];
      fork.CompatibleAttachments.addNode(Object.assign(e.clone(), { AttachPrototypeSID: newKey }), newKey);
    });

    if (struct.SID === "Gun_Krivenko_HG_GS") {
      struct.__internal__.refkey = "GunUDP_HG";
    }
    let parent = context.structsById[struct.__internal__.refkey];

    while (parent && parent.CompatibleAttachments) {
      parent.CompatibleAttachments.forEach(([_k, e]) => {
        if (
          !fork.CompatibleAttachments[e.AttachPrototypeSID] &&
          !struct.CompatibleAttachments.entries().find(([_k2, e2]) => e2.AttachPrototypeSID === e.AttachPrototypeSID)
        ) {
          // no reassigning
          const newE = e.clone();
          delete newE.BlockingUpgradeIDs;
          fork.CompatibleAttachments.addNode(newE, e.AttachPrototypeSID);
        }
      });
      parent = context.structsById[parent.__internal__.refkey];
    }

    if (!fork.CompatibleAttachments.entries().length) {
      delete fork.CompatibleAttachments;
    }
  }
}

const getCompatibleAttachmentDefinition = (sid: string) =>
  new Struct(allCompatibleAttachmentDefs[sid]) as WeaponGeneralSetupPrototype["CompatibleAttachments"]["0"];
const getCompatibleAttachmentDefinitionByWeaponSetupSID = (weaponSid: string, sid: string) =>
  new Struct(
    allCompatibleAttachmentDefsByWeaponGeneralSetupPrototypeSID[weaponSid][sid],
  ) as WeaponGeneralSetupPrototype["CompatibleAttachments"]["0"];
/**
 * Enables removing attachments from unique weapons, as well as makes them compatible with ref weapon attachments.
 */
export const transformWeaponGeneralSetupPrototypes: EntriesTransformer<WeaponGeneralSetupPrototype> = async (struct, context) => {
  const fork = struct.fork();
  if (!struct.CompatibleAttachments) {
    return;
  }
  mapUniqueAttachmentsToGeneric(fork, struct, context);
  fork.CompatibleAttachments ||= struct.CompatibleAttachments.fork();
  fork.OffsetAimingConditionSID = "ConstTrue";
  fork.ToggleOffsetAimingConditionSID = "ConstTrue";

  const compX16 = getXnCompatibleScope(struct, 16);
  if (compX16) {
    fork.CompatibleAttachments.addNode(compX16, "X16");
  }
  const compX8 = getXnCompatibleScope(struct, 8);
  if (compX8) {
    fork.CompatibleAttachments.addNode(compX8, "X8");
  }

  // noinspection FallThroughInSwitchStatementJS
  switch (struct.SID) {
    case "GunUDP_Deadeye_HG":
      fork.UpgradePrototypeSIDs ||= struct.UpgradePrototypeSIDs.fork();
      fork.UpgradePrototypeSIDs.addNode("GunUDP_Upgrade_Attachment_Laser", "GunUDP_Upgrade_Attachment_Laser");
    case "GunUDP_HG":
    case "Gun_Krivenko_HG_GS":
      fork.CompatibleAttachments.addNode(
        Object.assign(getCompatibleAttachmentDefinition("EN_ColimScope_1"), {
          Socket: "ColimScopeSocket_corrected",
          WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/UDP/T_inv_w_en_colim_scope.T_inv_w_en_colim_scope'`,
        }),
        "EN_ColimScope_1",
      );
      return fork;
    case "Gun_Sharpshooter_AR_GS":
      fork.CompatibleAttachments.addNode(getCompatibleAttachmentDefinitionByWeaponSetupSID("GunM16_ST", "EN_GoloScope_1"), "EN_GoloScope_1");
      fork.CompatibleAttachments.addNode(getCompatibleAttachmentDefinitionByWeaponSetupSID("GunM16_ST", "EN_X4Scope_1"), "EN_X4Scope_1");
      return fork;
  }
  if (!fork.CompatibleAttachments.entries().length) {
    delete fork.CompatibleAttachments;
  }
  return fork;
};
transformWeaponGeneralSetupPrototypes.files = ["/WeaponGeneralSetupPrototypes.cfg"];
