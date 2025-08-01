import {
  EChangeValueMode,
  EConditionComparance,
  EDialogAction,
  EDialogAnimationType,
  EEmotionalFaceMasks,
  EQuestConditionType,
  EQuestNodeType,
  GetStructType,
  Struct,
} from "s2cfgtojson";
import { Meta } from "../../helpers/prepare-configs.mjs";
import * as fs from "node:fs";

type StructType = GetStructType<{
  SID: string;
  InGameHours?: number;
  DialogChainPrototypeSID: string;
  DialogMemberIndex: number;
  NextDialogOptions: {
    True: {
      Conditions: {
        "0": {
          "0": {
            ConditionType: EQuestConditionType;
            ConditionComparance: string;
            GlobalVariablePrototypeSID: "RSQ06_SidorovichQuest";
            ChangeValueMode: "EChangeValueMode::Set";
            VariableValue: 0;
            LinkedNodePrototypeSID?: string;
            CompletedNodeLauncherNames?: string[];
          };
        };
      };
      NextDialogSID: "RSQ06_Dialog_Sidorovich_RSQ_haveJob_41219";
      Terminate: "false";
    };
    False: {
      NextDialogSID: "RSQ06_Dialog_Sidorovich_RSQ_RSQ06_Dialog_Sidorovich_No_Job_Postpone_41865";
      Terminate: "false";
    };
  };
  NodePrototypeVersion: number;
  QuestSID: "RSQ06_C00___SIDOROVICH";
  NodeType: EQuestNodeType;
  Launchers: {
    "0": {
      Excluding: "false";
      Connections: {
        "0": {
          SID: string;
          Name: "";
        };
      };
    };
  };
  Conditions: {
    ConditionType: EQuestConditionType;
    ConditionComparance: EConditionComparance;
    GlobalVariablePrototypeSID: string;
    ChangeValueMode: EChangeValueMode;
    VariableValue: number;
    JournalQuestSID?: string;
    LinkedNodePrototypeSID?: string;
    JournalState?: string;
    CompletedNodeLauncherNames?: string[];
  }[][];
  Repeatable: "true";
  LastPhrases?: {
    LastPhraseSID: string;
    FinishNode: string;
  }[];
  ContaineredQuestPrototypeSID?: string;
  GlobalVariablePrototypeSID?: string;
  VariableValue?: string | number;
  ChangeValueMode?: EChangeValueMode;
}>;

export const meta: Meta<StructType> = {
  changenote: "",
  description: "",
  entriesTransformer: (entries: StructType["entries"], context) => {
    if (context.file.includes("RSQ06_C00___SIDOROVICH.cfg")) {
      if (entries.InGameHours) {
        entries.InGameHours = 0;
      }
      /**
       * RSQ06_SidorovichQuest indicates how many tasks Sidorovich has for the player.
       *
       */

      if (entries.SID === "RSQ06_C00___SIDOROVICH_If_LessThen3Tasks" || entries.SID === "RSQ06_C00___SIDOROVICH_If") {
        const interest = entries.Conditions.entries["0"].entries["0"].entries;
        interest.VariableValue = 5; /** 5 - is max for now */
      }
    }
    if (context.file.includes("RSQ06_Dialog_Sidorovich_RSQ.cfg")) {
      /*if (entries.SID === "RSQ06_Dialog_Sidorovich_RSQ_If" || entries.SID === "RSQ06_Dialog_Sidorovich_RSQ_If_1") {
        const interest = entries.NextDialogOptions.entries.True.entries.Conditions.entries["0"].entries["0"].entries;
        interest.ConditionType = "EQuestConditionType::GlobalVariable";
        interest.ConditionComparance = "EConditionComparance::NotEqual";
        interest.GlobalVariablePrototypeSID = "RSQ06_SidorovichQuest";
        interest.ChangeValueMode = "EChangeValueMode::Set";
        interest.VariableValue = -1;
        delete interest.LinkedNodePrototypeSID;
        delete interest.CompletedNodeLauncherNames;
      }*/

      const entriesT = entries as unknown as DialogStructType["entries"];

      if (entriesT.VisibleOnFailedCondition !== undefined) {
        entriesT.VisibleOnFailedCondition = true;
      }
      if (entriesT.NextDialogOptions) {
        Object.values(entriesT.NextDialogOptions.entries)
          .filter((e) => e.entries)
          .forEach((nextDialogOption) => {
            nextDialogOption.entries.VisibleOnFailedCondition = true;
          });
      }
    }
    return entries;
  },
  interestingContents: [],
  interestingFiles: [
    "QuestNodePrototypes/RSQ06_C00___SIDOROVICH.cfg",
    "DialogPrototypes/RSQ06_Dialog_Sidorovich_RSQ.cfg",
  ],
  interestingIds: [],
  onFinish(structs: StructType[], { file }) {
    if (file.includes("QuestNodePrototypes/RSQ06_C00___SIDOROVICH.cfg")) {
      processRSQ06(structs);
    }
    if (file.includes("DialogPrototypes/RSQ06_Dialog_Sidorovich_RSQ.cfg")) {
      processRSQ06_Dialog_Sidorovich_RSQ(structs as unknown as DialogStructType[]);
    }
  },
  prohibitedIds: [],
};

