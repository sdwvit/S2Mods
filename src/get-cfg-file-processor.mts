import { Struct } from "s2cfgtojson";
import type { MetaContext, StructTransformer } from "./meta-type.mts";
import path from "node:path";
import fs from "node:fs";
import { isDlcCfg, modFolderRaw, modName, rawCfgEnclosingFolder, toGameLiteRelativePath } from "./base-paths.mts";
import { promisify } from "node:util";
import { logger } from "./logger.mts";
import { getOrUpdateFromL1Cache } from "./cache/l1-cache.mts";
import { deepMerge } from "./deep-merge.mts";

/**
 * Deeply merged structs will be stored here.
 * Used to generate correct ts types.
 */
const MergedStructs: Record<string, Struct> = {};

const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

export function getCfgFileProcessor<T extends Struct>(transformer: StructTransformer<T>) {
  type OneT = Struct | T | Struct[] | T[] | void | null | void[] | null[];
  logger.log(`Processing: ${transformer.name}`);
  return async function processOneCfgFile(filePath: string, fileIndex: number): Promise<Struct[]> {
    const pathToSave = path.parse(toGameLiteRelativePath(filePath));

    const allStructs = await getOrUpdateFromL1Cache<T>(filePath, transformer);
    const array = isDlcCfg(filePath)
      ? filterDlcStructsForTransformer(allStructs, transformer)
      : allStructs;
    const structsById: Record<string, T> = Object.fromEntries(
      allStructs.map((s) => [s.__internal__.rawName, s as T]),
    );
    const extraStructs: T[] = [];

    const promises: Promise<OneT>[] = [];

    for (let index = 0; index < array.length; index++) {
      const s = array[index];
      const id = s.__internal__.rawName;
      if (!id) continue;
      if (process.env.ALLOW_MERGED_STRUCTS) {
        const key = getKeyForMergedStructs(filePath, pathToSave);

        MergedStructs[key] ||= new Struct();
        deepMerge(MergedStructs[key], s.clone());
      }
      promises.push(
        Promise.resolve(
          transformer(
            s as T,
            {
              index,
              fileIndex,
              array,
              filePath,
              fileName: pathToSave.base,
              structsById,
              extraStructs,
            } as MetaContext<T>,
          ),
        )/*.then((ps) => {
          s.__internal__.refurl = "../" + pathToSave.base;
          return ps;
        }) removing as i don't understand the need, no tranformer mutates the s struct.*/,
      );
    }

    const processedStructs = (await Promise.all(promises))
      .map((pss) => {
        if (pss) {
          return (Array.isArray(pss) ? pss : [pss]).flat().concat(extraStructs).filter(Boolean);
        }
      })
      .flat()
      .filter(Boolean) as Struct[];

    if (processedStructs.length) {
      const cfgEnclosingFolder = path.join(
        modFolderRaw,
        rawCfgEnclosingFolder,
        pathToSave.dir,
        pathToSave.base === "CoreVariables.cfg" ? "" : pathToSave.name,
      );

      if (!(await exists(cfgEnclosingFolder))) await mkdir(cfgEnclosingFolder, { recursive: true });
      const resultingFilename = path.join(
        cfgEnclosingFolder,
        pathToSave.base === "CoreVariables.cfg"
          ? `${pathToSave.name}.cfg_patch_${modName}`
          : `${pathToSave.name}_patch_${modName}.cfg`,
      );
      await writeFile(resultingFilename, processedStructs.map((s) => s.toString()).join("\n\n"));
    }
    return processedStructs;
  };
}

function getKeyForMergedStructs(filePath: string, pathToSave: { name: string }) {
  if (filePath.includes("SpawnActorPrototypes/")) return "SpawnActorPrototypes";
  if (filePath.includes("DialogChainPrototypes/")) return "DialogChainPrototypes";
  if (filePath.includes("DialogPoolPrototypes/")) return "DialogPoolPrototypes";
  if (filePath.includes("DialogPrototypes/")) return "DialogPrototypes";
  if (filePath.includes("JournalQuestPrototypes/")) return "JournalQuestPrototypes";
  if (filePath.includes("QuestNodePrototypes/")) return "QuestNodePrototypes";
  if (filePath.includes("QuestPrototypes/")) return "QuestPrototypes";
  return pathToSave.name;
}

/**
 * A DLC .cfg holds every item type in one file (see getDlcCfgFiles), so keep only the structs
 * that actually derive from one of the transformer's target GameData files. Origin is declared
 * by `refurl`; structs that only carry a `refkey` inherit it from the struct they extend
 * (DLC templates such as TemplateArtifact_DLC1 hold the refurl for their whole family).
 */
function filterDlcStructsForTransformer<T extends Struct>(
  structs: T[],
  transformer: StructTransformer<T>,
): T[] {
  const byRawName = new Map(structs.map((s) => [s.__internal__.rawName, s]));
  const matchesTarget = (refurl: string) => {
    const normalized = "/" + refurl.replace(/^(?:\.\.\/)+/, "");
    return transformer.files.some((suffix) =>
      transformer.contains ? normalized.includes(suffix) : normalized.endsWith(suffix),
    );
  };

  const resolveRefUrl = (struct: T): string | undefined => {
    const seen = new Set<string>();
    let current: T | undefined = struct;
    while (current && !current.__internal__.refurl) {
      const refkey = current.__internal__.refkey as string;
      if (!refkey || seen.has(refkey)) return undefined;
      seen.add(refkey);
      current = byRawName.get(refkey);
    }
    return current?.__internal__.refurl;
  };

  return structs.filter((s) => {
    const refurl = resolveRefUrl(s);
    if (!refurl) return false;
    return matchesTarget(refurl);
  });
}
