import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

function dialogPhrase(SID: string, chain: string, memberIndex: number, nextOptions: { sid: string; terminate: boolean }[]) {
  const animations = new Struct();
  animations.addNode(new Struct({ EmotionalState: "EEmotionalFaceMasks::None", LookAtTarget: -1, DialogAnimations: "" }));
  animations.addNode(new Struct({ EmotionalState: "EEmotionalFaceMasks::None", LookAtTarget: 0, DialogAnimations: "" }));

  const NextDialogOptions = new Struct();
  nextOptions.forEach(({ sid, terminate }) => NextDialogOptions.addNode(new Struct({ NextDialogSID: sid, Terminate: terminate })));

  return new Struct({
    __internal__: { rawName: SID, isRoot: true },
    SID,
    DialogChainPrototypeSID: chain,
    DialogMemberIndex: memberIndex,
    Unskippable: false,
    DialogMembersAnimations: animations,
    AKEventName: "",
    AKEventSubPath: "",
    NextDialogOptions,
    HasVOInSequence: false,
    VisibleOnFailedCondition: true,
    MainReply: true,
    DialogActions: "",
    NodePrototypeVersion: 1,
  });
}

let once = false;

const ACCEPT = "WolfArmorFetch_Dialog_Accept";
const TURNIN = "WolfArmorFetch_Dialog_TurnIn";

export const transformDialogPrototypes: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  return [
    // Wolf asks for armor → player picks accept or decline
    dialogPhrase(`${ACCEPT}_Wolf_1`, ACCEPT, 0, [
      { sid: `${ACCEPT}_Accepted_1`, terminate: false },
      { sid: `${ACCEPT}_Declined_1`, terminate: false },
    ]),
    // Player accepts
    dialogPhrase(`${ACCEPT}_Accepted_1`, ACCEPT, -1, [{ sid: "", terminate: true }]),
    // Player declines
    dialogPhrase(`${ACCEPT}_Declined_1`, ACCEPT, -1, [{ sid: "", terminate: true }]),
    // Player says "got your armor"
    dialogPhrase(`${TURNIN}_Player_1`, TURNIN, -1, [{ sid: `${TURNIN}_Done_1`, terminate: false }]),
    // Wolf confirms and rewards
    dialogPhrase(`${TURNIN}_Done_1`, TURNIN, 0, [{ sid: "", terminate: true }]),
  ];
};
transformDialogPrototypes.files = ["/DialogPrototypes/RookieVillage_Hub_volk_1_InfoTopic_1.cfg"];
