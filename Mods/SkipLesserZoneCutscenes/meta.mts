import { Struct } from "s2cfgtojson";
import type {
  DialogPrototype,
  QuestNodePrototypeCondition,
  QuestNodePrototypeSetItemGenerator,
  QuestNodePrototypeTechnical,
  QuestNodePrototype,
} from "s2cfgtojson";
import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
    This mod skips / speeds up Intro / Scanner / Wake up with Richter / Zalissya bar / Sphere cutscenes.
    [hr][/hr]
    Quest changes:
    - E01_MQ01: removes intro video / cutscene / timelock / emission blockers / bolt-action block / laptop-off signal launchers; starts scanner flow earlier; reroutes bunker-door and laptop-on signals to bunker entry; reroutes quest finish to point-3 finish; shortens late technical delays to 1 second; replaces a few gating technical nodes with instant technical pass-through; keeps the empty item-generator from replacing inventory.
    - E02_MQ01: removes wake-up cutscene container, Richter reaction setup blockers, armor check blocker, VFX / audio launchers, and bolt-action block launcher; reroutes post-wake save / blood decal / blood body / end-preparation nodes into anomaly-field progression; replaces the wake-up \`If\` node with a technical node and routes Richter reaction directly into it.
    - E02_MQ03: removes save restriction and the main bar cutscene container; reroutes bar-scene marker / technical / Batya teleport nodes directly to bar trigger flow; reroutes the E02_MQ02 container to the bar-scene technical node.
    - E02_MQ03_C05: removes save restriction and cutscene container launchers; reroutes Pripoy cutscene follow-up technical nodes to the player lab trigger.
    - E02_MQ03_Dialog_Warlock_in_Bar_after_CS: makes the post-cutscene dialog skippable and disables forced VO-in-sequence when present.
    [hr][/hr]
    Use this mod for frequent game resets.[h1][/h1]
  
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote:
    "Reworked SkipLesserZoneCutscenes into explicit per-quest patches: rerouted intro / wake-up / bar / Pripoy flows, removed more cutscene and save-blocking launchers, shortened technical delays, replaced gating nodes with technical pass-throughs, preserved player inventory on scanner setup, and made the Warlock post-cutscene dialog skippable",
  structTransformers: [structTransformer],
};

/**
 * E01_MQ01_OnSignalReceived_4 - Skif places scanner 1
 * E01_MQ01_OnTriggerEnterEvent_5 - Skif approaches bunker
 *
 * @param struct
 * @param context
 */
function structTransformer(
  struct: QuestNodePrototype | DialogPrototype,
  context: MetaContext<QuestNodePrototype | DialogPrototype>,
) {
  if (context.fileName === "E01_MQ01.cfg") {
    return processE01M01(struct as QuestNodePrototype);
  }

  if (context.fileName === "E02_MQ01.cfg") {
    return processE02M01(struct as QuestNodePrototype);
  }

  if (context.fileName === "E02_MQ03.cfg") {
    return processE02_MQ03(struct as QuestNodePrototype);
  }

  if (context.fileName === "E02_MQ03_C05.cfg") {
    return processE02MQ03C05(struct as QuestNodePrototype);
  }

  if (context.fileName === "E02_MQ03_Dialog_Warlock_in_Bar_after_CS.cfg") {
    if ((struct as DialogPrototype).Unskippable) {
      const fork = struct.fork() as DialogPrototype;
      fork.Unskippable = false;
      if ((struct as DialogPrototype).HasVOInSequence) {
        fork.HasVOInSequence = false;
      }
      return fork;
    }
  }
}

structTransformer.files = [
  "/QuestNodePrototypes/E01_MQ01.cfg",
  "/QuestNodePrototypes/E02_MQ01.cfg",
  "/QuestNodePrototypes/E02_MQ03.cfg",
  "/QuestNodePrototypes/E02_MQ03_C05.cfg",
  "/DialogPrototypes/E02_MQ03_Dialog_Warlock_in_Bar_after_CS.cfg",
];

function processE02_MQ03(struct: QuestNodePrototype) {
  switch (struct.SID) {
    case "E02_MQ03_RestrictSave":
      return killLaunchers(struct);
    case "E02_MQ03_Container_Cutscene":
      return replaceWithTechnical(struct);
    case "E02_MQ03_ShowMarker_GafferHouse":
    case "E02_MQ03_Technical_BarScene":
    case "E02_MQ03_TeleportCharacterBatyaToHouse":
      return reroute(struct, "E02_MQ03_OnTriggerEnterEvent_Bar");
    case "E02_MQ03_Container_E02_MQ02":
      return reroute(struct, "E02_MQ03_Technical_BarScene");
  }
}

function processE02M01(struct: QuestNodePrototype) {
  switch (struct.SID) {
    case "E02_MQ01_VFX":
    case "E02_MQ01_Audio":
    case "E02_MQ01_SetGlobalVariable_Bolt_Action_Blocked":
    case "E02_MQ01_If_have_armor":
    case "E02_MQ01_Container_Awakening_Cutscene":
      return killLaunchers(struct);
    case "E02_MQ01_SaveGame_2":
    case "E02_MQ01_SendSignal_BP_Dogblooddecal.Receiver_Set_Object_2":
    case "E02_MQ01_SendSignal_BP_Dogbloodbody.Receiver_Set_Object_2":
    case "E02_MQ01_Technical_EndPreparation":
      return reroute(struct, "E02_MQ01_Technical_AnomallyField");
    case "E02_MQ01_If":
      return replaceWithTechnical(struct);
    case "E02_MQ01_Technical_RichterReation":
      return reroute(struct, "E02_MQ01_If");
  }
}

function processE01M01(struct: QuestNodePrototype) {
  switch (struct.SID) {
    case "E01_MQ01_Technical_DespawnLoot": // good
    case "E01_MQ01_LoadAsset": // good
    case "E01_MQ01_PlayVideo": // good
    case "E01_MQ01_Cutscene_Napadenie": // good
    case "E01_MQ01_TimeLock": // good
    case "E01_MQ01_EmissionScheduleControl": // good
    case "E01_MQ01_SetGlobalVariable_Bolt_Action_Blocked": // good
    case "E01_MQ01_SendSignal_1_5_E01MQ01_BP_Laptop.ReceiverOff": // good
      return killLaunchers(struct);
    case "E01_MQ01_Technical_TestWithoutTeleportTransition":
    // power line tower falling: works well
    case "E01_MQ01_SendSignal_1_7_BP_DynamicObject_collision_towerReceiver_Set_Object_2":
    case "E01_MQ01_SendSignal_E01_MQ_01_BP_DynamicObject_2states_final_Eletower.Receiver_Set_Object_2":
    case "E01_MQ01_SendSignal_1_7_E01_MQ01_BP_DynamicObject_LEP.Receiver_Set_Object_2":
    case "E01_MQ01_SequenceStart":
    // end power line
    case "E01_MQ01_ShowMarker_sid_locations_loc_01_scientists_bunker_name_Discovered": // good
    case "E01_MQ01_Start_PlaceScanner": // good
    case "E01_MQ01_SendSignal_ThirdPoint_On":
    case "E01_MQ01_SendSignal_SecondPoint_On":
      return reroute(struct, "E01_MQ01_Start");

    case "E01_MQ01_SendSignal_4": // maybe activates point 1?
      return reroute(struct, "E01_MQ01_Start_PlaceScanner");
    case "E01_MQ01_ItemAdd_Scanner": // good
      return reroute(struct, "E01_MQ01_SetItemGenerator_Player");
    case "E01_MQ01_SendSignal_1_5_E01MQ01_BP_Laptop.ReceiverOn": // good
    case "E01_MQ01_SendSignal_1_5_E01MQ01_BP_BunkerDoor_06.ReceiverOn": // good
      return reroute(struct, "E01_MQ01_OnTriggerEnterEvent_InsideBunker");
    case "E01_MQ01_Finish":
      return reroute(struct, "E01_MQ01_Finish_Point3");
    case "E01_MQ01_Technical_10sec_end":
    case "E01_MQ01_Technical_10sec_end_1":
    case "E01_MQ01_Technical_ChangeLayers":
    case "E01_MQ01_Technical":
      const fork = struct.fork() as QuestNodePrototypeTechnical;
      fork.StartDelay = 1;
      return fork;
    case "E01_MQ01_Technical_15_Pin_2":
    case "E01_MQ01_Technical_PreventEarlyNodeActivation_Pin_0":
      return replaceWithTechnical(struct);
  }

  if (struct.SID === "E01_MQ01_SetItemGenerator_Player_Empty") {
    const fork = struct.fork() as QuestNodePrototypeSetItemGenerator;
    fork.ReplaceInventory = false;
    return fork;
  }
}

function killLaunchers(struct: QuestNodePrototype) {
  const fork = struct.fork();
  fork.Launchers = new Struct() as any;
  return fork;
}

function reroute(
  struct: QuestNodePrototype,
  newLaunchers: string | string[] | { SID: string; Name?: string }[],
) {
  const fork = struct.fork();
  fork.Launchers = getLaunchers(newLaunchers);
  return fork;
}

function replaceWithTechnical(struct: QuestNodePrototype) {
  const fork = struct.fork() as QuestNodePrototypeTechnical;
  fork.NodeType = "EQuestNodeType::Technical";
  if ((struct as any as QuestNodePrototypeCondition).Conditions) {
    (fork as any).Conditions = new Struct();
    (fork as any).removeNode("Conditions");
  }
  if ("OutputPinNames" in struct) {
    (fork as any).OutputPinNames = new Struct();
    (fork as any).removeNode("OutputPinNames");
  }
  if ("ContaineredQuestPrototypeSID" in Struct) {
    (fork as any).ContaineredQuestPrototypeSID = "";
    (fork as any).removeNode("ContaineredQuestPrototypeSID");
  }
  fork.LaunchOnQuestStart = false;
  fork.StartDelay = 0;

  return fork;
}

function processE02MQ03C05(struct: QuestNodePrototype) {
  switch (struct.SID) {
    case "E02_MQ03_C05_RestrictSave":
    case "E02_MQ03_C05_Container_PlayCutscene": {
      return killLaunchers(struct);
    }
    case "E02_MQ03_C05_Technical_E02_MQ03_PripoyCutscene_Alive":
    case "E02_MQ03_C05_Technical_PripyLive":
      return reroute(struct, "E02_MQ03_C05_Trigger_Player_PripoyLab");
  }
}