type DialogStructType = GetStructType<{
  SID: string;
  DialogChainPrototypeSID: "RSQ06_Dialog_Sidorovich_RSQ";
  DialogMemberIndex: number;
  Unskippable?: boolean;
  DialogMembersAnimations?: {
    EmotionalState: EEmotionalFaceMasks;
    LookAtTarget?: number;
    DialogAnimations:
      | ""
      | {
          GestureTiming: number[];
          DialogAnimationType: EDialogAnimationType;
        }[];
  }[];
  AKEventName?: string;
  AKEventSubPath?: string;
  NextDialogOptions: Record<
    number | "True" | "False",
    {
      NextDialogSID: string;
      Terminate?: boolean;
      AvailableFromStart?: boolean;
      VisibleOnFailedCondition?: boolean;
      MainReply?: boolean;
      AnswerTo?: number;
      IncludeBy?: "";
      ExcludeBy?: "";
      Conditions?: {
        ConditionType: EQuestConditionType;
        ConditionComparance: EConditionComparance;
        LinkedNodePrototypeSID?: string;
        GlobalVariablePrototypeSID?: string;
        CompletedNodeLauncherNames?: ""[];

        ChangeValueMode?: EChangeValueMode;
        VariableValue?: number;
      }[][];
    }
  >;
  HasVOInSequence?: boolean;
  DialogActions?: "" | { DialogAction: EDialogAction }[];
  DialogAnswerActions?: {
    DialogAction: EDialogAction;
    DialogActionParam?: { VariableType: "EGlobalVariableType::Int"; VariableValue: number };
  }[];
  NodePrototypeVersion: number;
  FaceAnimationSubPath?: string;
  FaceAnimationAssetName?: string;
  Conditions?: {
    ConditionType: EQuestConditionType;
    ConditionComparance: EConditionComparance;
    LinkedNodePrototypeSID: string;
    CompletedNodeLauncherNames: ""[];
  }[][];

  LocalizedSequences?: ""[];
  LoopSequence?: boolean;
  PreblendSequence?: boolean;
  PreblendTime?: number;
  BlendExpForEaseInOut?: number;
  SpeechDuration?: number;
  ShowNextDialogOptionsAsAnswers?: boolean;
  VisibleOnFailedCondition?: boolean;
}>;

