import {
  EConditionComparance,
  QuestNodePrototype,
  QuestNodePrototypeActivateRestrictor,
  QuestNodePrototypeConditionsItemItem,
  Struct,
} from "s2cfgtojson";
import { EVENTS, EVENTS_INTERESTING_PROPS, EVENTS_INTERESTING_SIDS } from "./constants.mts";
import { QuestIr, QuestIrNode } from "./ir.mts";

export function buildQuestScriptParts(ir: QuestIr) {
  const globalVars = new Set<string>();
  const globalFunctions = new Map<string, string>();
  const questActors = new Set<string>();
  const launchOnQuestStart: string[] = [];

  const content = getContent(ir, globalVars, globalFunctions, questActors, launchOnQuestStart);

  return {
    content,
    globalVars,
    globalFunctions,
    questActors,
    launchOnQuestStart,
  };
}

function getConditionComparance(ConditionComparance: EConditionComparance) {
  switch (ConditionComparance) {
    case "EConditionComparance::Equal":
      return "===";
    case "EConditionComparance::Greater":
      return ">";
    case "EConditionComparance::GreaterOrEqual":
      return ">=";
    case "EConditionComparance::Less":
      return "<";
    case "EConditionComparance::LessOrEqual":
      return "<=";
    case "EConditionComparance::NotEqual":
      return "!==";
  }
}

type QuestFunction = {
  (caller: QuestFunction, pinName: string): void;
  State: Record<QuestFunction["name"], { SID: string; Name: string }[]>;
  Conditions: Record<QuestFunction["name"], { SID: string; Name: string }[]>;
};

function questNodeToJavascript(
  structr: Struct,
  globalVars: Set<string>,
  globalFunctions: Map<string, string>,
  questActors: Set<string>,
  getNodeSid: (sid: string) => string,
): string {
  const struct = structr as QuestNodePrototype;
  const subType = struct.NodeType.split("::").pop();

  // noinspection FallThroughInSwitchStatementJS
  switch (struct.NodeType) {
    case "EQuestNodeType::ActivateRestrictor":
      globalFunctions.set("activateRestrictor", "");
      return `activateRestrictor('${struct.VolumeGuid}');`;
    case "EQuestNodeType::ChangeRelationships":
      globalFunctions.set("setFactionRelationship", "");
      globalFunctions.set("addFactionRelationship", "");

      questActors.add(struct.FirstTargetSID);
      return `${struct.UseDeltaValue ? "add" : "set"}FactionRelationship(questActors['${struct.FirstTargetSID}'], questActors['${struct.SecondTargetSID}'],  ${struct.RelationshipValue});`;
    case "EQuestNodeType::If":
    case "EQuestNodeType::Condition":
      return processConditionNode(struct, globalVars, globalFunctions, questActors, getNodeSid);
    case "EQuestNodeType::Despawn":
      questActors.add(struct.TargetQuestGuid);
      globalFunctions.set("despawn", "(actor) => { delete spawnedActors[actor]; console.log(`despawn(${actor})`); }; ");
      return `despawn(questActors['${struct.TargetQuestGuid}']);`;
    case "EQuestNodeType::End":
      return "";
    case "EQuestNodeType::OnAbilityEndedEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnAbilityUsedEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnDialogStartEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnEmissionFinishEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnEmissionStageActivated":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnEmissionStageFinished":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnEmissionStartEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnFactionBecomeEnemyEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnFactionBecomeFriendEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnGetCompatibleAttachEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnHitEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnInfotopicFinishEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnInteractEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnJournalQuestEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnKillerCheckEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnMoneyAmountReachedEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnNPCDeathEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnNPCBecomeEnemyEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnNPCBecomeFriendEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnNPCCreateEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnNPCDefeatEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnPlayerGetItemEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnPlayerLostItemEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnPlayerNoticedEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnPlayerRankReachedEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnUpgradeInstallEvent":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::OnSignalReceived":
      globalFunctions.set(subType, "");
      return "";
    case "EQuestNodeType::ItemAdd":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ConsoleCommand":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::LookAt":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ALifeDirectorZoneSwitch":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::AchievementUnlock":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ActivateAnomaly":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ActivateInteractableObject":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ActivateDataLayerCombination":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::AddNote":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::AddOrRemoveFromSquad":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::AddTechnicianSkillOrUpgrade":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::AddTutorialToPDA":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::BridgeCleanUp":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::BridgeEvent":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::CancelAllSideQuests":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ChangeFaction":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::DeactivateZone":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::PlayEffect":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::PlayPostProcess":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::PlaySound":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::PlayVideo":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ProtectLairNPCSquadItem":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ReputationLocker":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ResetAI":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::RestrictSave":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::RestrictionArea":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SaveGame":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ScheduledContainer":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SearchPoint":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SendSignal":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SequenceStart":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetCharacterEffect":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetCharacterParam":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetDurabilityParam":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetFactionRestriction":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetHubOwner":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetLocationName":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetMeshGenerator":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetNPCSequentialAbility":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetName":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetPersonalRestriction":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetQuestGiver":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetSpaceRestrictor":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetTime":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetTimer":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetWeather":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::SetWounded":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ShowFadeScreen":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ShowLoadingScreen":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ShowMarker":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ShowTutorialWidget":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::TeleportCharacter":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::TimeLock":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ToggleLairActivity":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ToggleNPCHidden":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::TrackJournal":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::TrackShelter":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::Trigger":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::DisableNPCBark":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::DisableNPCInteraction":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::EmissionScheduleControl":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::EmissionStart":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::EnableDataLayer":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::EquipItemInHands":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::FlashlightOnOff":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::ForceInteract":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::GiveCache":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "EQuestNodeType::HideLoadingScreen":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    default:
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(String(struct[k]));
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
  }
  return "";
}

