import { MetaContext } from "./metaType.mjs";
import { ArtifactPrototype, QuestItemPrototype, QuestNodePrototype, SpawnActorPrototype, Struct } from "s2cfgtojson";
import { readFileAndGetStructs } from "./read-file-and-get-structs.mjs";
import { writeFileSync } from "node:fs";
import { onL1Finish } from "./l1-cache.mjs";
import { allDefaultArtifactPrototypes, allDefaultQuestItemPrototypes } from "./consts.mjs";
import { logger } from "./logger.mts";

const EVENTS = [
  "OnAbilityEndedEvent",
  "OnAbilityUsedEvent",
  "OnDialogStartEvent",
  "OnEmissionFinishEvent",
  "OnEmissionStageActivated",
  "OnEmissionStageFinished",
  "OnEmissionStartEvent",
  "OnFactionBecomeEnemyEvent",
  "OnFactionBecomeFriendEvent",
  "OnGetCompatibleAttachEvent",
  "OnHitEvent",
  "OnInfotopicFinishEvent",
  "OnInteractEvent",
  "OnJournalQuestEvent",
  "OnKillerCheckEvent",
  "OnMoneyAmountReachedEvent",
  "OnNPCDeathEvent",
  "OnTickEvent",
  "OnNPCBecomeEnemyEvent",
  "OnNPCBecomeFriendEvent",
  "OnNPCCreateEvent",
  "OnNPCDefeatEvent",
  "OnPlayerGetItemEvent",
  "OnPlayerLostItemEvent",
  "OnPlayerNoticedEvent",
  "OnSignalReceived",
];

const EVENTS_INTERESTING_PROPS = new Set(["ExpectedItemsCount", "ItemsCount"]);
const EVENTS_INTERESTING_SIDS = new Set(["TargetQuestGuid", "ItemPrototypeSID", "ItemSID", "SignalSenderGuid", "ContaineredQuestPrototypeSID"]);

