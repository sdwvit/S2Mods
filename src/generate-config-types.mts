import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { GetStructType, QuestNodePrototype, Struct } from "s2cfgtojson";
import { getCfgFiles } from "./get-cfg-files.mjs";
import { deepMerge } from "./deep-merge.mts";
import { logger } from "./logger.mjs";
import { projectRoot } from "./base-paths.mts";
import { getFromL1GlobalTypeGenCache, L1GlobalTypeGenCache, L1GlobalTypeGenCacheState, onL1GlobalTypeGenFinish } from "./l1type-gen-cache.mts";
import { node } from "./cmd.mts";
import { onL3Finish } from "./l3-cache.mts";

const DEFAULT_OUTPUT = path.join(projectRoot, "types.mts");
const CATEGORY_PREFIX = "$cat_";
const walk = (node: GetStructType<{}>, path: string[] = [], mergedByCategory: Record<string, Struct>, fileCategory: string) => {
  Object.keys(node).forEach((key) => {
    if (key !== "__internal__" && typeof node[key] === "object" && node[key]) {
      const child = node[key];
      const newPath = [...path, key];

      let validCategoryIndex = newPath.length - 1;
      let validCategory = "";
      while (Number(newPath[validCategoryIndex]).toString() === newPath[validCategoryIndex] && validCategoryIndex > 0) {
        validCategoryIndex--;
        validCategory += "Item";
      }
      if (Number(newPath[validCategoryIndex]).toString() !== newPath[validCategoryIndex]) {
        validCategory = newPath[validCategoryIndex] + validCategory;
      }
      if ((child as QuestNodePrototype).NodeType?.startsWith("EQuestNodeType::")) {
        validCategory = (child as QuestNodePrototype).NodeType.slice("EQuestNodeType::".length);
      }
      validCategory = `${fileCategory}${validCategory}`;

      mergedByCategory[validCategory] ||= new Struct();
      walk(child, newPath, mergedByCategory, fileCategory);

      node[key] = `${CATEGORY_PREFIX}${validCategory}`;
      const merged = mergedByCategory[validCategory];
      deepMerge(merged, child);
    }
  });
};

export async function generateConfigTypes(outputFile = DEFAULT_OUTPUT) {
  const cfgFiles = await getCfgFiles(".cfg");
  const mergedByCategory: Record<string, GetStructType<Record<string, unknown>>> = {};
  const totalFiles = cfgFiles.length;
  let scannedFiles = 0;
  let currentFile = "";

  let statusTimer: NodeJS.Timeout | undefined;
  if (totalFiles > 0) {
    statusTimer = setInterval(() => {
      const currentLabel = currentFile || "idle";
      logger.log(`Scanning ${scannedFiles}/${totalFiles}: ${currentLabel}`);
    }, 3000);
  }

  try {
    await loadStructsWithNode(
      cfgFiles,
      (filePath, structs) => {
        currentFile = filePath;
        scannedFiles += 1;
        if (!L1GlobalTypeGenCache[filePath] || L1GlobalTypeGenCache[filePath].length !== structs.length) {
          L1GlobalTypeGenCache[filePath] = structs.map((s) => s.clone());
          L1GlobalTypeGenCacheState.needsUpdate = true;
        }
        if (!structs?.length) return;

        let fileCategory = categorizeConfig(filePath);

        for (const s of structs) {
          let structCategory = fileCategory;
          if ((s as QuestNodePrototype).NodeType?.startsWith("EQuestNodeType::")) {
            structCategory = `QuestNodePrototype${(s as QuestNodePrototype).NodeType.slice("EQuestNodeType::".length)}`;
          }
          const merged =
            mergedByCategory[structCategory] || (mergedByCategory[structCategory] = new Struct() as GetStructType<Record<string, unknown>>);
          walk(s, [s.__internal__.rawName], mergedByCategory, fileCategory);
          deepMerge(merged, s);
        }
      },
      (file) => {
        currentFile = file;
      },
    );
  } finally {
    if (statusTimer) clearInterval(statusTimer);
  }

  const fileContents = renderTypesFile(mergedByCategory);
  fs.writeFileSync(outputFile, fileContents, "utf8");
  logger.log(`Wrote ${Object.keys(mergedByCategory).length} category types to ${outputFile}`);
}

