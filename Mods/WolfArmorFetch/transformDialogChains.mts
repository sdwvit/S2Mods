import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { TOPICS, WOLF_CHARACTER, chainSID, lineSID } from "./dialog.mts";

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

export const transformDialogChains: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  return TOPICS.map((topic) => dialogChain(chainSID(topic), lineSID(topic, topic.opening, 0), WOLF_CHARACTER, true));
};
transformDialogChains.files = ["/DialogChainPrototypes/RookieVillage_Hub_volk_1_InfoTopic_1.cfg"];
