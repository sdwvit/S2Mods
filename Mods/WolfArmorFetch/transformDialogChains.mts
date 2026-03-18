import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

function dialogChain(SID: string, startingSID: string, memberName: string, isPCMember: boolean) {
  const member = new Struct({ DialogMemberName: memberName, OptionalMember: false });
  const DialogMembers = new Struct();
  DialogMembers.addNode(member);

  return new Struct({
    __internal__: { rawName: SID, isRoot: true },
    SID,
    DLC: "None",
    StartingDialogPrototypeSID: startingSID,
    DialogOnTheGo: false,
    CanInterruptByCombat: false,
    CanInterruptByEmission: false,
    ContinueAfterInterrupt: true,
    IsInteractive: false,
    DialogMembers,
    IsPCDialogMember: isPCMember,
  });
}

let once = false;

export const transformDialogChains: StructTransformer<Struct> = (

) => {
  if (once) return;
  once = true;

  return [
    dialogChain("WolfArmorFetch_Dialog_Accept", "WolfArmorFetch_Dialog_Accept_Wolf_1", "volk_1", true),
    dialogChain("WolfArmorFetch_Dialog_TurnIn", "WolfArmorFetch_Dialog_TurnIn_Player_1", "volk_1", true),
  ];
};
transformDialogChains.files = ["/DialogChainPrototypes/RookieVillage_Hub_volk_1_InfoTopic_1.cfg"];
