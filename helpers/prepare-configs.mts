import { Entries, Struct } from "s2cfgtojson";
import path from "node:path";
import * as fs from "node:fs";
import dotEnv from "dotenv";

type Context<T> = {
  struct: T;
  fileIndex: number;
  index: number;
  array: T[];
  extraStructs: T[];
  filePath: string;
  rawContent: string;
  structsById: Record<string, T>;
};

// scan all local .cfg files
const rootDir = path.join(import.meta.dirname, "..");
dotEnv.config({ path: path.join(rootDir, "helpers", ".env") });
const nestedDir = path.join("Stalker2", "Content", "GameLite");
const BASE_CFG_DIR = path.join(process.env.SDK_PATH, nestedDir);
export type Meta<T extends WithSID = WithSID> = {
  changenote: string;
  description: string;
  entriesTransformer?(entries: T["entries"], context: Context<T>): Entries | null; // prefer getEntriesTransformer
  getEntriesTransformer?(context: { filePath: string }): (entries: T["entries"], context: Context<T>) => Entries | null; // use this to transform entries
  interestingContents?: string[];
  interestingFiles: string[];
  interestingIds?: string[];
  prohibitedIds?: string[];
  onFinish?(): void;
};
const emptyMeta = `
  import { Struct, Entries } from "s2cfgtojson";
  type StructType = Struct<{}>;
  export const meta = {
    interestingFiles: [],
    interestingContents: [],
    prohibitedIds: [],
    interestingIds: [],
    description: "",
    changenote: "",
    getEntriesTransformer: () => (entries: Entries) => entries,
  };
`.trim();

const readOneFile = (file: string) => {
  return fs.readFileSync(file, "utf8");
};

function getCfgFiles() {
  const cfgFiles = [];
  function scanAllDirs(start: string) {
    const files = fs.readdirSync(start);
    for (const file of files) {
      if (fs.lstatSync(path.join(start, file)).isDirectory()) {
        scanAllDirs(path.join(start, file));
      } else if (file.endsWith(".cfg")) {
        cfgFiles.push(path.join(start, file));
      }
    }
  }

  scanAllDirs(BASE_CFG_DIR);
  return cfgFiles;
}

const MOD_NAME = process.env.MOD_NAME;
const modFolder = path.join(rootDir, "Mods", MOD_NAME);
const modFolderRaw = path.join(modFolder, "raw");
const modFolderSteam = path.join(modFolder, "steamworkshop");

if (!fs.existsSync(modFolderSteam)) fs.mkdirSync(modFolderSteam, { recursive: true });

const metaPath = path.join(modFolder, "meta.mts");
if (!fs.existsSync(metaPath)) fs.writeFileSync(metaPath, emptyMeta);

const { meta } = (await import(metaPath)) as { meta: Meta };
const { interestingIds, interestingFiles, interestingContents, prohibitedIds, getEntriesTransformer = () => meta.entriesTransformer } = meta;

getCfgFiles()
  .filter((file) => interestingFiles.some((i) => file.includes(`/${i}`)))
  .map((filePath, fileIndex) => {
    const rawContent = readOneFile(filePath);
    if (interestingContents?.length && !interestingContents.some((i) => rawContent.includes(i))) {
      return;
    }

    const entriesTransformer = getEntriesTransformer({ filePath });
    if (!entriesTransformer) {
      return;
    }

    const pathToSave = path.parse(filePath.slice(BASE_CFG_DIR.length + 1));
    const structsById = Struct.fromString<WithSID>(rawContent).reduce(
      (acc, struct) => {
        if (struct.entries.SID) {
          acc[struct.entries.SID] = struct as WithSID;
        }
        return acc;
      },
      {} as Record<string, WithSID>,
    );
    const extraStructs: WithSID[] = [];
    const structs = Object.values(structsById)
      .filter((s): s is WithSID =>
        s.entries.SID && (interestingIds?.length ? interestingIds.some((id) => s.entries.SID.includes(id)) : true) && prohibitedIds?.length
          ? prohibitedIds.every((id) => !s.entries.SID.includes(id))
          : true,
      )
      .map((s) => Struct.fromString<WithSID>(s.toString())[0])
      .map((struct) => {
        struct.refurl = "../" + pathToSave.base;
        struct._refkey = struct.refkey;
        struct.refkey = idIsArrayIndex(struct._id) ? struct._id : struct.entries.SID;
        struct._id = `${MOD_NAME}${idIsArrayIndex(struct._id) ? "" : `_${struct._id}`}`;
        return struct;
      })
      .map((struct, index, array) => {
        if (entriesTransformer) {
          (struct as Struct).entries = entriesTransformer(struct.entries, {
            struct,
            index,
            fileIndex,
            array,
            filePath,
            rawContent,
            structsById,
            extraStructs,
          });
        }
        if (!struct.entries) {
          return null;
        }
        return struct;
      })
      .concat(extraStructs)
      .filter(Boolean);

    if (structs.length) {
      const cfgEnclosingFolder = path.join(modFolderRaw, nestedDir, pathToSave.dir, pathToSave.name);

      if (!fs.existsSync(cfgEnclosingFolder)) fs.mkdirSync(cfgEnclosingFolder, { recursive: true });
      fs.writeFileSync(path.join(cfgEnclosingFolder, `${MOD_NAME}${pathToSave.base}`), structs.map((s) => s.toString()).join("\n\n"));
    }
    return structs;
  });
meta.onFinish?.();

function idIsArrayIndex(id: string): boolean {
  return id && Struct.isNumber(Struct.extractKeyFromBrackets(id));
}

export type WithSID<T = {}> = Struct<{ SID: string } & T> & { _refkey: Struct["refkey"] };

await import("./packmod.mjs");
await import("./push-to-sdk.mts");
