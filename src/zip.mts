import { readFile, writeFile } from "node:fs/promises";
import { deflate, inflate } from "node:zlib";
import { modFolder, modFolderSteam, modFolderSteamStruct, modName, stagedFolderStruct } from "./base-paths.mts";
import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";

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

export async function createModZip() {
  const outZipPath = path.join(modFolder, `${modName}.zip`);
  console.log("Creating mod ZIP…");
  const sourceDir = modFolderSteamStruct;

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
      console.log("ZIP ready:", outZipPath);
      resolve(outZipPath);
    });
    archive.on("error", reject);

    archive.pipe(output);

    archive.directory(sourceDir, path.join("Windows", stagedFolderStruct));

    archive.finalize();
  });
}
