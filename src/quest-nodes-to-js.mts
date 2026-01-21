import { MetaContext } from "./meta-type.mts";
import { ArtifactPrototype, QuestItemPrototype, QuestNodePrototype, SpawnActorPrototype } from "s2cfgtojson";
import { readFileAndGetStructs } from "./read-file-and-get-structs.mjs";
import { writeFileSync } from "node:fs";
import { onL1Finish } from "./l1-cache.mjs";
import { allDefaultArtifactPrototypes, allDefaultQuestItemPrototypes } from "./consts.mjs";
import { logger } from "./logger.mts";
import { normalizeQuestNodes } from "./quest/normalize.mts";
import { buildQuestScriptParts } from "./quest/codegen.mts";
import { RUNTIME_SOURCE } from "./quest/runtime.mts";
import path from "node:path";
import { getCfgFiles } from "./get-cfg-files.mts";

export async function questNodesToJs(context: MetaContext<QuestNodePrototype>) {
  const ir = normalizeQuestNodes(context);
  const { content, globalFunctions, globalVars, questActors, launchOnQuestStart } = buildQuestScriptParts(ir);
  globalVars.add("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); // Skif
  globalVars.add("None");
  const actorInfos = await getQuestActorsInfo(questActors);

  const questActorsStr = JSON.stringify(actorInfos, null, 2);
  return [
    "// noinspection JSUnusedAssignment",
    "",
    "const intervals = [];",
    "const QuestStartCaller = { name: 'QuestStart' };",
    "const Skif = 'Skif';",
    "const spawnedActors = {};",
    `const questActors = ${questActorsStr};`,
    "",
    RUNTIME_SOURCE,
    "",
    [...globalVars]
      .filter((v) => v && !context.structsById[v])
      .map((v) => `let ${v} = '${v}';`)
      .join("\n"),
    "",
    [...globalFunctions]
      .filter(([v]) => v && !context.structsById[v])
      .map(([v, i]) =>
        i
          ? `const ${v} = ${i}`
          : `const ${v} = (...args) => { console.log('${v}(', typeof args[0] === 'function' ? args[0].name + ', ' + args.slice(1).join(', ') : args, ');'); return '${v}'; }`,
      )
      .join("\n"),
    "",
    content,
    "",
    "setTimeout(() => {",
    "  intervals.forEach((i) => clearInterval(i));",
    "}, 1500);",
    launchOnQuestStart.map((sid) => `${sid}(QuestStartCaller, '');`).join("\n"),
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

await Promise.all(
  `
  EQ98_P.cfg
  EQ98.cfg
  `
    .trim()
    .split("\n")
    .map((f) => f.trim())
    .map(async (filePath) => {
      const context = {
        fileIndex: 0,
        index: 0,
        array: [] as QuestNodePrototype[],
        filePath: "/QuestNodePrototypes/" + filePath,
        structsById: {},
        extraStructs: [],
      };

      context.array = (await readFileAndGetStructs<QuestNodePrototype>("/QuestNodePrototypes/" + filePath)).map((s) => s.clone());
      context.structsById = Object.fromEntries(context.array.map((s) => [s.__internal__.rawName, s as QuestNodePrototype]));

      console.log(`\n\nProcessing quest node script for ${filePath}`);
      const r = await questNodesToJs(context);
      writeFileSync(`${path.parse((await getCfgFiles(filePath))[0]).dir}/${filePath}.js`, r);
      // console.log(`\n\nExecuting quest node script for ${filePath}`);
      // await eval(r);
    }),
).then(onL1Finish);