function processRSQ06_Dialog_Sidorovich_RSQ(structs: DialogStructType[]) {
  const tree = structs.reduce(
    (mem, s) => {
      mem[s.entries.SID] ||= s;
      s["children"] ||= [];
      return mem;
    },
    {} as Record<string, DialogStructType>,
  );

  const renderOne = (v: DialogStructType) => {
    let res = "";

    if (v.entries.DialogActions) {
      Object.values(v.entries.DialogActions.entries)
        .filter((e) => e.entries)
        .forEach((e) => {
          if (e.entries.DialogAction === "EDialogAction::SideQuest") {
            res += `runQuest();`;
          } else if (e.entries.DialogAction === "EDialogAction::ShowMoney") {
            res += `showMoney();`;
          }
        });
    }

    Object.values(v.entries.NextDialogOptions.entries)
      .filter((nextDialogOption) => nextDialogOption.entries)
      .forEach((nextDialogOption) => {
        if (nextDialogOption.entries.Conditions) {
          res += `if (${getCondition(nextDialogOption)}) {`;
        }
        if (nextDialogOption.entries.Terminate) {
          res ||= 'const output = "";';
          res += `if (output === ${nextDialogOption.entries.NextDialogSID || "noop"}()) {\nreturn exit();}`;
        } else {
          res += `${nextDialogOption.entries.NextDialogSID || "noop"}();`;
        }
        if (nextDialogOption.entries.Conditions) {
          res += "} else ";
        }
      });
    return res;
  };
  const context = `
        const runQuest = (id) => {
          console.log('Launching quest "'  + id + '"');
          return id;
        }
        const showMoney = () => {
          console.log('Showing money');
        }
        const noop = () => {};
        const exit = () => {
          console.log('Exiting dialog');
          return "";
        }
        const outputOf = (id) => {
          console.log('Getting output of "'  + id + '"');
          return id;
        }
        const RSQ06_SidorovichQuest = 0;
        const RSQ06_C00___SIDOROVICH_Add_C01 = '';
        const RSQ06_C00___SIDOROVICH_Add_C02 = '';
        const RSQ06_C00___SIDOROVICH_Add_C03 = '';
        const RSQ06_C00___SIDOROVICH_Add_C04 = '';
        const RSQ06_C00___SIDOROVICH_Add_C05 = '';
        const RSQ06_C00___SIDOROVICH_Add_C06 = '';
        const RSQ06_C00___SIDOROVICH_Add_C07 = '';
        const RSQ06_C00___SIDOROVICH_Add_C08 = '';
        const RSQ06_C00___SIDOROVICH_Add_C09 = '';
        const RSQ06_C00___SIDOROVICH_Technical_GetQuest = noop;
  `;
  const syntax =
    context +
    Object.values(tree)
      .map((v) => `const ${v.entries.SID}=()=>{${renderOne(v)}};`)
      .join("\n");
  fs.writeFileSync("/home/sdwvit/.config/JetBrains/IntelliJIdea2025.1/scratches/2.js", syntax);
}

