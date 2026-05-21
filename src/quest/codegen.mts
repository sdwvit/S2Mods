import { Struct } from "s2cfgtojson";
import type { EConditionComparance } from "s2cfgtojson";
import type {
  QuestNodePrototype,
  QuestNodePrototypeCondition,
  QuestNodePrototypeConditionsItemItem,
  QuestNodePrototypeSequenceStart,
  QuestNodePrototypeSetDialog,
  QuestNodePrototypeShowFadeScreen,
  QuestNodePrototypeTechnical,
} from "s2cfgtojson";
import { EVENTS, EVENTS_INTERESTING_PROPS, EVENTS_INTERESTING_SIDS } from "./constants.mts";
import { QuestIr, QuestIrNode } from "./ir.mts";
import { QuestNodePrototypeConditionsItem } from "s2cfgtojson/types";

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

export function renderBooleanComparison(expr: string, comp: string) {
  switch (comp) {
    case "===":
    case ">=":
    case ">":
      return expr;
    case "!==":
    case "<":
    case "<=":
      return `!(${expr})`;
    default:
      return `${expr} ${comp} true`;
  }
}

export function renderConditionResultBlock(conditionExpr: string, isIfNode: boolean) {
  const expr = conditionExpr.trim();
  // Never early-return from condition-like nodes: __questNodeComplete must run
  // to keep __questDepth balanced.
  if (isIfNode) {
    return `result = ${expr};`;
  }
  return `result = ${expr};`;
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
  const subType = String(struct.NodeType).split("::").pop();

  if (subType && EVENTS.includes(subType)) {
    globalFunctions.set(subType, "");
    return "";
  }

  const renderSubType = <T extends QuestNodePrototype>(subType: string) =>
    `${subType}(${(struct as T as any)
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

  const renderSubTypeWithProps = <T extends QuestNodePrototype>(
    subType: string,
    propKeys: (keyof T & string)[],
  ) => {
    const pairs = propKeys
      .filter((k) => Object.hasOwn(struct, k))
      .map((k) => {
        const value = (struct as T as any)[k];
        const renderedValue = value === undefined ? "undefined" : JSON.stringify(value);
        return `${k}: ${renderedValue}`;
      });

    if (!pairs.length) {
      return renderSubType<T>(subType);
    }

    const base = renderSubType<T>(subType);
    const propsObj = `{ ${pairs.join(", ")} }`;
    const hasArgs = !base.includes("();");
    return base.replace(");", `${hasArgs ? ", " : ""}${propsObj});`);
  };

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
      globalFunctions.set(
        "despawn",
        "(actor) => { delete spawnedActors[actor]; __questLogStub(`despawn(${actor})`); }; ",
      );
      return `despawn(questActors['${struct.TargetQuestGuid}']);`;
    case "EQuestNodeType::End":
      return "";
    case "EQuestNodeType::ItemAdd":
    case "EQuestNodeType::ItemRemove": {
      globalFunctions.set(subType, "");
      const itemSid = String(struct.ItemSID || struct.ItemPrototypeSID || "");
      const count = struct.ItemsCount ?? 1;
      const target = String(struct.TargetQuestGuid || "");
      if (itemSid) questActors.add(itemSid);
      if (target) questActors.add(target);
      return `${subType}(${target ? `questActors['${target}']` : "Skif"}, ${itemSid ? `questActors['${itemSid}']` : "''"}, ${count});`;
    }
    case "EQuestNodeType::ConsoleCommand":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::LookAt":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ALifeDirectorZoneSwitch":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::AchievementUnlock":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ActivateAnomaly":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ActivateInteractableObject":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ActivateDataLayerCombination":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::AddNote":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::AddOrRemoveFromSquad":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::AddTechnicianSkillOrUpgrade":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::AddTutorialToPDA":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::BridgeCleanUp":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::BridgeEvent":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::CancelAllSideQuests":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ChangeFaction":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::DeactivateZone":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::PlayEffect":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::PlayPostProcess":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::PlaySound":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::PlayVideo":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ProtectLairNPCSquadItem":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ReputationLocker":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ResetAI":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::RestrictSave":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::RestrictionArea":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SaveGame":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ScheduledContainer":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SearchPoint":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SendSignal": {
      globalFunctions.set(subType, "");
      const guid = String((structr as any).SignalReceiverGuid || "");
      return guid ? `${subType}('${guid}');` : `${subType}();`;
    }
    case "EQuestNodeType::SequenceStart": {
      globalFunctions.set(subType, "");
      const seqs = (structr as unknown as QuestNodePrototypeSequenceStart).LocalizedSequences;
      if (seqs) {
        const names = [
          ...new Set(
            seqs.entries().map(([_k, v]: [string, string]) => {
              const cleaned = String(v).replace(/'/g, "");
              return cleaned.split(".").pop() || cleaned.split("/").pop() || cleaned;
            }),
          ),
        ].filter(Boolean);
        if (names.length) return `${subType}(${names.map((n) => `'${n}'`).join(", ")});`;
      }
      return `${subType}();`;
    }
    case "EQuestNodeType::SetCharacterEffect":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetCharacterParam": {
      globalFunctions.set(subType, "");
      const base = renderSubType(subType);
      const params = struct.Params;
      if (params) {
        const compact = Array.from(params.entries())
          .map(([_k, v]: [string, any]) => {
            const param =
              String(v.ModifiedCharacterParam || "")
                .split("::")
                .pop() || "?";
            const mode =
              String(v.ChangeValueMode || "")
                .split("::")
                .pop() || "Set";
            const val = v.ChangeValue ?? 0;
            const op =
              mode === "Set"
                ? "="
                : mode === "Add"
                  ? "+="
                  : mode === "Subtract"
                    ? "-="
                    : `${mode} `;
            return `${param} ${op} ${val}`;
          })
          .join(", ");
        return base.replace(");", `, '${compact}');`);
      }
      return base;
    }
    case "EQuestNodeType::SetDurabilityParam":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetFactionRestriction":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetHubOwner":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetLocationName":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetMeshGenerator":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetNPCSequentialAbility":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetName":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetPersonalRestriction":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetQuestGiver":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetSpaceRestrictor":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetTime":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetTimer":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetWeather":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetWounded":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ShowFadeScreen":
      globalFunctions.set(subType, "");
      return renderSubTypeWithProps<QuestNodePrototypeShowFadeScreen>(subType, [
        "FadeTime",
        "ScreenText",
        "ImagePath",
      ]);
    case "EQuestNodeType::ShowLoadingScreen":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ShowMarker":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ShowTutorialWidget":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::TeleportCharacter":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::Technical": {
      globalFunctions.set(subType, "");
      const techStruct = structr as unknown as QuestNodePrototypeTechnical;
      const parts: string[] = [];
      if (techStruct.StartDelay) parts.push(`delay=${techStruct.StartDelay}`);
      if (techStruct.LaunchOnQuestStart) parts.push("onStart");
      return parts.length ? `${subType}('${parts.join(", ")}');` : `${subType}();`;
    }
    case "EQuestNodeType::TimeLock":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ToggleLairActivity":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ToggleNPCHidden": {
      globalFunctions.set(subType, "");
      const base = renderSubType(subType);
      const hideType = String((structr as any).HideViewType || "")
        .split("::")
        .pop();
      return hideType ? base.replace(");", `, '${hideType}');`) : base;
    }
    case "EQuestNodeType::TrackJournal":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::TrackShelter":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::Trigger": {
      const eventType =
        String((structr as any).EventType || "")
          .split("::")
          .pop() || "OnTrigger";
      globalFunctions.set(eventType, "");
      const triggerGuid = String((structr as any).TriggerQuestGuid || "");
      if (triggerGuid) questActors.add(triggerGuid);
      const target = struct.TargetQuestGuid;
      if (target) questActors.add(String(target));
      const args = [
        target ? `questActors['${target}']` : "",
        triggerGuid ? `questActors['${triggerGuid}']` : "",
      ].filter(Boolean);
      return `${eventType}(${args.join(", ")});`;
    }
    case "EQuestNodeType::DisableNPCBark":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::DisableNPCInteraction":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::EmissionScheduleControl":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::EmissionStart":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::EnableDataLayer":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::EquipItemInHands":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::FlashlightOnOff":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::ForceInteract":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::GiveCache":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::HideLoadingScreen":
      globalFunctions.set(subType, "");
      return renderSubType(subType);
    case "EQuestNodeType::SetJournal": {
      globalFunctions.set(subType, "");
      const entity =
        String(struct.JournalEntity || "")
          .split("::")
          .pop() || "";
      const action =
        String(struct.JournalAction || "")
          .split("::")
          .pop() || "";
      const questSid = String(struct.JournalQuestSID || "");
      const stageSid = String(struct.JournalQuestStageSID || "");
      const parts = [action, entity, stageSid || questSid].filter(Boolean);
      return `${subType}('${parts.join(" ")}');`;
    }
    case "EQuestNodeType::SetDialog": {
      globalFunctions.set(subType, "");
      const dialogStruct = structr as unknown as QuestNodePrototypeSetDialog;
      const members = dialogStruct.DialogMembers;
      const memberArgs: string[] = [];
      if (members) {
        for (const [, guid] of members.entries()) {
          const g = String(guid);
          if (g) {
            questActors.add(g);
            memberArgs.push(`questActors['${g}']`);
          }
        }
      }
      const chain = dialogStruct.DialogChainPrototypeSID || "";
      if (chain) memberArgs.unshift(`'${chain}'`);
      return `${subType}(${memberArgs.join(", ")});`;
    }
    default:
      globalFunctions.set(subType, "");
      return renderSubType(subType);
  }
}

function processConditionNode(
  structT: Struct,
  globalVars: Set<string>,
  globalFunctions: Map<string, string>,
  questActors: Set<string>,
  getNodeSid: (sid: string) => string,
) {
  const struct = structT as QuestNodePrototypeCondition;
  const andOr =
    struct.Conditions.ConditionCheckType === "EConditionCheckType::Or" ? " || " : " && ";
  const conditionSubType = struct.NodeType.split("::").pop();

  const conditionExpr = struct.Conditions.entries
    ? `${struct.Conditions.entries()
        .filter(([k]) => k !== "ConditionCheckType")
        .map(([_k, cond]) => {
          if (typeof cond === "string") {
            return "";
          }

          const processCond = (
            cR: QuestNodePrototypeConditionsItem | QuestNodePrototypeConditionsItemItem,
          ) => {
            if (typeof cR !== "object") {
              return "";
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
                return renderBooleanComparison(
                  `${f}(questActors['${trigger}'], questActors['${target}'], '${param1}', '${param2}')`,
                  comp,
                );
              }
              case "EQuestConditionType::Emission": {
                const f = `isEmissionHappening`;
                const target = c.EmissionPrototypeSID;
                const comp = getConditionComparance(c.ConditionComparance);
                globalFunctions.set(f, "(s) => false");
                if (target) {
                  questActors.add(target);
                }
                return renderBooleanComparison(
                  `${f}(${target ? `questActors['${target}']` : ""})`,
                  comp,
                );
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
                return renderBooleanComparison(
                  `hasQuestNodeExecuted(${linkedNodeSid}, [${completedPins}])`,
                  getConditionComparance(c.ConditionComparance),
                );
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
                return renderBooleanComparison(
                  `${f}(${targetNpc ? `questActors['${targetNpc}']` : ""}${placeholder ? `, questActors['${placeholder}']` : ""})`,
                  comp,
                );
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
                return renderBooleanComparison(
                  `${f}(${target ? `questActors['${target}']` : ""}${corpse ? `, questActors['${corpse}']` : ""}, ${anyBody})`,
                  comp,
                );
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
                return renderBooleanComparison(
                  `${f}(${target ? `questActors['${target}']` : ""}, ${JSON.stringify(effect)})`,
                  comp,
                );
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
                return renderBooleanComparison(
                  `${f}(${target ? `questActors['${target}']` : "null"}, ${itemSid ? itemSid : "null"}, ${JSON.stringify(equipment)})`,
                  comp,
                );
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
                return renderBooleanComparison(
                  `${f}(${index}, ${JSON.stringify(itemSid)}, ${JSON.stringify(consumable)})`,
                  comp,
                );
              }
              case "EQuestConditionType::IsAlive":
                globalFunctions.set(
                  "IsAlive",
                  "(actor) => { const isAlive = !!spawnedActors[actor]; __questLog(`IsAlive(${actor}) === ${isAlive}`); return isAlive; };",
                );
                questActors.add(c.TargetCharacter);
                return `${getConditionComparance(c.ConditionComparance) === "===" ? "" : "!"}IsAlive(questActors['${c.TargetCharacter}'])`;

              case "EQuestConditionType::IsCreated":
                globalFunctions.set(
                  "IsCreated",
                  "(actor) => { const created = !!spawnedActors[actor]; __questLog(`IsCreated(${actor}) === ${created}`); return created; };",
                );
                questActors.add(c.TargetPlaceholder);
                return `${getConditionComparance(c.ConditionComparance) === "===" ? "" : "!"}IsCreated(questActors['${c.TargetPlaceholder}'])`;

              case "EQuestConditionType::IsEnoughAmmo": {
                const f = "isEnoughAmmo";
                const comp = getConditionComparance(c.ConditionComparance);
                const required = c.AmmoRequired ?? 0;
                globalFunctions.set(f, "() => true;");
                return renderBooleanComparison(`${f}(${required})`, comp);
              }
              case "EQuestConditionType::IsOnline": {
                const f = "isOnline";
                const comp = getConditionComparance(c.ConditionComparance);
                const target = c.TargetCharacter;
                if (target) {
                  questActors.add(target);
                }
                globalFunctions.set(f, "() => true;");
                return renderBooleanComparison(
                  `${f}(${target ? `questActors['${target}']` : ""})`,
                  comp,
                );
              }
              case "EQuestConditionType::IsWeaponJammed": {
                const f = "isWeaponJammed";
                const comp = getConditionComparance(c.ConditionComparance);
                globalFunctions.set(f, "() => false;");
                return renderBooleanComparison(`${f}()`, comp);
              }
              case "EQuestConditionType::IsWounded": {
                const f = "isWounded";
                const comp = getConditionComparance(c.ConditionComparance);
                const target = c.TargetCharacter;
                if (target) {
                  questActors.add(target);
                }
                globalFunctions.set(f, "() => false;");
                return renderBooleanComparison(
                  `${f}(${target ? `questActors['${target}']` : ""})`,
                  comp,
                );
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

                return renderBooleanComparison(
                  `${f}(questActors['${TargetItemContainer}'], ${ItemPrototypeSID}, ${ItemsCount})`,
                  comp,
                );
              }
              case "EQuestConditionType::ItemInInventory": {
                const f = `is${questConditionSubType}`;
                const ItemPrototypeSID = c.ItemPrototypeSID?.VariableValue ?? c.VariableValue;
                const ItemsCount = c.ItemsCount?.VariableValue ?? c.NumericValue ?? 0;
                const comp = getConditionComparance(c.ConditionComparance);

                globalFunctions.set(f, "() => true;");
                globalVars.add(String(ItemPrototypeSID));

                return renderBooleanComparison(`${f}(${ItemPrototypeSID}, ${ItemsCount})`, comp);
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
                return renderBooleanComparison(`${f}(${JSON.stringify(note)})`, comp);
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
                return renderBooleanComparison(
                  `${f}(${target ? `questActors['${target}']` : ""})`,
                  comp,
                );
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
          };

          const groupExpr = cond.ConditionType
            ? processCond(cond)
            : cond
                .entries()
                .map(([, cR]) => processCond(cR as QuestNodePrototypeConditionsItemItem))
                .filter(Boolean)
                // Conditions inside one group are evaluated conjunctively.
                .join(" && ");
          return groupExpr ? `(${groupExpr})` : "";
        })
        .filter(Boolean)
        .join(andOr)}`
    : "true";
  return renderConditionResultBlock(conditionExpr, conditionSubType === "If");
}

export function getEventHandler(eventName: string) {
  return (target: string, content?: string) =>
    `${eventName}(${target}${content ? `, ${content}` : ""})`;
}

function indentBlock(content: string, indent = "  ") {
  return content
    .split("\n")
    .map((line) => (line ? `${indent}${line}` : line))
    .join("\n");
}

export function shouldDeclareResultVar(nodeBody: string, usesResultBasedLaunches: boolean) {
  return usesResultBasedLaunches || /\bresult\b/.test(nodeBody);
}

function getStructBody(
  node: QuestIrNode,
  globalVars: Set<string>,
  globalFunctions: Map<string, string>,
  questActors: Set<string>,
  getNodeSid: (sid: string) => string,
) {
  let launches = "";
  let usesResultBasedLaunches = false;
  if (node.launches.length) {
    const isConditionLike =
      node.raw.NodeType === "EQuestNodeType::Condition" ||
      node.raw.NodeType === "EQuestNodeType::If";
    // Condition/If outputs are always result-dependent, even when Name is empty.
    // Other nodes should still use result-dependent dispatch when they expose named outputs.
    const useSwitch = isConditionLike || node.launches.some(({ Name }) => Boolean(Name));
    usesResultBasedLaunches = useSwitch;
    if (useSwitch) {
      launches = node.launches
        .map(({ Name, SID }) => {
          if (!Name) {
            // For Condition/If nodes, empty pin names represent the successful branch.
            return `if (result) ${getNodeSid(SID)}(f, '');`;
          }
          const isBool = Name === "True" || Name === "False";
          return `if (${isBool ? (Name === "True" ? "result" : "!result") : `result === \"${Name}\"`}) ${getNodeSid(SID)}(f, '${Name || ""}');`;
        })
        .join("\n");
    } else {
      launches = node.launches
        .map(({ SID, Name }) => `${getNodeSid(SID)}(f, '${Name || ""}');`)
        .join("\n");
    }
  }
  const isCoDep =
    node.launchersByJsSid &&
    Object.entries(node.launchersByJsSid).length &&
    Object.entries(node.launchersByJsSid).some(([_k, v]) => v.length > 1);
  const nodeBody = questNodeToJavascript(
    node.raw,
    globalVars,
    globalFunctions,
    questActors,
    getNodeSid,
  );
  const needsResultVar = shouldDeclareResultVar(nodeBody, usesResultBasedLaunches);
  const bodyLines = [
    nodeBody,
    launches,
    `__questNodeComplete(f, ${needsResultVar ? "result" : "None"});`,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    `function ${node.jsSid}(caller, name) {`,
    `  const f = ${node.jsSid};`,
    "  __questNodeInit(f, caller, name);",
    ...(isCoDep ? [`  f.Conditions ??= ${JSON.stringify(node.launchersByJsSid || {})};`] : []),
    ...(needsResultVar ? ["  let result = None;"] : []),
    ...(isCoDep
      ? [
          "  __questDepth--;",
          "  waitForCallers(1000, f, caller)",
          "    .then(() => {",
          "      __questDepth++;",
          indentBlock(bodyLines, "      "),
          "    })",
          "    .catch((e) => __questLog(e));",
        ]
      : [indentBlock(bodyLines, "  ")]),
    "}",
  ];
  return lines.join("\n");
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
      if ((struct as QuestNodePrototypeTechnical).LaunchOnQuestStart && !subscription) {
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
        (struct as QuestNodePrototypeTechnical)
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

      return `${structBody}\n${subscription(node.jsSid, [...args].join(", "))};`;
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
