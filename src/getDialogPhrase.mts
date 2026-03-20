import { Struct } from "s2cfgtojson";
import type { DialogPrototype } from "s2cfgtojson";
export function getDialogPhrase(SID: string, chain: string, memberIndex: number, nextOptions: { sid: string; terminate: boolean }[]) {
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
  }) as DialogPrototype;
}

export function getWaitForReply(SID: string, chain: string, options: { sid: string; conditions?: any }[]) {
  const NextDialogOptions = new Struct();
  options.forEach(({ sid, conditions }) => {
    const opt: any = {
      NextDialogSID: sid,
      AvailableFromStart: true,
      VisibleOnFailedCondition: !conditions, // always visible if no conditions, hidden if condition fails
      MainReply: false,
      AnswerTo: -1,
      IncludeBy: "",
      ExcludeBy: "",
    };
    if (conditions) opt.Conditions = conditions;
    NextDialogOptions.addNode(new Struct(opt));
  });
  return new Struct({
    __internal__: { rawName: SID, isRoot: true },
    SID,
    DialogChainPrototypeSID: chain,
    DialogMemberIndex: -1,
    LocalizedSequences: new Struct({ 0: "", 1: "" }),
    LoopSequence: false,
    PreblendSequence: false,
    PreblendTime: 0.0,
    BlendExpForEaseInOut: 2.0,
    SpeechDuration: 0,
    ShowNextDialogOptionsAsAnswers: true,
    DialogMembersAnimations: new Struct(),
    NextDialogOptions,
    NodePrototypeVersion: 1,
  }) as DialogPrototype;
}