function processRSQ06(structs: StructType[]) {
  const tree = structs.reduce(
    (mem, s) => {
      mem[s.entries.SID] ||= s;
      s["children"] ||= [];
      return mem;
    },
    {} as Record<string, StructType>,
  );
  Object.values(tree).forEach((value) => {
    if (value.entries.Launchers) {
      Object.values(value.entries.Launchers.entries).forEach((launcher) => {
        if (!launcher.entries) return;
        Object.values(launcher.entries.Connections.entries).forEach((connection) => {
          if (!connection.entries) return;
          tree[connection.entries.SID]["children"] ||= [];
          tree[connection.entries.SID]["children"].push([value, connection.entries.Name]);
        });
      });
    }
  });
  const context = `
        const runQuest = (id) => {
          console.log('Launching quest "'  + id + '"');
          return id;
        }
        const addPhrase = (id, shouldEnd) => {
          console.log('Adding dialog ' + id + shouldEnd ? ' (ends dialog)' : '');
          return id;
        }
        const emit = (id) => {
          console.log('Emitting event "'  + id + '"');
          return id;
        }
        const clearPhrases = () => {};
        const outputOf = (id) => id;
        let RSQ06_SidorovichQuest = 0;
        const None = 'None';
        const False = false;
        const True = true;
        let RSQ06_PreviousTask = 0;
        let RSQ06 = '';
        const RSQ06_C01___K_Z = '';
        const RSQ06_C02___K_M = '';
        const RSQ06_C03___K_B = '';
        const RSQ06_C07___B_A = '';
        const RSQ06_C09___S_P = '';
        const RSQ06_C08___B_A = '';
        const RSQ06_C04___K_S = '';
        const RSQ06_C05___B_B = '';
        const RSQ06_C06___B_A = '';
        const RSQ06_C08___B_A_End = '';
        const RSQ06_C01___K_Z_End = '';
        const RSQ06_C02___K_M_End = '';
        const RSQ06_C03___K_B_End = '';
        const RSQ06_C09___S_P_End = '';
        const RSQ06_C07___B_A_End = '';
        const RSQ06_C06___B_A_End = '';
        const RSQ06_C04___K_S_End = '';
        const RSQ06_C05___B_B_End = '';
        const RSQ06_Dialog_Sidorovich_RSQ_confirm_54067_5 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_confirm_54067_8 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_confirm_54067_6 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_confirm_54067_7 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_confirm_54067 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_confirm_54067_1 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_confirm_54067_2 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_confirm_54067_3 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_confirm_54067_4 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_cancel_job_cancel_41273 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_RSQ06_Dialog_Sidorovich_No_Job_Postpone_41865 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_NotGet_63684 = '';
        const RSQ06_Dialog_Sidorovich_RSQ_cancel_job_confirm_41270 = '';
        const RSQ06_Dialog_Sidorovich_DeclineJob_RSQ06_Dialog_Sidorovich_RSQ_cancel_job_cancel_41273 = '';
        const RSQ06_Dialog_Sidorovich_DeclineJob_RSQ06_Dialog_Sidorovich_RSQ_cancel_job_confirm_41270 = '';
        const RSQ06_C09___S_P_SetJournal_RSQ06 = '';
      `;

  const renderOneBody = (v: StructType) => {
    let res = "";
    switch (v.entries.NodeType) {
      case "EQuestNodeType::End":
      case "EQuestNodeType::Technical":
      case "EQuestNodeType::SetItemGenerator":
      case "EQuestNodeType::SetTimer":
      case "EQuestNodeType::OnTickEvent":
      case "EQuestNodeType::BridgeCleanUp":
        break;
      case "EQuestNodeType::Random":
        res += "const output = Math.floor(Math.random() * 10);";
        break;
      case "EQuestNodeType::Condition":
        return `if (${getCondition(v)}) { ${renderChildren(v)} }`;
      case "EQuestNodeType::If":
        res += `const output = ${getCondition(v)};`;
        Object.values(v.entries.Conditions.entries)
          .filter((e) => e.entries)
          .map((e) => Object.values(e.entries))
          .flat()
          .filter((e) => e._id)
          .forEach((e) => {
            /* if (e.entries.ChangeValueMode) {
              res += `if (output) ${e.entries.GlobalVariablePrototypeSID}${getAssignment(e)}${e.entries.VariableValue};`;
            }*/
          });
        break;
      case "EQuestNodeType::SetDialog":
        res += "let output = '';";
        res += Object.values(v.entries.LastPhrases?.entries)
          .filter((lp) => lp.entries?.LastPhraseSID)
          .map((lp) => `addPhrase(${lp.entries?.LastPhraseSID}, ${lp.entries.FinishNode});`)
          .join("\n");
        break;
      case "EQuestNodeType::Container":
        res += `const output = runQuest(${v.entries.ContaineredQuestPrototypeSID});`;
        break;
      case "EQuestNodeType::SetGlobalVariable":
        res += `${v.entries.GlobalVariablePrototypeSID}${getAssignment(v)}${v.entries.VariableValue}`;
        break;
      case "EQuestNodeType::OnJournalQuestEvent":
        break; //todo maybe i need this
      default:
        console.warn(`This shouldn't happen: NodeType = '${v.entries?.NodeType}'`);
    }
    return res + "\n" + renderChildren(v);
  };
  const renderChildren = (v: StructType) => {
    return v["children"]
      .map(([id, pin]: [StructType, string]) => {
        let res = "";
        if (pin) {
          res += `if (output === ${pin})`;
        }
        if (pin) res += "{";
        if (0 /*id.entries.NodeType === "EQuestNodeType::Condition" || id.entries.NodeType === "EQuestNodeType::If"*/) {
          res += renderOneBody(id);
        } else {
          res += `${id.entries.SID}()`;
        }
        if (pin) res += "}";
        return res;
      })
      .join("\n");
  };
  const renderOutputs = (v: StructType) => {
    return Object.entries(/* todo v.entries?.OutputPinNames?.entries ||*/ [])
      .filter(([key]) => key !== "_isArray")
      .map(([k, e]) => `emit(${e});`)
      .join("\n");
  };
  const renderOne = (v: StructType) => {
    return `
          ${renderOutputs(v)}
          ${renderOneBody(v)}
        `.trim();
  };
  const syntax =
    context +
    Object.values(tree)
      .map((v) => `const ${v.entries.SID}=()=>{${renderOne(v)}};`)
      .join("\n");
  fs.writeFileSync(
    "/home/sdwvit/.config/JetBrains/IntelliJIdea2025.1/scratches/1.js",
    syntax.replaceAll(/(\W)fdsfsdf/g, "$1"),
  );
}

