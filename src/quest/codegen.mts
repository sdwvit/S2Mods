import { QuestNodePrototype, Struct } from "s2cfgtojson";
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

function getConditionComparance(ConditionComparance: string) {
  const subType = ConditionComparance.split("::").pop();
  switch (subType) {
    case "Equal":
      return "===";
    case "Greater":
      return ">";
    case "GreaterOrEqual":
      return ">=";
    case "Less":
      return "<";
    case "LessOrEqual":
      return "<=";
    case "NotEqual":
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
  switch (subType) {
    case "ActivateRestrictor":
      globalFunctions.set("activateRestrictor", "");
      return `activateRestrictor('${struct.VolumeGuid}');`;

    case "ChangeRelationships":
      globalFunctions.set("setFactionRelationship", "");
      globalFunctions.set("addFactionRelationship", "");

      questActors.add(struct.FirstTargetSID);
      return `${struct.UseDeltaValue ? "add" : "set"}FactionRelationship(questActors['${struct.FirstTargetSID}'], questActors['${struct.SecondTargetSID}'],  ${struct.RelationshipValue});`;

    case "If":
    case "Condition":
      return processConditionNode(struct, globalVars, globalFunctions, questActors, getNodeSid);

    case "Despawn":
      questActors.add(struct.TargetQuestGuid);
      globalFunctions.set("despawn", "(actor) => { delete spawnedActors[actor]; console.log(`despawn(${actor})`); }; ");
      return `despawn(questActors['${struct.TargetQuestGuid}']);`;
    case "End":
      return "";
    case "OnAbilityEndedEvent":
    case "OnAbilityUsedEvent":
    case "OnDialogStartEvent":
    case "OnEmissionFinishEvent":
    case "OnEmissionStageActivated":
    case "OnEmissionStageFinished":
    case "OnEmissionStartEvent":
    case "OnFactionBecomeEnemyEvent":
    case "OnFactionBecomeFriendEvent":
    case "OnGetCompatibleAttachEvent":
    case "OnHitEvent":
    case "OnInfotopicFinishEvent":
    case "OnInteractEvent":
    case "OnJournalQuestEvent":
    case "OnKillerCheckEvent":
    case "OnMoneyAmountReachedEvent":
    case "OnNPCDeathEvent":
    case "OnNPCBecomeEnemyEvent":
    case "OnNPCBecomeFriendEvent":
    case "OnNPCCreateEvent":
    case "OnNPCDefeatEvent":
    case "OnPlayerGetItemEvent":
    case "OnPlayerLostItemEvent":
    case "OnPlayerNoticedEvent":
    case "OnPlayerRankReachedEvent":
    case "OnUpgradeInstallEvent":
    case "OnSignalReceived":
      globalFunctions.set(subType, "");
      return "";

    case "ItemAdd":
    case "ConsoleCommand":
    case "LookAt":
    case "ALifeDirectorZoneSwitch":
    case "AchievementUnlock":
    case "ActivateAnomaly":
    case "ActivateInteractableObject":
    case "ActivateDataLayerCombination":
    case "AddNote":
    case "AddOrRemoveFromSquad":
    case "AddTechnicianSkillOrUpgrade":
    case "AddTutorialToPDA":
    case "BridgeCleanUp":
    case "BridgeEvent":
    case "CancelAllSideQuests":
    case "ChangeFaction":
    case "DeactivateZone":
    case "PlayEffect":
    case "PlayPostProcess":
    case "PlaySound":
    case "PlayVideo":
    case "ProtectLairNPCSquadItem":
    case "ReputationLocker":
    case "ResetAI":
    case "RestrictSave":
    case "RestrictionArea":
    case "SaveGame":
    case "ScheduledContainer":
    case "SearchPoint":
    case "SendSignal":
    case "SequenceStart":
    case "SetCharacterEffect":
    case "SetCharacterParam":
    case "SetDurabilityParam":
    case "SetFactionRestriction":
    case "SetHubOwner":
    case "SetLocationName":
    case "SetMeshGenerator":
    case "SetNPCSequentialAbility":
    case "SetName":
    case "SetPersonalRestriction":
    case "SetQuestGiver":
    case "SetSpaceRestrictor":
    case "SetTime":
    case "SetTimer":
    case "SetWeather":
    case "SetWounded":
    case "ShowFadeScreen":
    case "ShowLoadingScreen":
    case "ShowMarker":
    case "ShowTutorialWidget":
    case "TeleportCharacter":
    case "TimeLock":
    case "ToggleLairActivity":
    case "ToggleNPCHidden":
    case "TrackJournal":
    case "TrackShelter":
    case "Trigger":
    case "DisableNPCBark":
    case "DisableNPCInteraction":
    case "EmissionScheduleControl":
    case "EmissionStart":
    case "EnableDataLayer":
    case "EquipItemInHands":
    case "FlashlightOnOff":
    case "ForceInteract":
    case "GiveCache":
    case "HideLoadingScreen":
    case "HideTutorial":
    case "ItemRemove":
    case "LoadAsset":
    case "MoveInventory":
    case "NPCBark":
    case "SwitchQuestItemState":
    case "SpawnAnomaly":
    case "SpawnAnomalySpawner":
    case "SpawnArtifactSpawner":
    case "SpawnDeadBody":
    case "SpawnItemContainer":
    case "SpawnLair":
    case "SpawnSafeZone":
    case "SpawnSingleObj":
    case "SpawnSquad":
    case "SpawnTrigger":
    case "StartBenchmark":
      globalFunctions.set(subType, "");
      return `${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(struct[k]);
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;

    case "Container":
      globalFunctions.set(subType, "");
      return `result = ${subType}(${struct
        .entries()
        .map(([k]) => {
          if (EVENTS_INTERESTING_SIDS.has(k)) {
            questActors.add(struct[k]);
            return `questActors['${struct[k]}']`;
          }

          if (EVENTS_INTERESTING_PROPS.has(k)) {
            return struct[k];
          }

          return "";
        })
        .filter((k) => k)});`;
    case "OnTickEvent":
      globalFunctions.set(
        "OnTickEvent",
        "(fn, target) => { console.log(`OnTickEvent('${target ?? ''}', () => ${fn.name}())`); intervals.push(setInterval(() => fn(OnTickEvent), 200)) };",
      );
      return "";

    case "Random":
      return `result = (() => { 
      const rand = Math.random();
      console.log('Math.random() called with ${struct.PinWeights.entries().length} vars');
      ${struct.PinWeights.entries()
        .map(([_k, weight], i) => `if (rand >= ${weight}) return '${struct.OutputPinNames?.[i] ?? "impossible"}'`)
        .join("\nelse ")}
        })();`;

    case "SetAIBehavior":
      globalFunctions.set("setAIBehavior", "");
      return `result = setAIBehavior('${struct.TargetQuestGuid}', '${struct.BehaviorType.split("::").pop()}');`;

    case "SetDialog":
      globalFunctions.set("setDialog", "");
      globalVars.add(struct.DialogChainPrototypeSID);

      return `result = setDialog(${struct.DialogChainPrototypeSID}, [ ${struct.LastPhrases.entries().map(([_k, lp]) => {
        globalVars.add(lp.LastPhraseSID);
        globalVars.add("finish");
        globalVars.add(lp.NextLaunchedPhraseSID);
        return `${lp.LastPhraseSID} ${lp.NextLaunchedPhraseSID ? ", " + lp.NextLaunchedPhraseSID : ""} ${lp.FinishNode ? ", finish" : ""}`;
      })}]);`;

    case "SetGlobalVariable":
      globalVars.add(struct.GlobalVariablePrototypeSID);
      let op = "=";
      if (struct.ChangeValueMode === "EChangeValueMode::Add") {
        op = "+=";
      } else if (struct.ChangeValueMode === "EChangeValueMode::Subtract") {
        op = "-=";
      } else if (struct.ChangeValueMode === "EChangeValueMode::Set") {
        op = "=";
      }
      op = `${struct.GlobalVariablePrototypeSID} ${op} ${struct.VariableValue};`;
      return `console.log('${op}');\n${op}`.trim();

    case "SetItemGenerator":
      globalFunctions.set("setItemGenerator", "");
      questActors.add(struct.TargetQuestGuid);
      return `setItemGenerator(questActors['${struct.TargetQuestGuid}'], ${JSON.stringify(struct.ItemGeneratorSID)});`;

    case "SetJournal":
      globalFunctions.set("setJournal", "");
      globalVars.add(struct.JournalQuestSID);
      const setJrn = `setJournal(${struct.JournalQuestSID}, '${struct.JournalAction.split("::").pop()}'`;
      switch (struct.JournalEntity) {
        case "EJournalEntity::Quest":
          return `${setJrn});`;
        case "EJournalEntity::QuestStage":
          return `${setJrn}${struct.StageID ? ", " + struct.StageID : ""} );`;
      }

    case "Spawn":
      globalFunctions.set("spawn", "(actor) => { spawnedActors[actor] = true; console.log(`spawn(${questActors[actor]});`); return actor; }; //");
      questActors.add(struct.TargetQuestGuid);
      return `spawn(questActors['${struct.TargetQuestGuid}'], { ignoreDamageType: '${struct.IgnoreDamageType}', spawnHidden: ${struct.SpawnHidden}, spawnNodeExcludeType: '${struct.SpawnNodeExcludeType}' });`;
    case "Technical":
      return "";
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
  const subType = struct.NodeType.split("::").pop();
  return `result = ${struct.Conditions.entries()
    .filter(([k]) => k !== "ConditionCheckType")
    .map(([_k, cond]) => {
      if (typeof cond === "string") {
        return;
      }
      return cond 
        .map(([_k, c]) => {
          const subType = c.ConditionType.split("::").pop();
          switch (subType) {
            case "Weather": {
              const f = "getWeather";
              const weather = c.Weather?.split("::").pop() || "";
              const comp = getConditionComparance(c.ConditionComparance);
              globalFunctions.set(f, "() => 'Unknown';");
              return `${f}() ${comp} '${weather}'`;
            }
            case "Random": {
              const f = "getRandomValue";
              const comp = getConditionComparance(c.ConditionComparance);
              const val = typeof c.NumericValue === "number" ? c.NumericValue : 0;
              globalFunctions.set(f, "() => Math.random();");
              return `${f}() ${comp} ${val}`;
            }
            case "Trigger": {
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
            case "Emission": {
              const f = `isEmissionHappening`;
              const target = c.EmissionPrototypeSID;
              const comp = getConditionComparance(c.ConditionComparance);
              globalFunctions.set(f, "(s) => false");
              if (target) {
                questActors.add(target);
              }
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} true`;
            }
            case "Money": {
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
            case "Rank": {
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
            case "JournalState": {
              const f = `get${subType}`;
              const st = c.JournalState.split("::").pop();
              const sid = c.JournalQuestSID;
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "(s) => true");
              globalVars.add(sid);
              return `${f}(${sid}) ${comp} '${st}'`;
            }
            case "NodeState": {
              const f = `get${subType}`;
              const st = c.NodeState.split("::").pop();
              const sid = getNodeSid(c.TargetNode);
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "(s) => true");
              return `${f}(${sid}) ${comp} '${st}'`;
            }
            case "Bleeding": {
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
            case "HP": {
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
            case "HPPercent": {
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
            case "HungerPoints": {
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
            case "InventoryWeight": {
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
            case "Radiation": {
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
            case "AITarget": {
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
            case "ArmorState": {
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
            case "Awareness": {
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
            case "Bridge": {
              const linkedNodeSid = getNodeSid(c.LinkedNodePrototypeSID);
              const completedPins = c.CompletedNodeLauncherNames.entries()
                .map(([_k, v]) => JSON.stringify(v))
                .join(", ");
              return `hasQuestNodeExecuted(${linkedNodeSid}, [${completedPins}]) ${getConditionComparance(c.ConditionComparance)} true`;
            }
            case "ContextualAction": {
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
            case "CorpseCarry": {
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
            case "DistanceToNPC": {
              const f = `get${subType}`;
              const val = c.NumericValue;
              const sid1 = c.TargetCharacter;
              const sid2 = c.TargetNPC;
              const comp = getConditionComparance(c.ConditionComparance);
              questActors.add(sid1);
              questActors.add(sid2);
              globalFunctions.set(f, "() => 0;");
              return `${f}(questActors['${sid1}'], questActors['${sid2}']) ${comp} '${val}'`;
            }
            case "DistanceToPoint": {
              const f = `get${subType}`;
              const st = c.NumericValue;
              const point = getConditionPoint(c);
              const sid = point ? getCoordsStr(point.X, point.Y, point.Z) : "";
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "() => 0;");
              return `${f}('${sid}') ${comp} ${st}`;
            }
            case "Effect": {
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
            case "EquipmentInHands": {
              const f = "hasEquipmentInHands";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              const equipment = c.Equipment?.split("::").pop() || "";
              const itemSid = c.ItemPrototypeSID?.VariableValue ?? c.VariableValue;
              if (target) {
                questActors.add(target);
              }
              if (itemSid) {
                globalVars.add(itemSid);
              }
              globalFunctions.set(f, "() => false;");
              return `${f}(${target ? `questActors['${target}']` : ""}, ${itemSid ? itemSid : "null"}, ${JSON.stringify(equipment)}) ${comp} true`;
            }
            case "FactionRelationship": {
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
            case "FastTravelMoney": {
              const f = "getFastTravelMoney";
              const comp = getConditionComparance(c.ConditionComparance);
              const val = c.FastTravelMoney?.VariableValue ?? c.NumericValue ?? 0;
              globalFunctions.set(f, "() => 0;");
              return `${f}() ${comp} ${val}`;
            }
            case "GlobalVariable":
              globalVars.add(c.GlobalVariablePrototypeSID);
              return `${c.GlobalVariablePrototypeSID} ${getConditionComparance(c.ConditionComparance)} ${c.VariableValue}`;
            case "HasItemInQuickSlot": {
              const f = "hasItemInQuickSlot";
              const comp = getConditionComparance(c.ConditionComparance);
              const index = c.QuickSlotIndex ?? -1;
              const itemSid = c.QuickSlotItemSID || "";
              const consumable = c.QuickSlotConsumableType?.split("::").pop() || "";
              globalFunctions.set(f, "() => false;");
              return `${f}(${index}, ${JSON.stringify(itemSid)}, ${JSON.stringify(consumable)}) ${comp} true`;
            }
            case "IsAlive":
              globalFunctions.set(
                "IsAlive",
                "(actor) => { const isAlive = !!spawnedActors[actor]; console.log(`IsAlive(${actor}) === ${isAlive}`); return isAlive; };",
              );
              questActors.add(c.TargetCharacter);
              return `${getConditionComparance(c.ConditionComparance) === "===" ? "" : "!"}IsAlive(questActors['${c.TargetCharacter}'])`;

            case "IsCreated":
              globalFunctions.set(
                "IsCreated",
                "(actor) => { const created = !!spawnedActors[actor]; console.log(`IsCreated(${actor}) === ${created}`); return created; };",
              );
              questActors.add(c.TargetPlaceholder);
              return `${getConditionComparance(c.ConditionComparance) === "===" ? "" : "!"}IsCreated(questActors['${c.TargetPlaceholder}'])`;
            case "IsDialogMemberValid": {
              const f = "isDialogMemberValid";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter || c.DialogMember;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => true;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} true`;
            }
            case "IsEnoughAmmo": {
              const f = "isEnoughAmmo";
              const comp = getConditionComparance(c.ConditionComparance);
              const required = c.AmmoRequired ?? 0;
              globalFunctions.set(f, "() => true;");
              return `${f}(${required}) ${comp} true`;
            }
            case "IsOnline": {
              const f = "isOnline";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => true;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} true`;
            }
            case "IsWeaponJammed": {
              const f = "isWeaponJammed";
              const comp = getConditionComparance(c.ConditionComparance);
              globalFunctions.set(f, "() => false;");
              return `${f}() ${comp} true`;
            }
            case "IsWounded": {
              const f = "isWounded";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => false;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} true`;
            }
            case "ItemInContainer": {
              const f = `is${subType}`;
              const TargetItemContainer = c.TargetItemContainer;
              const ItemPrototypeSID = c.ItemPrototypeSID?.VariableValue ?? c.VariableValue;
              const ItemsCount = c.ItemsCount?.VariableValue ?? c.NumericValue ?? 0;
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "() => true;");
              globalVars.add(ItemPrototypeSID);
              questActors.add(TargetItemContainer);

              return `${f}(questActors['${TargetItemContainer}'], ${ItemPrototypeSID}, ${ItemsCount}) ${comp} true`;
            }
            case "ItemInInventory": {
              const f = `is${subType}`;
              const ItemPrototypeSID = c.ItemPrototypeSID?.VariableValue ?? c.VariableValue;
              const ItemsCount = c.ItemsCount?.VariableValue ?? c.NumericValue ?? 0;
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "() => true;");
              globalVars.add(ItemPrototypeSID);

              return `${f}(${ItemPrototypeSID}, ${ItemsCount}) ${comp} true`;
            }
            case "LookAtAngle": {
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
            case "Note": {
              const f = "hasNote";
              const comp = getConditionComparance(c.ConditionComparance);
              const note = c.NotePrototypeSID || "";
              globalFunctions.set(f, "() => false;");
              return `${f}(${JSON.stringify(note)}) ${comp} true`;
            }
            case "PersonalRelationship": {
              const f = `is${subType}`;
              const comp = getConditionComparance(c.ConditionComparance);
              const TargetCharacter = c.TargetCharacter;
              const Relationships = c.Relationships.split("::").pop();
              globalFunctions.set(f, "() => 'Friend';");
              questActors.add(TargetCharacter);
              globalVars.add(Relationships);

              return `${f}(questActors['${TargetCharacter}']) ${comp} ${Relationships}`;
            }
            case "PlayerOverload": {
              const f = "isPlayerOverloaded";
              const comp = getConditionComparance(c.ConditionComparance);
              const target = c.TargetCharacter;
              if (target) {
                questActors.add(target);
              }
              globalFunctions.set(f, "() => false;");
              return `${f}(${target ? `questActors['${target}']` : ""}) ${comp} true`;
            }
            case "Psy": {
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
            case "Stamina": {
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
    .join(andOr)} ${subType === "If" ? "" : "; \nif (!result) return"};`;
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
              questActors.add(v);
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
