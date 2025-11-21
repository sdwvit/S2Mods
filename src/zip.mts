import { readFile, writeFile } from "node:fs/promises";
import { deflate, inflate } from "node:zlib";

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
