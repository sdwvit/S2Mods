import "./ensure-dot-env.mts";
await import(process.env.NODE_TS_TRANSFORMER);
import { parentPort } from "node:worker_threads";
import { readFile, writeFile } from "node:fs/promises";
import { Struct } from "s2cfgtojson";

type WorkerMessage = {
  filePath: string;
  structs?: unknown[];
  error?: { name?: string; message?: string; stack?: string };
};

async function readStructsFromFile(filePath: string): Promise<WorkerMessage> {
  try {
    const raw = await readFile(filePath, "utf8");
    let structs: Struct[];
    try {
      structs = Struct.fromString(raw);
    } catch (error: any) {
      const message = error?.message || "";
      if (!/Unexpected token/i.test(message)) throw error;
      structs = Struct.fromString(raw);
    }
    return {
      filePath,
      structs: structs.map((entry) => entry.toJson(true)),
    };
  } catch (error: any) {
    return {
      filePath,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
    };
  }
}

if (parentPort) {
  parentPort.on("message", async (filePath: string) => {
    const payload = await readStructsFromFile(filePath);
    parentPort?.postMessage(payload);
  });
} else {
  const filePath = process.env.GENERATE_CONFIG_FILE;
  const listPath = process.env.GENERATE_CONFIG_LIST;
  const outputPath = process.env.GENERATE_CONFIG_OUTPUT;
  if (!outputPath) {
    throw new Error("Missing GENERATE_CONFIG_OUTPUT.");
  }
  let files: string[] = [];
  if (listPath) {
    const rawList = await readFile(listPath, "utf8");
    files = JSON.parse(rawList) as string[];
  } else if (filePath) {
    files = [filePath];
  } else {
    throw new Error("Missing GENERATE_CONFIG_FILE or GENERATE_CONFIG_LIST.");
  }
  const results: WorkerMessage[] = [];
  for (const file of files) {
    results.push(await readStructsFromFile(file));
  }
  await writeFile(outputPath, JSON.stringify({ results }), "utf8");
  if (results.some((result) => result.error)) process.exitCode = 1;
}
