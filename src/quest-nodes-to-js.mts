import type { MetaContext } from "./meta-type.mts";
import "./ensure-env.mts";
import { Struct } from "s2cfgtojson";
import type { ObjPrototype, QuestNodePrototype, SpawnActorPrototype } from "s2cfgtojson";
import { readFileAndGetStructs } from "./read-file-and-get-structs.mts";
import { writeFileSync } from "node:fs";
import { onL1Finish } from "./cache/l1-cache.mts";
import {
  allDefaultAmmoPrototypesRecord,
  allDefaultArmorPrototypesRecord,
  allDefaultArtifactPrototypesRecord,
  allDefaultAttachPrototypesRecord,
  allDefaultQuestItemPrototypesRecord,
  allDefaultWeaponPrototypesRecord,
} from "./consts.mts";
import { logger } from "./logger.mts";
import { normalizeQuestNodes } from "./quest/normalize.mts";
import { buildQuestScriptParts } from "./quest/codegen.mts";
import { getRuntimeSource } from "./quest/runtime.mts";
import { readFile } from "node:fs/promises";
import { baseCfgDir } from "./base-paths.mts";
import { pathToFileURL } from "node:url";
import {
  isRecentQuestNodesJsDebugOutput,
  renderQuestJsGlobalFunctionStub,
  resolveQuestNodesToJsInputPath as resolveQuestNodesToJsInputPathRaw,
} from "./quest/js-gen-utils.mts";
import path from "node:path";
import { getCfgFiles } from "./get-cfg-files.mts";