async function loadStructsWithNode(
  filePaths: string[],
  onResult: (filePath: string, structs: Struct[]) => void,
  setCurrentFile: (file: string) => void,
) {
  if (!filePaths.length) return;

  const queue = filePaths
    .filter((fp) => {
      if (getFromL1GlobalTypeGenCache(fp)) {
        onResult(fp, getFromL1GlobalTypeGenCache(fp));
        return false;
      }
      return true;
    })
    .slice();
  if (!queue.length) {
    return;
  }

  const workerCount = Math.max(1, Math.min(os.cpus().length, queue.length));
  const batchSize = 1000;
  const batches: string[][] = [];
  while (queue.length) {
    batches.push(queue.splice(0, batchSize));
  }
  const workerPath = path.join(import.meta.dirname, "generate-config-types.worker.mts");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2cfg-types-"));
  const active = new Set<string>();
  let jobId = 0;

  const updateCurrentFile = () => {
    const nextActive = active.values().next().value as string | undefined;
    setCurrentFile(nextActive || "");
  };

  const runJob = async (fileBatch: string[]) => {
    if (!fileBatch.length) return;
    const id = jobId++;
    const outputFile = path.join(tempRoot, `result-${id}.json`);
    const listFile = path.join(tempRoot, `batch-${id}.list.json`);
    fs.writeFileSync(listFile, JSON.stringify(fileBatch), "utf8");
    const exitCode = await node(workerPath, {
      GENERATE_CONFIG_LIST: listFile,
      GENERATE_CONFIG_OUTPUT: outputFile,
    });
    let payload: { results: WorkerMessage[] };
    try {
      const raw = fs.readFileSync(outputFile, "utf8");
      payload = JSON.parse(raw) as { results: WorkerMessage[] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read worker output for ${fileBatch[0]}: ${message}`);
    } finally {
      try {
        fs.unlinkSync(outputFile);
      } catch {
        // ignore cleanup errors
      }
      try {
        fs.unlinkSync(listFile);
      } catch {
        // ignore cleanup errors
      }
    }

    for (const result of payload.results || []) {
      if (result.error) throw deserializeWorkerError(result.error);
      const parsed = (result.structs || []).map((entry) => Struct.fromJson<Struct>(entry as Struct, true));
      onResult(result.filePath || fileBatch[0], parsed);
    }
    if (typeof exitCode === "number" && exitCode !== 0) {
      throw new Error(`Worker exited with code ${exitCode} for ${fileBatch[0]}`);
    }
  };

  const runNext = async (): Promise<void> => {
    const next = batches.shift();
    if (!next) return;
    active.add(next[0]);
    updateCurrentFile();
    try {
      await runJob(next);
    } finally {
      active.delete(next[0]);
      updateCurrentFile();
    }
    await runNext();
  };

  try {
    await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function categorizeConfig(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parsed = path.posix.parse(normalized);
  let segments = parsed.dir.split("/").filter(Boolean);
  segments = segments.slice(segments.indexOf("GameData") + 1);
  const knownFolderCategories = [
    "SpawnActorPrototypes",
    "DialogChainPrototypes",
    "DialogPoolPrototypes",
    "DialogPrototypes",
    "JournalQuestPrototypes",
    "QuestNodePrototypes",
    "QuestPrototypes",
  ];

  for (const folderName of knownFolderCategories) {
    if (normalized.includes(`/${folderName}/`)) return folderName.slice(0, -1);
  }

  if (parsed.name.endsWith("Prototypes")) return parsed.name.slice(0, -1);

  let folderMatch: string | undefined;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].endsWith("Prototypes")) {
      folderMatch = segments[i];
      break;
    }
  }
  if (folderMatch) return folderMatch.slice(0, -1);

  const name = segments[segments.length - 2] ?? segments[0] ?? parsed.name ?? "UnknownConfig";
  if (name.endsWith("s")) {
    return name.slice(0, -1);
  }
  return name;
}

let duplicateKeys: Record<string, string> = {};
const usedEnums = new Set<string>();
let KNOWN_ENUM_TYPES = new Set([
  "EAIConstraintType",
  "EAIMovementPose",
  "EALifeDirectorScenarioTarget",
  "EALifeFactionGoalType",
  "EAbility",
  "EAbilityStatePhase",
  "EAgentArchetype",
  "EAgentType",
  "EAimAssistPresetType",
  "EAimAssistWeightType",
  "EAmmoCaliber",
  "EAmmoType",
  "EAnimationReloadTypes",
  "EAnomalyElementType",
  "EAnomalyType",
  "EApplyRestrictionType",
  "EArchiartifactType",
  "EArmorScale",
  "EArtifactRarity",
  "EArtifactSpawnerExcludeRule",
  "EArtifactType",
  "EAspectRatio",
  "EAttachSlot",
  "EAttachType",
  "EAttractionPointType",
  "EAudioRoomPresetBandwidth",
  "EAvailableCoverActionsSide",
  "EAvailableCoverEnterTypes",
  "EBehaviorType",
  "EBeneficial",
  "EBodyMeshType",
  "EBoltActionWeaponState",
  "EBoolProviderType",
  "EBrokenGameDataFilter",
  "ECalculateSignificance",
  "ECameraShakeEffectSubtype",
  "ECameraShakeGroupType",
  "ECameraShakeType",
  "ECauseOfDeath",
  "EChangeValueMode",
  "ECollisionChannel",
  "ECollisionFormType",
  "EColorBlindMode",
  "EConditionCheckType",
  "EConditionComparance",
  "EConnectionLineState",
  "EConsumableType",
  "EContextualActionBodyPart",
  "EContextualActionEffectType",
  "EContextualActionNeeds",
  "EContextualActionNodeType",
  "EContextualActionPreconditionType",
  "EContextualAgentType",
  "ECrosshairType",
  "ECrosshairTypeSetting",
  "ECustomDataDistribution",
  "EDamageBone",
  "EDamageSource",
  "EDamageType",
  "EDeadZoneType",
  "EDestructionActionType",
  "EDetectorType",
  "EDialogAction",
  "EDialogAnimationType",
  "EDialogEventCategory",
  "EDialogEventType",
  "EDialogPriority",
  "EDistanceSelectorCondition",
  "EDuplicateResolveType",
  "EEffectDisplayType",
  "EEffectSource",
  "EEffectType",
  "EEmissionAIEvent",
  "EEmissionStage",
  "EEmotionalFaceMasks",
  "EEvadeActionType",
  "EFaceBlockingBlendMasks",
  "EFastUseGroupType",
  "EFireType",
  "EFlashlightAction",
  "EFlashlightPriority",
  "EFleeType",
  "EFloatProviderType",
  "EGSCTeleportType",
  "EGameDifficulty",
  "EGlobalVariableType",
  "EGoalPriority",
  "EGrenadeType",
  "EGuardType",
  "EHealingType",
  "EHideViewType",
  "EIgnoreDamageType",
  "EInputController",
  "EInputKey",
  "EInputMappingContextPriority",
  "EInteractFXType",
  "EInventoryEquipmentSlot",
  "EItemContainerType",
  "EItemGenerationCategory",
  "EItemInfoType",
  "EItemType",
  "EJamType",
  "EJournalAction",
  "EJournalEntity",
  "EJournalState",
  "ELairType",
  "ELineDirection",
  "ELoadingDestination",
  "ELocalizationLanguage",
  "EMagazineMeshType",
  "EMainHandEquipmentType",
  "EMappingContext",
  "EMarkerState",
  "EMarkerType",
  "EMeshSubType",
  "EMisansceneNodeType",
  "EModifiedCharacterParam",
  "EModifyAbilitySequenceQuestNodeMode",
  "EMovementBehaviour",
  "EMusicState",
  "EMutantAttackType",
  "ENPCType",
  "ENiagaraProviderType",
  "ENoteType",
  "ENotificationEventType",
  "EObjAnim",
  "EObjFloatParams",
  "EObjMesh",
  "EObjSkeletalMeshTraceBone",
  "EObjType",
  "EOutputDeviceEffect",
  "EOverrideDialogTopic",
  "EOverweightLock",
  "EPDATutorialCategory",
  "EPassiveDetectorType",
  "EPerformanceBoostDLSSFGMode",
  "EPerformanceBoostFFXFIMode",
  "EPerformanceBoostInputLatencyReflex",
  "EPerformanceBoostUpscalingMethod",
  "EPhysicalMaterialType",
  "EPlayerActionInputModifier",
  "EPlayerActionInputTrigger",
  "EPlayerActionInputTypeCustom",
  "EPostEffectProcessorType",
  "EPostProcessEffectType",
  "EPsyNPCType",
  "EQuestConditionType",
  "EQuestEventType",
  "EQuestNodeState",
  "EQuestNodeType",
  "EQuestRewardType",
  "ERadiationInnerOffsetPreset",
  "ERadiationPreset",
  "ERank",
  "ERegion",
  "ERelationChangingEvent",
  "ERelationLevel",
  "ERepetitions",
  "ERequiredSquadMembers",
  "ESaveType",
  "ESaveSubType",
  "EScenarioBranch",
  "ESensitivityType",
  "ESettingCategoryType",
  "ESmartCoverType",
  "ESortGroup",
  "ESoundEventType",
  "ESpaceRestrictionType",
  "ESpawnNodeExcludeType",
  "ESpawnType",
  "ESpeechEventType",
  "EStaminaAction",
  "EStateTag",
  "ESubtitlesSize",
  "ESummonBehaviourOnSpawn",
  "ESummonSpawnOrientation",
  "EThreatActionType",
  "EThreatAwareness",
  "EThreatType",
  "EThrowQueueDisarmMode",
  "ETriggerReact",
  "EUISound",
  "EUpgradeTargetPartType",
  "EUpgradeVerticalPosition",
  "EUserNotificationType",
  "EVitalType",
  "EWaterImmersionLevel",
  "EWeaponState",
  "EWeaponType",
  "EWeather",
  "EALifeGroupPriorityType",
  "ELairPreferredSpawnType",
  "EPillowAnomalyBiomeType",
  "ETriggerShape",
  "EWeatherParam",
  "EWeightStatus",
  "EZombificationType",
  "ESoundEffectSubtype",
  "EInputAxisType",
  "EActionType",
  "EObjBoolParams",
  "ECombatTactics",
  "EAgentRankMask",
]);

const knownEnums = KNOWN_ENUM_TYPES;

const getUniqueStructFingerprint = (s: GetStructType<Record<string, unknown>>) => {
  return s
    .entries()
    .sort(([a], [b]) => a.localeCompare(b))
    .map((e) => `${e[0]}_:_${valueToTypeLiteral(e[1], 0)}`)
    .join("_\n_");
};

function renderTypesFile(mergedByCategory: Record<string, GetStructType<Record<string, unknown>>>) {
  duplicateKeys = {};
  usedEnums.clear();
  const lines: string[] = [];

  const enumImports = [...usedEnums].sort();
  const importItems = ["GetStructType", ...enumImports];
  lines.push(`import type { ${importItems.join(", ")} } from "s2cfgtojson";`);
  lines.push("");

  const byFingerprint = Object.entries(mergedByCategory)
    .map(([cat, s]) => [cat, s, getUniqueStructFingerprint(s)] as const)
    .filter(([cat, _, fingerprint]) => !cat.includes("_dupe_") && !fingerprint.includes("_dupe_"));
  const byFingerprintSorted = byFingerprint.sort(([catA], [catB]) => {
    /**
     * If category A is same length as category B, pick A-Z sort
     * If category A is longer than category B, pick 0-9 sort
     */
    if (catA.length === catB.length) {
      return catA.localeCompare(catB);
    }
    return catA.length > catB.length ? 1 : -1;
  });
  const byFingerprintDeduped = byFingerprintSorted.reduce(
    (mem, [category, struct, fingerprint]) => {
      if (mem[fingerprint]) {
        duplicateKeys[category] = mem[fingerprint][0];
      } else {
        mem[fingerprint] = [category, struct];
      }
      return mem;
    },
    {} as Record<string, [string, Struct]>,
  );

  const deduplicated = Object.fromEntries(Object.values(byFingerprintDeduped));

  const entries = Object.entries(deduplicated).sort(([a], [b]) => a.localeCompare(b));
  for (const [category, merged] of entries) {
    const typeName = toTypeName(category);
    const typeLiteral = structToTypeLiteral(merged, 0);
    lines.push(`export type ${typeName} = GetStructType<${typeLiteral}>;`);
    lines.push("");
  }

  if (usedEnums.size) {
    const updatedImports = ["GetStructType", ...[...usedEnums].sort()];
    lines[1] = `import type { ${updatedImports.join(", ")} } from "s2cfgtojson";`;
  }

  return lines.reduce((mem, l) => mem + l + "\n", "");
}

function toTypeName(category: string) {
  const cleaned = category.replace(/[^a-zA-Z0-9_]/g, "_");
  const safe = cleaned.length ? cleaned : "UnknownConfig";
  return /^[A-Za-z_]/.test(safe) ? safe : `Config_${safe}`;
}

function structToTypeLiteral(struct: Struct, indent: number): string {
  let type = "";
  const elementTypes = new Set<string>();
  struct
    .entries()
    .filter(([k]) => Number(k).toString() === k)
    .forEach(([, value]) => elementTypes.add(valueToTypeLiteral(value, indent)));
  if (elementTypes.size) {
    const union = unionTypes([...elementTypes]);
    const wrapped = union.includes(" | ") ? `(${union})` : union;
    type += `${wrapped}[]`;
  }

  const entries = struct
    .entries()
    .filter(([k]) => Number(k).toString() !== k)
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
  if (!entries.length) {
    return type || "{}";
  }

  const indentStr = "  ".repeat(indent);
  const innerIndent = "  ".repeat(indent + 1);
  const lines = ["{"];

  for (const [key, value] of entries) {
    const propName = renderKey(key);
    const typeLiteral = valueToTypeLiteral(value, indent + 1);
    if (!elementTypes.has(typeLiteral)) {
      lines.push(`${innerIndent}${propName}: ${typeLiteral};`);
    }
  }

  lines.push(`${indentStr}}`);
  return type + " & " + lines.join("\n");
}

function valueToTypeLiteral(value: unknown, indent: number): string {
  if (value instanceof Struct) return structToTypeLiteral(value, indent);
  if (Array.isArray(value)) {
    const elementTypes = new Set<string>();
    value.forEach((v) => elementTypes.add(valueToTypeLiteral(v, indent)));
    const union = unionTypes([...elementTypes]);
    const wrapped = union.includes(" | ") ? `(${union})` : union;
    return `${wrapped}[]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length) return "{}";

    const indentStr = "  ".repeat(indent);
    const innerIndent = "  ".repeat(indent + 1);
    const lines = ["{"];
    for (const [key, val] of entries) {
      const propName = renderKey(key);
      const typeLiteral = valueToTypeLiteral(val, indent + 1);
      lines.push(`${innerIndent}${propName}: ${typeLiteral};`);
    }
    lines.push(`${indentStr}}`);
    return lines.join("\n");
  }

  if (value === null || value === undefined) return "unknown";
  switch (typeof value) {
    case "string":
      return stringToTypeLiteral(value);
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "unknown";
  }
}

