import { MetaContext } from "./meta-type.mts";
import { ArtifactPrototype, QuestItemPrototype, QuestNodePrototype, SpawnActorPrototype, Struct } from "s2cfgtojson";
import { readFileAndGetStructs } from "./read-file-and-get-structs.mjs";
import { writeFileSync } from "node:fs";
import { onL1Finish } from "./l1-cache.mjs";
import { allDefaultArtifactPrototypes, allDefaultQuestItemPrototypes } from "./consts.mjs";
import { logger } from "./logger.mts";
import { normalizeQuestNodes } from "./quest/normalize.mts";
import { buildQuestScriptParts } from "./quest/codegen.mts";
import { getRuntimeSource } from "./quest/runtime.mts";
import path from "node:path";
import { getCfgFiles } from "./get-cfg-files.mts";
import { readFile } from "node:fs/promises";
import { baseCfgDir } from "./base-paths.mjs";
import { pathToFileURL } from "node:url";
import { renderQuestJsGlobalFunctionStub, resolveQuestNodesToJsInputPath as resolveQuestNodesToJsInputPathRaw } from "./quest/js-gen-utils.mts";

export async function questNodesToJs(context: MetaContext<QuestNodePrototype>) {
  const ir = normalizeQuestNodes(context);
  const { content, globalFunctions, globalVars, questActors, launchOnQuestStart } = buildQuestScriptParts(ir);
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
  const launchOnQuestStartStr = launchOnQuestStart.map((sid) => `${sid}(QuestStartCaller, '');`).join("\n");
  const usesSpawnedActors = globalFunctionsStr.includes("spawnedActors[") || content.includes("spawnedActors[");
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
    "setTimeout(() => {",
    "  intervals.forEach((i) => clearInterval(i));",
    "}, 1500);",
    launchOnQuestStartStr,
    "",
  ].join("\n");
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

export function resolveQuestNodesToJsInputPath(inputPath: string, cfgRoot = baseCfgDir) {
  return resolveQuestNodesToJsInputPathRaw(inputPath, cfgRoot);
}

export async function runQuestNodesToJsDebug(
  input = `

RSQ01.cfg
RSQ01_C01.cfg
RSQ01_C02.cfg
RSQ01_C03.cfg
RSQ01_C04.cfg
RSQ01_C05.cfg
RSQ01_C06.cfg 
 `,
) {
  await Promise.all(
    input
      .trim()
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      .map(async (filePath) => {
        const resolved = resolveQuestNodesToJsInputPath(filePath);
        const context = {
          fileIndex: 0,
          index: 0,
          array: [] as QuestNodePrototype[],
          filePath: resolved.contextFilePath,
          structsById: {},
          extraStructs: [],
        };
        const parsed = Struct.fromString<QuestNodePrototype>((await readFile(resolved.sourceFilePath)).toString());
        context.array = parsed.map((s) => s.clone());
        context.structsById = Object.fromEntries(context.array.map((s) => [s.__internal__.rawName, s as QuestNodePrototype]));

        const r = await questNodesToJs(context);
        writeFileSync(resolved.outputFilePath, r);
        // console.log(`\n\nExecuting quest node script for ${filePath}`);
        // await eval(r);
      }),
  );
  await onL1Finish();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runQuestNodesToJsDebug();
}
