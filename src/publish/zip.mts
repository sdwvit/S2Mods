import { readFile, writeFile } from "node:fs/promises";
import { deflate, inflate } from "node:zlib";
import { modFolderSteam, modName, projectRoot } from "../base-paths.mts";

import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../logger.mts";

const resolver = (resolve, reject) => (err, result) => (err ? reject(err) : resolve(result));

export async function readWithUnzip(filePath: string): Promise<string> {
  const contents = await readFile(filePath);
  const unzipped = await new Promise<Buffer<ArrayBufferLike>>((resolve, reject) =>
    inflate(contents, resolver(resolve, reject)),
  );

  return unzipped.toString();
}

export async function writeWithZip(filePath: string, data: string): Promise<void> {
  const zipped = await new Promise<Buffer<ArrayBufferLike>>((resolve, reject) =>
    deflate(data, resolver(resolve, reject)),
  );
  await writeFile(filePath, zipped);
}

/** One folder to add to a zip: `glob` limits it to matching paths, `prefix` is its folder in the zip. */
export type ZipSource = { dir: string; glob?: string; prefix?: string };

export async function createModZip(sourceDir?: string | ZipSource[], dest?: string | false, zipName?: string) {
  if (!sourceDir) {
    // steamworkshop/ already mirrors the installed shape (Windows/<variant>/...), so it is zipped as is.
    sourceDir = modFolderSteam;
  }
  if (dest === undefined) {
    dest = false;
  }
  const outZipPath = path.join(projectRoot, `${zipName ?? modName}.zip`);
  logger.log(`Creating mod ZIP ${modName}…`);

  const sources: ZipSource[] = typeof sourceDir === "string" ? [{ dir: sourceDir, prefix: dest || undefined }] : sourceDir;
  for (const { dir } of sources) {
    if (!fs.existsSync(dir)) {
      throw new Error(`Source folder does not exist: ${dir}`);
    }
  }

  await fs.promises.mkdir(path.dirname(outZipPath), { recursive: true });

  const output = fs.createWriteStream(outZipPath);
  const archive = archiver.create("zip", {
    zlib: { level: 9 }, // maximum compression
  });

  return new Promise<string>((resolve, reject) => {
    output.on("close", () => {
      if (!fs.existsSync(outZipPath)) {
        reject(new Error(`ZIP file was not created: ${outZipPath}`));
        return;
      }
      logger.log("ZIP ready:", outZipPath);
      resolve(outZipPath);
    });
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    for (const { dir, glob, prefix } of sources) {
      if (glob) archive.glob(glob, { cwd: dir }, prefix ? { prefix } : {});
      else archive.directory(dir, prefix || false);
    }

    archive.finalize();
  });
}