function processConditionNode(
  structT: Struct,
  globalVars: Set<string>,
  globalFunctions: Map<string, string>,
  questActors: Set<string>,
  getNodeSid: (sid: string) => string,
) {
  const struct = structT as QuestNodePrototype;
  const andOr = struct.Conditions.ConditionCheckType === "EConditionCheckType::Or" ? " || " : " && ";
  const conditionSubType = struct.NodeType.split("::").pop();
  return `result = ${struct.Conditions.entries()
    .filter(([k]) => k !== "ConditionCheckType")
    .map(([_k, cond]) => {
      if (typeof cond === "string") {
        return;
      }
      return cond
        .entries()
        .map(([_k, cR]) => {
          if (typeof cR !== "object") {
            return;
          }
          const c = cR as QuestNodePrototypeConditionsItemItem;
          const questConditionSubType = c.ConditionType.split("::").pop();
          switch (c.ConditionType) {
            case "EQuestConditionType::Weather": {
              const f = "getWeather";
              const weather = c.Weather?.split("::").pop() || "";
              const comp = getConditionComparance(c.ConditionComparance);
              globalFunctions.set(f, "() => 'Unknown';");
              return `${f}() ${comp} '${weather}'`;
            }
            case "EQuestConditionType::Random": {
              const f = "getRandomValue";
              const comp = getConditionComparance(c.ConditionComparance);
              const val = typeof c.NumericValue === "number" ? c.NumericValue : 0;
              globalFunctions.set(f, "() => Math.random();");
              return `${f}() ${comp} ${val}`;
            }
            case "EQuestConditionType::Trigger": {
              const f = `wasTriggered`;
              const param1 = c.ReactType.split("::").pop();
              const param2 = c.RequiredSquadMembers.split("::").pop();
              const target = c.TargetCharacter;
              const trigger = c.Trigger;
              const comp = getConditionComparance(c.ConditionComparance);
              globalFunctions.set(f, "(s) => true");
              questActors.add(target);
              questActors.add(trigger);
              return `${f}(questActors['${trigger}'], questActors['${target}'], '${param1}', '${param2}') ${comp} true`;
            }
            case "EQuestConditionType::Emission": {
              const f = `isEmissionHappening`;
              const target = c.EmissionPrototypeSID;
              const comp = getConditionComparance(c.ConditionComparance);
              globalFunctions.set(f, "(s) => false");
              if (target) {
                questActors.add(target);
              }
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} true`;
            }
            case "EQuestConditionType::Money": {
              const f = "getMoney";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const val = c.Money?.VariableValue ?? c.VariableValue ?? c.NumericValue ?? 0;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} ${val}`;
            }
            case "EQuestConditionType::Rank": {
              const f = "getRank";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const rank = c.Rank?.split("::").pop() || "";
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 'Novice';");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} '${rank}'`;
            }
            case "EQuestConditionType::JournalState": {
              const f = `get${questConditionSubType}`;
              const st = c.JournalState.split("::").pop();
              const sid = c.JournalQuestSID;
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "(s) => true");
              globalVars.add(sid);
              return `${f}(${sid}) ${comp} '${st}'`;
            }
            case "EQuestConditionType::NodeState": {
              const f = `get${questConditionSubType}`;
              const st = c.NodeState.split("::").pop();
              const sid = getNodeSid(c.TargetNode);
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "(s) => true");
              return `${f}(${sid}) ${comp} '${st}'`;
            }
            case "EQuestConditionType::Bleeding": {
              const f = "getBleeding";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const val = c.NumericValue ?? 0;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} ${val}`;
            }
            case "EQuestConditionType::HP": {
              const f = "getHP";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const val = c.NumericValue ?? 0;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} ${val}`;
            }
            case "EQuestConditionType::HPPercent": {
              const f = "getHPPercent";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const val = c.NumericValue ?? 0;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} ${val}`;
            }
            case "EQuestConditionType::HungerPoints": {
              const f = "getHungerPoints";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const val = c.NumericValue ?? 0;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} ${val}`;
            }
            case "EQuestConditionType::InventoryWeight": {
              const f = "getInventoryWeight";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const val = c.NumericValue ?? 0;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} ${val}`;
            }
            case "EQuestConditionType::Radiation": {
              const f = "getRadiation";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const val = c.NumericValue ?? 0;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} ${val}`;
            }
            case "EQuestConditionType::AITarget": {
              const f = "getAITarget";
              const comp = getConditionComparance(c.ConditionComparance);
              const targetNpc = c.TargetNPC;
              const target = c.AITarget;
              if (targetNpc) {
                questActors.add(targetNpc);
              }
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 'None';");
              return `${f}(${targetNpc ? `questActors['${targetNpc}']` : ""}) ${comp} ${target ? `questActors['${target}']` : "None"}`;
            }
            case "EQuestConditionType::ArmorState": {
              const f = "getArmorState";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const val = c.NumericValue ?? 0;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${target ? `questActors['${target}']` : ""}, ${!!c.WithHeadArmor}, ${!!c.WithBodyArmor}) ${comp} ${val}`;
            }
            case "EQuestConditionType::Awareness": {
              const f = "getAwareness";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const level = c.ThreatAwareness?.split("::").pop() || "";
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 'Idle';");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} '${level}'`;
            }
            case "EQuestConditionType::Bridge": {
              const linkedNodeSid = getNodeSid(c.LinkedNodePrototypeSID);
              const completedPins = c.CompletedNodeLauncherNames.entries()
                .map(([_k, v]) => JSON.stringify(v))
                .join(", ");
              return `hasQuestNodeExecuted(${linkedNodeSid}, [${completedPins}]) ${getConditionComparance(c.ConditionComparance)} true`;
            }
            case "EQuestConditionType::ContextualAction": {
              const f = "hasContextualAction";
              const comp = getConditionComparance(c.ConditionComparance);
              const targetNpc = c.TargetNPC;
              const placeholder = c.TargetContextualActionPlaceholder;
              if (targetNpc) {
                questActors.add(targetNpc);
              }
              if (placeholder) {
                questActors.add(placeholder);
              }
              globalFunctions.set(f, "() => true;");
              return `${f}(${targetNpc ? `questActors['${targetNpc}']` : ""}${placeholder ? `, questActors['${placeholder}']` : ""}) ${comp} true`;
            }
            case "EQuestConditionType::CorpseCarry": {
              const f = "isCarryingCorpse";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const corpse = c.TargetCorpsePlaceholder;
              const anyBody = !!c.AnyBody;
              if (target) {
                questActors.add(target);
              }
              if (corpse) {
                questActors.add(corpse);
              }
              globalFunctions.set(f, "() => false;");
              return `${f}(${target ? `questActors['${target}']` : ""}${corpse ? `, questActors['${corpse}']` : ""}, ${anyBody}) ${comp} true`;
            }
            case "EQuestConditionType::DistanceToNPC": {
              const f = `get${questConditionSubType}`;
              const val = c.NumericValue;
              const sid1 = c.TargetCharacter;
              const sid2 = c.TargetNPC;
              const comp = getConditionComparance(c.ConditionComparance);
              questActors.add(sid1);
              questActors.add(sid2);
              globalFunctions.set(f, "() => 0;");
              return `${f}(questActors['${sid1}'], questActors['${sid2}']) ${comp} '${val}'`;
            }
            case "EQuestConditionType::DistanceToPoint": {
              const f = `get${questConditionSubType}`;
              const st = c.NumericValue;
              const point = getConditionPoint(c);
              const sid = point ? getCoordsStr(point.X, point.Y, point.Z) : "";
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "() => 0;");
              return `${f}('${sid}') ${comp} ${st}`;
            }
            case "EQuestConditionType::Effect": {
              const f = "hasEffect";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const effect = c.EffectPrototypeSID || "";
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => false;");
              return `${f}(${target ? `questActors['${target}']` : ""}, ${JSON.stringify(effect)}) ${comp} true`;
            }
            case "EQuestConditionType::EquipmentInHands": {
              const f = "hasEquipmentInHands";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const equipment = c.Equipment?.split("::").pop() || "";
              const itemSid = c.ItemPrototypeSID?.VariableValue ?? c.VariableValue;
              if (target) {
                questActors.add(target);
              }
              if (itemSid) {
                globalVars.add(String(itemSid));
              }
              globalFunctions.set(f, "() => false;");
              return `${f}(${target ? `questActors['${target}']` : ""}, ${itemSid ? itemSid : "null"}, ${JSON.stringify(equipment)}) ${comp} true`;
            }
            case "EQuestConditionType::FactionRelationship": {
              const f = "getFactionRelationship";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const faction = c.Faction || "";
              const relation = c.Relationships?.split("::").pop() || "";
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 'Neutral';");
              return `${f}(${target ? `questActors['${target}']` : ""}, ${JSON.stringify(faction)}) ${comp} '${relation}'`;
            }
            case "EQuestConditionType::GlobalVariable":
              globalVars.add(c.GlobalVariablePrototypeSID);
              return `${c.GlobalVariablePrototypeSID} ${getConditionComparance(c.ConditionComparance)} ${c.VariableValue}`;
            case "EQuestConditionType::HasItemInQuickSlot": {
              const f = "hasItemInQuickSlot";
              const comp = getConditionComparance(c.ConditionComparance);
              const index = c.QuickSlotIndex ?? -1;
              const itemSid = c.QuickSlotItemSID || "";
              const consumable = c.QuickSlotConsumableType?.split("::").pop() || "";
              globalFunctions.set(f, "() => false;");
              return `${f}(${index}, ${JSON.stringify(itemSid)}, ${JSON.stringify(consumable)}) ${comp} true`;
            }
            case "EQuestConditionType::IsAlive":
              globalFunctions.set(
                "IsAlive",
                "(actor) => { const isAlive = !!spawnedActors[actor]; console.log(`IsAlive(${actor}) === ${isAlive}`); return isAlive; };",
              );
              questActors.add(c.TargetCharacter);
              return `${getConditionComparance(c.ConditionComparance) === "===" ? "" : "!"}IsAlive(questActors['${c.TargetCharacter}'])`;

            case "EQuestConditionType::IsCreated":
              globalFunctions.set(
                "IsCreated",
                "(actor) => { const created = !!spawnedActors[actor]; console.log(`IsCreated(${actor}) === ${created}`); return created; };",
              );
              questActors.add(c.TargetPlaceholder);
              return `${getConditionComparance(c.ConditionComparance) === "===" ? "" : "!"}IsCreated(questActors['${c.TargetPlaceholder}'])`;

            case "EQuestConditionType::IsEnoughAmmo": {
              const f = "isEnoughAmmo";
              const comp = getConditionComparance(c.ConditionComparance);
              const required = c.AmmoRequired ?? 0;
              globalFunctions.set(f, "() => true;");
              return `${f}(${required}) ${comp} true`;
            }
            case "EQuestConditionType::IsOnline": {
              const f = "isOnline";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => true;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} true`;
            }
            case "EQuestConditionType::IsWeaponJammed": {
              const f = "isWeaponJammed";
              const comp = getConditionComparance(c.ConditionComparance);
              globalFunctions.set(f, "() => false;");
              return `${f}() ${comp} true`;
            }
            case "EQuestConditionType::IsWounded": {
              const f = "isWounded";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => false;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} true`;
            }
            case "EQuestConditionType::ItemInContainer": {
              const f = `is${questConditionSubType}`;
              const TargetItemContainer = c.TargetItemContainer;
              const ItemPrototypeSID = c.ItemPrototypeSID?.VariableValue ?? c.VariableValue;
              const ItemsCount = c.ItemsCount?.VariableValue ?? c.NumericValue ?? 0;
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "() => true;");
              globalVars.add(String(ItemPrototypeSID));
              questActors.add(TargetItemContainer);

              return `${f}(questActors['${TargetItemContainer}'], ${ItemPrototypeSID}, ${ItemsCount}) ${comp} true`;
            }
            case "EQuestConditionType::ItemInInventory": {
              const f = `is${questConditionSubType}`;
              const ItemPrototypeSID = c.ItemPrototypeSID?.VariableValue ?? c.VariableValue;
              const ItemsCount = c.ItemsCount?.VariableValue ?? c.NumericValue ?? 0;
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "() => true;");
              globalVars.add(String(ItemPrototypeSID));

              return `${f}(${ItemPrototypeSID}, ${ItemsCount}) ${comp} true`;
            }
            case "EQuestConditionType::LookAtAngle": {
              const f = "getLookAtAngle";
              const comp = getConditionComparance(c.ConditionComparance);
              const trigger = c.Trigger;
              const val = c.NumericValue ?? 0;
              const point = getConditionPoint(c);
              if (trigger) {
                questActors.add(trigger);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${trigger ? `questActors['${trigger}']` : ""}, ${JSON.stringify(point ? getCoordsStr(point.X, point.Y, point.Z) : "")}, ${!!c.BoolValue}) ${comp} ${val}`;
            }
            case "EQuestConditionType::Note": {
              const f = "hasNote";
              const comp = getConditionComparance(c.ConditionComparance);
              const note = c.NotePrototypeSID || "";
              globalFunctions.set(f, "() => false;");
              return `${f}(${JSON.stringify(note)}) ${comp} true`;
            }
            case "EQuestConditionType::PersonalRelationship": {
              const f = `is${questConditionSubType}`;
              const comp = getConditionComparance(c.ConditionComparance);
              const TargetCharacter = c.TargetCharacter;
              const Relationships = c.Relationships.split("::").pop();
              globalFunctions.set(f, "() => 'Friend';");
              questActors.add(TargetCharacter);
              globalVars.add(Relationships);

              return `${f}(questActors['${TargetCharacter}']) ${comp} ${Relationships}`;
            }
            case "EQuestConditionType::PlayerOverload": {
              const f = "isPlayerOverloaded";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => false;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} true`;
            }
            case "EQuestConditionType::Psy": {
              const f = "getPsy";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const val = c.NumericValue ?? 0;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} ${val}`;
            }
            case "EQuestConditionType::Stamina": {
              const f = "getStamina";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const val = c.NumericValue ?? 0;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => 0;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} ${val}`;
            }
          }
        })
        .join(andOr);
    })
    .join(andOr)} ${conditionSubType === "If" ? "" : "; \nif (!result) return"};`;
}

function getEventHandler(eventName: string) {
  return (target: string, content?: string) => `${eventName}(${target}${content ? `, ${content}` : ""});`;
}

function getStructBody(
  node: QuestIrNode,
  globalVars: Set<string>,
  globalFunctions: Map<string, string>,
  questActors: Set<string>,
  getNodeSid: (sid: string) => string,
) {
  let launches = "";
  if (node.launches.length) {
    const useSwitch = node.launches.some(({ Name }) => Name);
    if (useSwitch) {
      launches = node.launches
        .map(({ Name, SID }) => {
          const isBool = Name === "True" || Name === "False";
          return `if (${isBool ? (Name === "True" ? "result" : "!result") : `result === \"${Name}\"`}) ${getNodeSid(SID)}(f, '${Name || ""}');`;
        })
        .join("\n");
    } else {
      launches = node.launches.map(({ SID, Name }) => `${getNodeSid(SID)}(f, '${Name || ""}');`).join("\n");
    }
  }
  const isCoDep =
    node.launchersByJsSid && Object.entries(node.launchersByJsSid).length && Object.entries(node.launchersByJsSid).some(([_k, v]) => v.length > 1);
  const consoleLog = `console.log('// ' + f.name + '(${isCoDep ? "', callerName, ',', name, '" : ""});');`;
  return `
     function ${node.jsSid}(caller, name) {         
         const f = ${node.jsSid};
         const callerName = caller?.name ?? String(caller ?? "Unknown");
         ${isCoDep ? `f.Conditions ??= ${JSON.stringify(node.launchersByJsSid || {})}` : ""}
         let result = None;
         f.State ??= {}; 
         f.State[callerName] ||= [];
         f.State[callerName].push({ SID: callerName, Name: name || true });
         ${isCoDep ? "" : consoleLog}
         ${isCoDep ? `waitForCallers(1000, f, caller).then(() => {` : ""}
           ${questNodeToJavascript(node.raw, globalVars, globalFunctions, questActors, getNodeSid)}
           ${launches}
           ${isCoDep ? consoleLog : ""}
           f.State[f.name] ||= [];
           f.State[f.name].push({ SID: f.name, Name: result });
         ${isCoDep ? "}).catch(e => console.log(e))" : ""} 
     }
    `.trim();
}

function getContent(
  ir: QuestIr,
  globalVars: Set<string>,
  globalFunctions: Map<string, string>,
  questActors: Set<string>,
  launchOnQuestStart: string[],
) {
  const subscriptions = Object.fromEntries(EVENTS.map((e) => [e, getEventHandler(e)]));
  const getNodeSid = (sid: string) => ir.jsNameBySid.get(sid) || sid;
  return ir.nodes
    .map((node) => {
      const struct = node.raw;
      const subscription = subscriptions[struct.NodeType.split("::").pop()];
      if (struct.LaunchOnQuestStart && !subscription) {
        launchOnQuestStart.push(node.jsSid);
      }

      /**
       * @param {string} caller - SID of the quest node that called this node.
       * @param {string} name - Name of the quest node output pin that called this node.
       */
      const structBody = getStructBody(node, globalVars, globalFunctions, questActors, getNodeSid);
      if (!subscription) {
        return structBody;
      }
      const args = new Set(
        struct
          .entries()
          .filter(([k]) => EVENTS_INTERESTING_PROPS.has(k) || EVENTS_INTERESTING_SIDS.has(k))
          .map(([_k, v]) => {
            if (EVENTS_INTERESTING_SIDS.has(_k) && v) {
              questActors.add(String(v));
              return `questActors['${v}']`;
            }
            return v;
          }),
      );

      return `${structBody}\n${subscription(node.jsSid, [...args].join(", "))}`;
    })
    .join("\n\n");
}

function getCoordsStr(x: number, y: number, z: number) {
  return `${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`;
}

function getConditionPoint(c: Record<string, any>) {
  if (c.TargetPoint && typeof c.TargetPoint === "object") {
    const { X, Y, Z } = c.TargetPoint;
    if (typeof X === "number" && typeof Y === "number" && typeof Z === "number") {
      return { X, Y, Z };
    }
  }
  if (typeof c.X === "number" && typeof c.Y === "number" && typeof c.Z === "number") {
    return { X: c.X, Y: c.Y, Z: c.Z };
  }
  if (c.PointToLookAt && typeof c.PointToLookAt === "object") {
    const { X, Y, Z } = c.PointToLookAt;
    if (typeof X === "number" && typeof Y === "number" && typeof Z === "number") {
      return { X, Y, Z };
    }
  }
  return null;
}
