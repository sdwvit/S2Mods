import { readFile, writeFile } from "node:fs/promises";
import { deflate, inflate } from "node:zlib";
import { modFolderSteamStruct, modName, projectRoot, stagedFolderStruct } from "./base-paths.mts";
import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.mts";

const resolver = (resolve, reject) => (err, result) => (err ? reject(err) : resolve(result));

export async function readWithUnzip(filePath: string): Promise<string> {
  const contents = await readFile(filePath);
  const unzipped = await new Promise<Buffer<ArrayBufferLike>>((resolve, reject) => inflate(contents, resolver(resolve, reject)));

  return unzipped.toString();
}

export async function writeWithZip(filePath: string, data: string): Promise<void> {
  const zipped = await new Promise<Buffer<ArrayBufferLike>>((resolve, reject) => deflate(data, resolver(resolve, reject)));
  await writeFile(filePath, zipped);
}

export async function createModZip(sourceDir?: string, dest?: string | false) {
  if (!sourceDir) {
    sourceDir = await modFolderSteamStruct;
  }
  if (dest === undefined) {
    dest = path.join("Windows", await stagedFolderStruct);
  }
  const outZipPath = path.join(projectRoot, `${modName}.zip`);
  logger.log(`Creating mod ZIP ${modName}…`);

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source folder does not exist: ${sourceDir}`);
  }

  await fs.promises.mkdir(path.dirname(outZipPath), { recursive: true });

  const output = fs.createWriteStream(outZipPath);
  const archive = archiver.create("zip", {
    zlib: { level: 9 }, // maximum compression
  });

  return new Promise<string>((resolve, reject) => {
    output.on("close", () => {
      logger.log("ZIP ready:", outZipPath);
      resolve(outZipPath);
    });
    archive.on("error", reject);

    archive.pipe(output);

    archive.directory(sourceDir, dest);

    archive.finalize();
  });
}
