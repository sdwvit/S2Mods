import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { chainSID, characterOf, lineSID } from "./dialog.mts";
import { ALL_TOPICS } from "./topics.mts";

function dialogChain(SID: string, startingSID: string, memberName: string, comment: boolean) {
  const member = new Struct({ DialogMemberName: memberName, OptionalMember: false });
  const DialogMembers = new Struct();
  DialogMembers.addNode(member);

  return new Struct({
    __internal__: { rawName: SID, isRoot: true },
    SID,
    // A base-game chain: its <SID>_Voiceover / _FaceAnimation (voice/runtime-data.mts) are found through the vanilla
    // PAK_Quest_BaseGame label, which the mod overrides with them added (voice/label-override.mts).
    DLC: "None",
    StartingDialogPrototypeSID: startingSID,
    // A comment is said on the go, without the player, as vanilla SQ18_Comment_Gnutyj_Sum_Coming.
    DialogOnTheGo: comment,
    CanInterruptByCombat: comment,
    CanInterruptByEmission: comment,
    // Always true: only the interrupt path for continuing chains stops the face animation; a comment cut off by
    // combat otherwise kept moving its mouth (vanilla comments do the same, e.g. SQ03_Comment_RosaAfterFight).
    ContinueAfterInterrupt: true,
    IsInteractive: false,
    DialogMembers,
    IsPCDialogMember: !comment,
  });
}

let once = false;

export const transformDialogChains: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  return ALL_TOPICS.map((topic) => dialogChain(chainSID(topic), lineSID(topic, topic.opening, 0), characterOf(topic), !!topic.comment));
};
transformDialogChains.files = ["/DialogChainPrototypes/RookieVillage_Hub_volk_1_InfoTopic_1.cfg"];