function getComparator(e: GetStructType<{ ConditionComparance: EConditionComparance }>) {
  const options = {
    "EConditionComparance::Greater": ">",
    "EConditionComparance::Less": "<",
    "EConditionComparance::NotEqual": "!==",
    "EConditionComparance::Equal": "===",
  };
  return options[e.entries.ConditionComparance];
}

function getAssignment(v: Struct<{ ChangeValueMode: "EChangeValueMode::Set" | "EChangeValueMode::Add" }>) {
  return { "EChangeValueMode::Add": "+=", "EChangeValueMode::Set": "=" }[v.entries.ChangeValueMode];
}

function getCondition(
  v: GetStructType<{
    Conditions: {
      ConditionType: EQuestConditionType;
      ConditionComparance: EConditionComparance;
      GlobalVariablePrototypeSID?: string;
      ChangeValueMode?: EChangeValueMode;
      VariableValue?: number;
      JournalQuestSID?: string;
      LinkedNodePrototypeSID?: string;
      JournalState?: string;
      CompletedNodeLauncherNames: string[];
    }[][];
  }>,
) {
  return Object.values(v.entries.Conditions.entries)
    .filter((e) => e.entries)
    .map((e) => Object.values(e.entries))
    .flat()
    .filter((e) => e._id)
    .map((e) => {
      switch (e.entries?.ConditionType) {
        case "EQuestConditionType::JournalState":
          return `${e.entries.JournalQuestSID}${getComparator(e)}${JSON.stringify(e.entries.JournalState)}`;
        case "EQuestConditionType::GlobalVariable":
          return `${e.entries.GlobalVariablePrototypeSID}${getComparator(e)}${e.entries.VariableValue}`;
        case "EQuestConditionType::Bridge":
          if (e.entries.LinkedNodePrototypeSID === v.entries["SID"]) {
            return `${v.entries["SID"]}.lastRunOutput${getComparator(e)}${e.entries.CompletedNodeLauncherNames.entries["0"] === "None" ? "Some" : "undefined"}`;
          }
          return `outputOf(${e.entries.LinkedNodePrototypeSID})${getComparator(e)}${e.entries.CompletedNodeLauncherNames.entries["0"] || '""'}`;
        default:
          console.warn(`This shouldn't happen: ConditionType = '${e.entries?.ConditionType}'`);
      }
    })
    .filter(Boolean)
    .join("&&");
}
