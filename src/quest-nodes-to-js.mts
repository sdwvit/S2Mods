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
C_E02_MQ03_BatyaOutOfBar_Preload.cfg
C_E02_MQ03_Pripoy_Preload.cfg
C_E02_MQ03_Solder.cfg
C_E03_MQ02_PsiBomb_Cutscene.cfg
C_E03_MQ02_PsiBomb_Preload.cfg
C_E03_MQ05_TerriconePeak_Cutscene.cfg
C_E03_MQ05_TerriconePeak_Cutscene_Preload.cfg
C_E03_MQ06_ScarMeeting_Cutscene.cfg
C_E03_MQ06_ScarMeeting_Cutscene_Preload.cfg
C_E03_MQ06_TerriconeVarta_Cutscene.cfg
C_E03_MQ06_TerriconeVarta_Cutscene_Preload.cfg
C_E04_MQ01_StriderAndFaust_Cutscene.cfg
C_E04_MQ01_StriderAndFaust_Preload.cfg
C_E05_MQ02_ThatNimble_Cutscene.cfg
C_E05_MQ02_ThatNimble_Preload.cfg
C_E05_MQ03_ClearSky_Cutscene.cfg
C_E05_MQ03_ClearSky_Preload.cfg
C_E06_MQ01_TemplesDoorstep_Cutscene.cfg
C_E06_MQ02_Agatha_Preload.cfg
C_E06_MQ02_Experiment_Preload.cfg
C_E06_MQ02_MeetingAgatha_Cutscene.cfg
C_E06_MQ02_Signal_A_Cutscene.cfg
C_E06_MQ02_Signal_B_Cutscene.cfg
C_E06_MQ02_TheCaribbeanExperiment_Cutscene.cfg
C_E06_MQ02_ZoneAlive_Preload.cfg
C_E06_MQ04_TheZoneIsAlive_Cutscene.cfg
C_E07_MQ01_PsiImmunity.cfg
C_E07_MQ01_PsiImmunity_Preload.cfg
C_E07_MQ03_ExtremeMeasures_Cutscene.cfg
C_E07_MQ03_ExtremeMeasures_Preload.cfg
C_E08_MQ01_Lazaret.cfg
C_E08_MQ03_Dvupalov_Preload.cfg
C_E08_MQ03_Lazaret_Preload.cfg
C_E08_MQ06_DeathOfFaust_Cutscene.cfg
C_E09_MQ01_TheEnemyUnseen_Cutscene.cfg
C_E09_MQ01_TheEnemyUnseen_Preloader.cfg
C_E10_MQ01_Kaymanov_Cutscene.cfg
C_E10_MQ01_Kaymanov_Preload.cfg
C_E10_MQ02_StriderOrbita.cfg
C_E10_MQ03_ScarOrbita.cfg
C_E11_MQ02_StrelokX3_Cutscene.cfg
C_E11_MQ03_Korshunov_PTS.cfg
C_E11_MQ03_Korshunov_PTS_Preloader.cfg
C_E11_MQ03_StrelokPTS_Cutscene.cfg
C_E11_MQ03_StrelokPTS_Preloader.cfg
C_E14_MQ03_01_Foundation_Bossfight_Scene1.cfg
C_E14_MQ03_01_Foundation_Bossfight_Scene2.cfg
C_E14_MQ03_01_Foundation_Bossfight_Scene3.cfg
C_E14_MQ03_01_FoundationA_Part1_Cutscene.cfg
C_E14_MQ03_01_FoundationA_Part2_Cutscene.cfg
C_E14_MQ03_01_FoundationB_Part1_Cutscene.cfg
C_E14_MQ03_01_FoundationB_Part2_Cutscene.cfg
C_E14_MQ03_01_FoundationC_Part1_Cutscene.cfg
C_E14_MQ03_01_FoundationC_Part2_Cutscene.cfg
C_E15_MQ03_MemoryCube_Cutscene.cfg
C_E15_MQ03_MemoryCube_Preload.cfg
C_E15_MQ03_TheHardestChoice_Cutscene.cfg
C_E15_MQ03_TheHardestChoice_Preload.cfg
C_E15_MQ04_CouldNotBeFree_Cutscene.cfg
C_E15_MQ04_CouldNotBeFree_Preload.cfg
C_E16_Flashbacks_Cutscene.cfg
C_E16_MQ03_DogOnALeash_Cutscene.cfg
C_E16_MQ03_Final_Skif_Cutscene.cfg
C_E16_MQ03_Final_Skif_Preload.cfg
C_E16_MQ03_Final_Strelok_Cutscene.cfg
C_E16_MQ03_Final_Strelok_Preload.cfg
C_E16_MQ03_Final_TheSpark_Cutscene.cfg
C_E16_MQ03_Final_TheWard_Cutscene.cfg
C_E16_MQ03_TotalRecall_Cutscene.cfg
CementFactory_L.cfg
CementFactory_SQ_L.cfg
ChemicalPlant_GD.cfg
ClothSimulation.cfg
ClothSimulationContainer.cfg
ClothSimulationContainer_2.cfg
ClothSimulationContainerDespawn.cfg
ClothSimulationContainerSpawn.cfg
ColdIsland_L.cfg
ColdIsland_SQ_L.cfg
ConcretePlant_GD.cfg
ConcretePlant_Hub.cfg
ConcretePlant_Radio.cfg
CoolingTowers_GD.cfg
Cordon_GD.cfg
Cordon_L.cfg
Cordon_SQ_L.cfg
CrookedPeninsula_L.cfg
CrookedPeninsula_L_RedKeepVarta_Camp.cfg
CrookedPeninsula_SQ_L.cfg
Crutch_Illegals_Start.cfg
Crutch_Officials_Start.cfg
DA_Test_E07_SQ01.cfg
DA_Test_E08_MQ03.cfg
DA_Test_E11_MQ03-04.cfg
Datalayertest.cfg
DeadValley_L.cfg
DemoMap_PsyField_Phantoms_QBP.cfg
DemoMap_TestingBlendShapes_Quest.cfg
DemoMap_TestingIK_Quest.cfg
DESPAWN.cfg
DevTestMap.cfg
DKEnergetic_Hub.cfg
Duga_GD.cfg
Duga_Loudspeakers.cfg
E01_MQ01.cfg
E01_MQ01_Audio.cfg
E01_MQ01_C01.cfg
E01_MQ01_C02.cfg
E01_MQ01_C03.cfg
E01_MQ01_C04.cfg
E01_MQ01_C05.cfg
E01_MQ01_ScanerDialogDelay.cfg
E01_MQ01_VFX.cfg
E02_MQ01.cfg
E02_MQ01_Audio.cfg
E02_MQ01_VFX.cfg
E02_MQ02.cfg
E02_MQ02_Audio.cfg
E02_MQ02_C01.cfg
E02_MQ02_C02.cfg
E02_MQ02_C03.cfg
E02_MQ02_C04.cfg
E02_MQ02_C05.cfg
E02_MQ03.cfg
E02_MQ03_Audio.cfg
E02_MQ03_C01.cfg
E02_MQ03_C02.cfg
E02_MQ03_C04.cfg
E02_MQ03_C05.cfg
E02_SQ01.cfg
E02_SQ01_Audio.cfg
E02_SQ01_VFX.cfg
E02_SQ02.cfg
E02_SQ02_Audio.cfg
E02_SQ02_C01.cfg
E02_SQ02_C02.cfg
E02_SQ02_P.cfg
E03_MQ01.cfg
E03_MQ01_Audio.cfg
E03_MQ02.cfg
E03_MQ02_Audio.cfg
E03_MQ02_C1.cfg
E03_MQ02_C2.cfg
E03_MQ02_C3.cfg
E03_MQ02_C4.cfg
E03_MQ02_P.cfg
E03_MQ03.cfg
E03_MQ03_Audio.cfg
E03_MQ03_C1.cfg
E03_MQ04.cfg
E03_MQ04_Audio.cfg
E03_MQ05.cfg
E03_MQ05_Audio.cfg
E03_MQ05_C01.cfg
E03_MQ05_C02.cfg
E03_MQ05_C03.cfg
E03_MQ05_C04.cfg
E03_MQ05_C05.cfg
E03_MQ05_C06.cfg
E03_MQ05_C07.cfg
E03_MQ05_P.cfg
E03_MQ06.cfg
E03_MQ06_Audio.cfg
E03_MQ06_C01.cfg
E03_MQ06_C02.cfg
E03_MQ06_P.cfg
E03_SQ01.cfg
E03_SQ01_C1.cfg
E04_MQ01.cfg
E04_MQ01_Audio.cfg
E04_MQ01_C01.cfg
E04_MQ01_P.cfg
E04_MQ02.cfg
E04_MQ02_Audio.cfg
E04_MQ02_C1.cfg
E04_SQ01.cfg
E04_SQ01_Audio.cfg
E04_SQ02.cfg
E04_SQ02_Audio.cfg
E04_SQ02_C01.cfg
E04_SQ02_P.cfg
E05_EQ01.cfg
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
      writeFileSync(`/home/sdwvit/.config/JetBrains/IntelliJIdea2025.2/scratches/${filePath}.js`, r);
      // console.log(`\n\nExecuting quest node script for ${filePath}`);
      // await eval(r);
    }),
).then(onL1Finish);