export async function questNodesToJs(context: MetaContext<QuestNodePrototype>) {
  const ir = normalizeQuestNodes(context);
  const { content, globalFunctions, globalVars, questActors, launchOnQuestStart } =
    buildQuestScriptParts(ir);
  globalVars.add("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); // Skif
  globalVars.add("None");
  const actorInfos = await getQuestActorsInfo(questActors);

  const questActorsStr = JSON.stringify(actorInfos, null, 2);
  const globalVarsStr = [...globalVars]
    .filter((v) => v && !context.structsById[v])
    .map((v) => `const ${v} = '${v}';`)
    .join("\n");
  const globalFunctionsStr = [...globalFunctions]
    .filter(([v]) => v && !context.structsById[v])
    .map(([v, i]) => renderQuestJsGlobalFunctionStub(v, i))
    .join("\n");
  // Sort so the main _Start entry point runs last, after all other LaunchOnQuestStart nodes
  launchOnQuestStart.sort((a, b) => {
    const aIsStart = a.endsWith("_Start");
    const bIsStart = b.endsWith("_Start");
    return aIsStart === bIsStart ? 0 : aIsStart ? 1 : -1;
  });
  const launchOnQuestStartStr = launchOnQuestStart
    .map((sid) => `console.log('\\n// ${sid}()');\n${sid}(QuestStartCaller, '');`)
    .join("\n");
  const usesSpawnedActors =
    globalFunctionsStr.includes("spawnedActors[") || content.includes("spawnedActors[");
  const usesQuestStartCaller = launchOnQuestStart.length > 0;
  const usesHasQuestNodeExecuted = content.includes("hasQuestNodeExecuted(");
  const usesWaitForCallers = content.includes("waitForCallers(");
  return [
    "// noinspection JSUnusedAssignment",
    "",
    "const intervals = [];",
    ...(usesQuestStartCaller ? ["const QuestStartCaller = { name: 'QuestStart' };"] : []),
    "const Skif = 'Skif';",
    ...(usesSpawnedActors ? ["const spawnedActors = {};"] : []),
    `const questActors = ${questActorsStr};`,
    "",
    getRuntimeSource({
      includeHasQuestNodeExecuted: usesHasQuestNodeExecuted,
      includeWaitForCallers: usesWaitForCallers,
    }),
    "",
    globalVarsStr,
    "",
    globalFunctionsStr,
    "",
    content,
    "",
    launchOnQuestStartStr,
    "setTimeout(() => {",
    "  intervals.forEach((i) => clearInterval(i));",
    "}, 1500);",
    "",
  ].join("\n");
}

async function getQuestActorsInfo(questActors: Set<string>) {
  const questActorsArrWithoutSkif = [...questActors].filter(
    (e) => e !== "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  );

  async function tryFindStructWithName(name: string) {
    try {
      return (await readFileAndGetStructs<SpawnActorPrototype>(name))[0];
    } catch (e) {
      logger.warn(`No struct found for ${name}`);
    }
  }

  const relevantStructs: [
    string,
    SpawnActorPrototype | QuestNodePrototype | ObjPrototype | undefined,
  ][] = await Promise.all(
    questActorsArrWithoutSkif.map(async (SID) => {
      const maybeKnownActor =
        allDefaultArmorPrototypesRecord[SID] ||
        allDefaultAmmoPrototypesRecord[SID] ||
        allDefaultAttachPrototypesRecord[SID] ||
        allDefaultWeaponPrototypesRecord[SID] ||
        allDefaultQuestItemPrototypesRecord[SID] ||
        allDefaultArtifactPrototypesRecord[SID];

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
      relevantStructs.map(([SID, spawnActorPrototype]) => {
        if (!spawnActorPrototype) {
          return [SID, SID];
        }

        if ("PositionX" in spawnActorPrototype) {
          const pos = ` @ ${getCoordsStr(spawnActorPrototype.PositionX, spawnActorPrototype.PositionY, spawnActorPrototype.PositionZ)}`;

          const squadInfo = spawnActorPrototype.SpawnedGenericMembers?.entries?.()
            .map(([_k, v]) => `${v.SpawnedSquadMembersCount} ${v.SpawnedPrototypeSID}`)
            .join(" + ");
          if (squadInfo) {
            return [spawnActorPrototype.SID, `${squadInfo}${pos}`];
          }
          const maybeContainer =
            (spawnActorPrototype.SpawnedPrototypeSID &&
              `${spawnActorPrototype.SpawnedPrototypeSID}`) ||
            (spawnActorPrototype.SpawnType && `${spawnActorPrototype.SpawnType.split("::").pop()}`);
          if (maybeContainer) {
            return [spawnActorPrototype.SID, `${maybeContainer}${pos}`];
          }
          return [
            spawnActorPrototype.SID,
            spawnActorPrototype.__internal__?.refkey?.toString() || spawnActorPrototype.SID,
          ];
        }

        if ("ArtifactType" in spawnActorPrototype) {
          return [SID, SID];
        }

        if ("QuestSID" in spawnActorPrototype) {
          return [SID, spawnActorPrototype.QuestSID];
        }

        if ("IsQuestItem" in spawnActorPrototype) {
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

export function resolveQuestNodesToJsInputPath(inputPath: string, cfgRoot = baseCfgDir) {
  return resolveQuestNodesToJsInputPathRaw(inputPath, cfgRoot);
}

export async function runQuestNodesToJsDebug(
  input = `
/media/nvme/STALKER2ZoneKit/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Garbage_L_Svora_Camp.cfg
 `,
) {
  await Promise.allSettled(
    input
      .trim()
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      .map(async (filePath) => {
        const resolved = resolveQuestNodesToJsInputPath(filePath);
        if (
          process.env.SKIP_RECENT_QUEST_NODES_JS_DEBUG_REGEN &&
          (await isRecentQuestNodesJsDebugOutput(resolved.outputFilePath))
        ) {
          logger.log(`Skipping recent quest node debug js ${resolved.outputFilePath}`);
          return;
        }
        const context = {
          fileIndex: 0,
          index: 0,
          array: [] as QuestNodePrototype[],
          filePath: resolved.contextFilePath,
          structsById: {},
          fileName: path.parse(resolved.contextFilePath).base,
          extraStructs: [],
        };
        const parsed = Struct.fromString<QuestNodePrototype>(
          (await readFile(resolved.sourceFilePath)).toString(),
        );
        context.array = parsed.map((s) => s.clone());
        context.structsById = Object.fromEntries(
          context.array.map((s) => [s.__internal__.rawName, s as QuestNodePrototype]),
        );

        const r = await questNodesToJs(context);
        writeFileSync(resolved.outputFilePath, r);
        // console.log(`\n\nExecuting quest node script for ${filePath}`);
        // await eval(r);
      }),
  );
  await onL1Finish();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runQuestNodesToJsDebug((await getCfgFiles("QuestNodePrototypes/", true)).join("\n"));
}