const ENUM_VALUE_PATTERN = /^(E[A-Za-z0-9_]+)::/;
function stringToTypeLiteral(value: string) {
  const match = value.match(ENUM_VALUE_PATTERN);
  if (match) {
    const enumType = match[1];
    if (knownEnums.has(enumType)) {
      usedEnums.add(enumType);
      if (enumType === "EQuestNodeType") {
        return `'${value}' & EQuestNodeType`;
      }
      return enumType;
    }
  }
  if (value.startsWith(CATEGORY_PREFIX)) {
    const toRet = value.slice(CATEGORY_PREFIX.length);
    return duplicateKeys[toRet] ?? toRet;
  }
  return "string";
}

function unionTypes(types: string[]) {
  const unique = Array.from(new Set(types.filter(Boolean)));
  if (!unique.length) return "unknown";
  if (unique.length === 1) return unique[0];
  return unique.sort().join(" | ");
}

function renderKey(key: string | number | symbol) {
  if (typeof key === "number") return String(key);
  const str = String(key);
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(str) ? str : JSON.stringify(str);
}

type WorkerMessage = {
  filePath: string;
  structs?: unknown[];
  error?: { name?: string; message?: string; stack?: string };
};

function deserializeWorkerError(error: WorkerMessage["error"]) {
  if (!error) return new Error("Unknown worker error");
  const err = new Error(error.message || "Worker error");
  if (error.name) err.name = error.name;
  if (error.stack) err.stack = error.stack;
  return err;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateConfigTypes();
  await onL1GlobalTypeGenFinish();
  await onL3Finish();
}