export async function questNodesToJs(context: MetaContext<QuestNodeWithExtras>) {
  const globalVars = new Set<string>();
  const globalFunctions = new Map<string, string>();
  const questActors = new Set<string>();
  const launchOnQuestStart = [];
  globalVars.add("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); // Skif
  globalVars.add("None");

  const content = getContent(context, globalVars, globalFunctions, questActors, launchOnQuestStart);
  const actorInfos = await getQuestActorsInfo(questActors);

  return `
  // noinspection JSUnusedAssignment
  
  const intervals = [];
  const Skif = 'Skif';
  const spawnedActors = {};
  const questActors = ${JSON.stringify(actorInfos)}
  ${hasQuestNodeExecuted.toString()}
  ${waitForCallers.toString()}
  ${[...globalVars]
    .filter((v) => v && !context.structsById[v])
    .map((v) => `let ${v} = '${v}';`)
    .join("\n")}
  ${[...globalFunctions]
    .filter(([v]) => v && !context.structsById[v])
    .map(([v, i]) =>
      i
        ? `const ${v} = ${i}`
        : `const ${v} = (...args) => { console.log('${v}(', typeof args[0] === 'function' ? args[0].name + ', ' + args.slice(1).join(', ') : args, ');'); return '${v}'; }`,
    )
    .join("\n")}
  ${content}
  setTimeout(() => {
    intervals.forEach(i => clearInterval(i));
  }, 1500);
  ${launchOnQuestStart.map((sid) => `${sid}('QuestStart');`).join("\n")}
  `;
}

function questNodeToJavascript(structr: Struct, globalVars: Set<string>, globalFunctions: Map<string, string>, questActors: Set<string>): string {
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
      return processConditionNode(struct, globalVars, globalFunctions, questActors);

    case "Despawn":
      questActors.add(struct.TargetQuestGuid);
      globalFunctions.set("despawn", "(actor) => { delete spawnedActors[actor]; console.log(`despawn(\${actor})`); }; ");
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
      globalFunctions.set(subType, "");
      return "";

    case "ItemAdd":
    case "ConsoleCommand":
    case "LookAt":
    case "ALifeDirectorZoneSwitch":
    case "AchievementUnlock":
    case "ActivateAnomaly":
    case "ActivateInteractableObject":
    case "AddNote":
    case "AddOrRemoveFromSquad":
    case "AddTechnicianSkillOrUpgrade":
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
    case "OnSignalReceived":
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
      globalVars.add(struct.ItemGeneratorSID);
      questActors.add(struct.TargetQuestGuid);
      return `setItemGenerator(questActors['${struct.TargetQuestGuid}'], ${struct.ItemGeneratorSID});`;

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
      globalFunctions.set("spawn", "(actor) => { spawnedActors[actor] = true; console.log(`spawn(\${questActors[actor]});`); return actor; }; //");
      questActors.add(struct.TargetQuestGuid);
      return `spawn(questActors['${struct.TargetQuestGuid}'], { ignoreDamageType: '${struct.IgnoreDamageType}', spawnHidden: ${struct.SpawnHidden}, spawnNodeExcludeType: '${struct.SpawnNodeExcludeType}' });`;
    case "Technical":
      return "";
  }
  return "";
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

function waitForCallers(timeout: number, questFn: QuestFunction, caller: QuestFunction) {
  return new Promise((resolve: (_: void) => void, reject: (r: string) => void) => {
    const state = questFn.State;
    const conditions = questFn.Conditions;
    const to = setTimeout(() => {
      clearInterval(interval);
      reject(
        "Timeout waiting for condition(s):\n	" +
          conditions[caller.name]
            .map(({ SID: fnName, Name: outputPin }) => {
              const relevantState = state[fnName];
              if (relevantState) {
                const found = relevantState.find(({ SID: callerName, Name: callerOutputPin }) => {
                  const sidTheSame = callerName === fnName;
                  const pinTheSame = callerOutputPin === (outputPin || true);
                  return sidTheSame && pinTheSame;
                });
                if (found) {
                  return;
                }
              }

              return `${questFn.name} to be called by ${fnName} ${outputPin ? "with " + outputPin : ""}`;
            })
            .filter((r) => !!r)
            .join("\n	"),
      );
    }, timeout);
    const interval = setInterval(() => {
      const relevantConditions = conditions[caller.name];
      if (
        relevantConditions.every(({ SID: fnName, Name: outputPin }) => {
          const relevantState = state[fnName];
          if (!relevantState) {
            return false;
          }
          const found = relevantState.find(({ SID: callerName, Name: callerOutputPin }) => {
            const sidTheSame = callerName === fnName;
            const pinTheSame = callerOutputPin === (outputPin || true);
            return sidTheSame && pinTheSame;
          });
          return !!found;
        })
      ) {
        clearTimeout(to);
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

function hasQuestNodeExecuted(f: QuestFunction, completedOutputPins: string[] = []) {
  const state = f.State || {};
  let result: boolean;
  result = completedOutputPins.every((pin) => state[f.name]?.find((e) => e.SID === f.name && (pin === "None" ? true : e.Name === pin)));
  console.log(`hasQuestNodeExecuted(${f.name}) is ${f.State ? "" : "rolled to"} ${result}`);
  return result;
}

function processConditionNode(structT: Struct, globalVars: Set<string>, globalFunctions: Map<string, string>, questActors: Set<string>) {
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
        .entries()
        .map(([_k, c]) => {
          const subType = c.ConditionType.split("::").pop();
          switch (subType) {
            case "Weather": {
              throw new Error("not implemented");
            }
            case "Random": {
              throw new Error("not implemented");
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
              throw new Error("not implemented");
            }
            case "Rank": {
              throw new Error("not implemented");
            }
            case "JournalState": {
              const f = `get${subType}`;
              const st = c.JournalState.split("::").pop();
              const sid = c.JournalQuestSID;
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "(s) => true");
              globalVars.add(sid);
              globalVars.add(st);
              return `${f}(${sid}) ${comp} '${st}'`;
            }
            case "NodeState": {
              const f = `get${subType}`;
              const st = c.NodeState.split("::").pop();
              const sid = c.TargetNode;
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "(s) => true");
              globalVars.add(sid);
              globalVars.add(st);
              return `${f}(${sid}) ${comp} '${st}'`;
            }
            case "Bleeding": {
              throw new Error("not implemented");
            }
            case "HP": {
              throw new Error("not implemented");
            }
            case "HPPercent": {
              throw new Error("not implemented");
            }
            case "HungerPoints": {
              throw new Error("not implemented");
            }
            case "InventoryWeight": {
              throw new Error("not implemented");
            }
            case "Radiation": {
              throw new Error("not implemented");
            }
            case "AITarget": {
              throw new Error("not implemented");
            }
            case "ArmorState": {
              throw new Error("not implemented");
            }
            case "Awareness": {
              throw new Error("not implemented");
            }
            case "Bridge": {
              globalFunctions.set(c.LinkedNodePrototypeSID, "");
              c.CompletedNodeLauncherNames.entries().forEach(([_k, v]) => globalVars.add(v));

              return `hasQuestNodeExecuted(${c.LinkedNodePrototypeSID}, [${c.CompletedNodeLauncherNames.entries()
                .map(([_k, v]) => v)
                .join(", ")}]) ${getConditionComparance(c.ConditionComparance)} true`;
            }
            case "ContextualAction": {
              throw new Error("not implemented");
            }
            case "CorpseCarry": {
              throw new Error("not implemented");
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
              const sid = getCoordsStr(c.TargetPoint.X, c.TargetPoint.Y, c.TargetPoint.Z);
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "() => 0;");
              return `${f}('${sid}') ${comp} ${st}`;
            }
            case "Effect": {
              throw new Error("not implemented");
            }
            case "EquipmentInHands": {
              throw new Error("not implemented");
            }
            case "FactionRelationship": {
              throw new Error("not implemented");
            }
            case "FastTravelMoney": {
              throw new Error("not implemented");
            }
            case "GlobalVariable":
              globalVars.add(c.GlobalVariablePrototypeSID);
              return `${c.GlobalVariablePrototypeSID} ${getConditionComparance(c.ConditionComparance)} ${c.VariableValue}`;
            case "HasItemInQuickSlot": {
              throw new Error("not implemented");
            }
            case "IsAlive":
              globalFunctions.set(
                "IsAlive",
                "(actor) => { const isAlive = !!spawnedActors[actor]; console.log(`IsAlive(\${actor}) === \${isAlive}`); return isAlive; };",
              );
              questActors.add(c.TargetCharacter);
              return `${getConditionComparance(c.ConditionComparance) === "===" ? "" : "!"}IsAlive(questActors['${c.TargetCharacter}'])`;

            case "IsCreated":
              globalFunctions.set(
                "IsCreated",
                "(actor) => { const created = !!spawnedActors[actor]; console.log(`IsCreated(\${actor}) === \${created}`); return created; };",
              );
              questActors.add(c.TargetPlaceholder);
              return `${getConditionComparance(c.ConditionComparance) === "===" ? "" : "!"}IsCreated(questActors['${c.TargetPlaceholder}'])`;
            case "IsDialogMemberValid": {
              throw new Error("not implemented");
            }
            case "IsEnoughAmmo": {
              throw new Error("not implemented");
            }
            case "IsOnline": {
              throw new Error("not implemented");
            }
            case "IsWeaponJammed": {
              throw new Error("not implemented");
            }
            case "IsWounded": {
              throw new Error("not implemented");
            }
            case "ItemInContainer": {
              const f = `is${subType}`;
              const TargetItemContainer = c.TargetItemContainer;
              const ItemPrototypeSID = c.ItemPrototypeSID.VariableValue;
              const ItemsCount = c.ItemsCount.VariableValue;
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "() => true;");
              globalVars.add(ItemPrototypeSID);
              questActors.add(TargetItemContainer);

              return `${f}(questActors['${TargetItemContainer}'], ${ItemPrototypeSID}, ${ItemsCount}) ${comp} true`;
            }
            case "ItemInInventory": {
              const f = `is${subType}`;
              const ItemPrototypeSID = c.ItemPrototypeSID.VariableValue;
              const ItemsCount = c.ItemsCount.VariableValue;
              const comp = getConditionComparance(c.ConditionComparance);

              globalFunctions.set(f, "() => true;");
              globalVars.add(ItemPrototypeSID);

              return `${f}(${ItemPrototypeSID}, ${ItemsCount}) ${comp} true`;
            }
            case "LookAtAngle": {
              throw new Error("not implemented");
            }
            case "Note": {
              throw new Error("not implemented");
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
              throw new Error("not implemented");
            }
            case "Psy": {
              throw new Error("not implemented");
            }
            case "Stamina": {
              throw new Error("not implemented");
            }
          }
        })
        .join(andOr);
    })
    .join(andOr)} ${subType === "If" ? "" : "; \nif (!result) return"};`;
}

await Promise.all(
  `
RSQ01.cfg
RSQ01_C01.cfg
RSQ01_C02.cfg
RSQ01_C03.cfg
RSQ01_C04.cfg
RSQ01_C05.cfg
RSQ01_C06.cfg
RSQ04.cfg
RSQ04_C01.cfg
RSQ04_C02.cfg
RSQ04_C03.cfg
RSQ04_C04.cfg
RSQ04_C05.cfg
RSQ04_C06.cfg
RSQ04_C07.cfg
RSQ04_C08.cfg
RSQ04_C09.cfg
RSQ04_C10.cfg
RSQ05.cfg
RSQ05_C01.cfg
RSQ05_C02.cfg
RSQ05_C04.cfg
RSQ05_C05.cfg
RSQ05_C07.cfg
RSQ05_C08.cfg
RSQ05_C09.cfg
RSQ05_C10.cfg
RSQ06_C00___SIDOROVICH.cfg
RSQ06_C01___K_Z.cfg
RSQ06_C02___K_M.cfg
RSQ06_C03___K_B.cfg
RSQ06_C04___K_S.cfg
RSQ06_C05___B_B.cfg
RSQ06_C06___B_A.cfg
RSQ06_C07___B_A.cfg
RSQ06_C08___B_A.cfg
RSQ06_C09___S_P.cfg
RSQ07_C00_TSEMZAVOD.cfg
RSQ07_C01_K_Z.cfg
RSQ07_C02_K_M.cfg
RSQ07_C03_K_M.cfg
RSQ07_C04_K_B.cfg
RSQ07_C05_B_B.cfg
RSQ07_C06_B_A.cfg
RSQ07_C07_B_A.cfg
RSQ07_C08_B_A.cfg
RSQ07_C09_S_P.cfg
RSQ08_C00_ROSTOK.cfg
RSQ08_C01_K_M.cfg
RSQ08_C02_K_B.cfg
RSQ08_C03_K_S.cfg
RSQ08_C04_B_B.cfg
RSQ08_C05_B_B.cfg
RSQ08_C06_B_A.cfg
RSQ08_C07_B_A.cfg
RSQ08_C08_B_A.cfg
RSQ08_C09_S_P.cfg
RSQ09_C00_MALAHIT.cfg
RSQ09_C01_K_M.cfg
RSQ09_C02_K_M.cfg
RSQ09_C03_K_M.cfg
RSQ09_C04_K_S.cfg
RSQ09_C05_B_B.cfg
RSQ09_C06_B_A.cfg
RSQ09_C07_B_A.cfg
RSQ09_C08_B_A.cfg
RSQ09_C09_S_P.cfg
RSQ10_C00_HARPY.cfg
RSQ10_C01_K_M.cfg
RSQ10_C02_K_M.cfg
RSQ10_C03_K_S.cfg
RSQ10_C04_K_S.cfg
RSQ10_C05_B_B.cfg
RSQ10_C06_B_A.cfg
RSQ10_C07_B_A.cfg
RSQ10_C08_B_A.cfg
RSQ10_C09_S_P.cfg 
  `
    .trim()
    .split("\n")
    .map((f) => f.trim())
    .map(async (filePath) => {
      const context = {
        fileIndex: 0,
        index: 0,
        array: [] as QuestNodeWithExtras[],
        filePath: "/QuestNodePrototypes/" + filePath,
        structsById: {},
        extraStructs: [],
      };

      context.array = (await readFileAndGetStructs<QuestNodeWithExtras>("/QuestNodePrototypes/" + filePath)).map((s) => s.clone());
      context.structsById = Object.fromEntries(context.array.map((s) => [s.__internal__.rawName, s as QuestNodePrototype]));

      console.log(`\n\nProcessing quest node script for ${filePath}`);
      const r = await questNodesToJs(context);
      writeFileSync(`/home/sdwvit/.config/JetBrains/IntelliJIdea2025.2/scratches/${filePath}.js`, r);
      // console.log(`\n\nExecuting quest node script for ${filePath}`);
      // await eval(r);
    }),
).then(onL1Finish);

function getEventHandler(eventName: string) {
  return (target: string, content?: string) => `${eventName}(${target}${content ? `, ${content}` : ""});`;
}

function getStructBody(struct: QuestNodeWithExtras, globalVars: Set<string>, globalFunctions: Map<string, string>, questActors: Set<string>) {
  let launches = "";
  if (struct.Launches) {
    const useSwitch = struct.Launches.some(({ Name }) => Name);
    if (useSwitch) {
      launches = struct.Launches.map(({ Name, SID }) => {
        const isBool = Name === "True" || Name === "False";
        return `if (${isBool ? (Name === "True" ? "result" : "!result") : `result === "${Name}"`}) ${SID}(f, '${Name || ""}');`;
      }).join("\n");
    } else {
      launches = struct.Launches.map(({ SID, Name }) => `${SID}(f, '${Name || ""}');`).join("\n");
    }
    delete struct.Launches;
  }
  const isCoDep =
    struct.LaunchersBySID && Object.entries(struct.LaunchersBySID).length && Object.entries(struct.LaunchersBySID).some(([_k, v]) => v.length > 1);
  const consoleLog = `console.log('// ' + f.name + '(${isCoDep ? "', caller.name, ',', name, '" : ""});');`;
  return `
     function ${struct.SID}(caller, name) {         
         const f = ${struct.SID};
         ${isCoDep ? `f.Conditions ??= ${JSON.stringify(struct.LaunchersBySID || {})}` : ""}
         let result = None;
         f.State ??= {}; 
         f.State[caller.name] ||= [];
         f.State[caller.name].push({ SID: caller.name, Name: name || true });
         ${isCoDep ? "" : consoleLog}
         ${isCoDep ? `waitForCallers(1000, f, caller).then(() => {` : ""}
           ${questNodeToJavascript(struct, globalVars, globalFunctions, questActors)}
           ${launches}
           ${isCoDep ? consoleLog : ""}
           f.State[f.name] ||= [];
           f.State[f.name].push({ SID: f.name, Name: result });
         ${isCoDep ? "}).catch(e => console.log(e))" : ""} 
     }
    `.trim();
}

async function getQuestActorsInfo(questActors: Set<string>) {
  const questActorsArrWithoutSkif = [...questActors].filter((e) => e !== "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

  async function tryFindStructWithName(name: string) {
    try {
      return (await readFileAndGetStructs<SpawnActorPrototype>(name))[0];
    } catch (e) {
      logger.warn(`No struct found for ${name}`);
    }
  }

  const relevantStructs: [string, SpawnActorPrototype | QuestNodePrototype | QuestItemPrototype | ArtifactPrototype | undefined][] =
    await Promise.all(
      questActorsArrWithoutSkif.map(async (SID) => {
        const maybeKnownActor = allDefaultQuestItemPrototypes.find((s) => s.SID === SID) || allDefaultArtifactPrototypes.find((s) => s.SID === SID);
        if (maybeKnownActor) {
          return [SID, maybeKnownActor];
        }
        const maybeActor = await tryFindStructWithName(`${SID}.cfg`);
        if (maybeActor) {
          return [SID, maybeActor];
        }
        return [SID, undefined];
      }),
    );
  return Object.fromEntries(
    [["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "Skif"]].concat(
      relevantStructs.map(([SID, sap]) => {
        if (!sap) {
          return [SID, SID];
        }

        if ("PositionX" in sap) {
          const pos = ` @ ${getCoordsStr(sap.PositionX, sap.PositionY, sap.PositionZ)}`;

          const squadInfo = sap.SpawnedGenericMembers?.entries?.()
            .map(([_k, v]) => `${v.SpawnedSquadMembersCount} ${v.SpawnedPrototypeSID}`)
            .join(" + ");
          if (squadInfo) {
            return [sap.SID, `${squadInfo}${pos}`];
          }
          const maybeContainer = sap.SpawnedPrototypeSID && `${sap.SpawnedPrototypeSID}`;
          if (maybeContainer) {
            return [sap.SID, `${maybeContainer}${pos}`];
          }
          return [sap.SID, sap.__internal__?.refkey?.toString() || sap.SID];
        }

        if ("ArtifactType" in sap) {
          return [SID, SID];
        }

        if ("QuestSID" in sap) {
          return [SID, sap.QuestSID];
        }

        if ("IsQuestItem" in sap) {
          return [SID, SID];
        }
        return [SID, SID];
      }),
    ),
  );
}

function getCoordsStr(x: number, y: number, z: number) {
  return `${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`;
}

type QuestNodeWithExtras = QuestNodePrototype & {
  LaunchersBySID: Record<string, { SID: string; Name: string }[]>;
  Launches: { SID: string; Name: string }[];
};

function getContent(
  contextT: MetaContext<QuestNodePrototype>,
  globalVars: Set<string>,
  globalFunctions: Map<string, string>,
  questActors: Set<string>,
  launchOnQuestStart: any[],
) {
  const context = contextT as MetaContext<QuestNodeWithExtras>;
  const subscriptions = Object.fromEntries(EVENTS.map((e) => [e, getEventHandler(e)]));
  return context.array
    .map((struct) => {
      struct.SID = struct.SID.replace(/[!.]/g, "_");
      if (!struct.Launchers) {
        return struct;
      }
      struct.Launchers.forEach(([_k, launcher]) => {
        launcher.Connections.forEach(([_k, item]) => {
          context.structsById[item.SID].Launches ||= [];
          context.structsById[item.SID].Launches.push({
            SID: struct.SID,
            Name: item.Name,
          });
          struct.LaunchersBySID ||= {};
          struct.LaunchersBySID[item.SID] ||= [];
          launcher.Connections.forEach(([_k, e]) => {
            struct.LaunchersBySID[item.SID].push({ SID: e.SID, Name: e.Name });
          });
        });
      });
      return struct;
    })
    .map((struct) => {
      const subscription = subscriptions[struct.NodeType.split("::").pop()];
      if (struct.LaunchOnQuestStart && !subscription) {
        launchOnQuestStart.push(struct.SID);
      }

      /**
       * @param {string} caller - SID of the quest node that called this node.
       * @param {string} name - Name of the quest node output pin that called this node.
       */
      const structBody = getStructBody(struct, globalVars, globalFunctions, questActors);
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

      return `${structBody}\n${subscription(struct.SID, [...args].join(", "))}`;
    })
    .join("\n");
}
