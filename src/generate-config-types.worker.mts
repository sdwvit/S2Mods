import "./ensure-dot-env.mts";
await import(process.env.NODE_TS_TRANSFORMER);
import { parentPort, workerData } from "node:worker_threads";
import { readFile, writeFile } from "node:fs/promises";
import { Struct } from "s2cfgtojson";

type WorkerResultMessage = {
  filePath: string;
  structs?: unknown[];
  error?: { name?: string; message?: string; stack?: string };
};

type WorkerStatusMessage = {
  type: "status";
  status: "working";
  filePath?: string;
  filesProcessed: number;
  timestamp: number;
};

type WorkerHeartbeatMessage = {
  type: "heartbeat";
  jobId: string;
  filePath?: string;
  filesProcessed: number;
  timestamp: number;
};

type GenerateConfigWorkerData = {
  jobId?: string;
  files?: string[];
  heartbeatIntervalMs?: number;
};

async function readStructsFromFile(filePath: string): Promise<WorkerResultMessage> {
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

const threadData = workerData as GenerateConfigWorkerData | undefined;
const DEFAULT_HEARTBEAT_INTERVAL_MS = Number(process.env.GENERATE_CONFIG_HEARTBEAT_INTERVAL ?? "3000");

async function runThreaded(jobId: string, files: string[], heartbeatIntervalMs: number) {
  let processedFiles = 0;
  let currentFile: string | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  const emitHeartbeat = () => {
    const payload: WorkerHeartbeatMessage = {
      type: "heartbeat",
      jobId,
      filePath: currentFile,
      filesProcessed: processedFiles,
      timestamp: Date.now(),
    };
    parentPort?.postMessage(payload);
  };

  const startHeartbeats = () => {
    emitHeartbeat();
    if (heartbeatIntervalMs > 0) {
      heartbeatTimer = setInterval(emitHeartbeat, heartbeatIntervalMs);
    }
  };

  const stopHeartbeats = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
  };

  startHeartbeats();
  try {
    for (const file of files) {
      currentFile = file;
      const payload = await readStructsFromFile(file);
      parentPort?.postMessage({ type: "result", payload });
      processedFiles += 1;
      currentFile = undefined;
    }
  } finally {
    stopHeartbeats();
    emitHeartbeat();
  }
}

if (parentPort) {
  const files = threadData?.files;
  if (files && files.length) {
    const jobId = threadData?.jobId ?? process.env.GENERATE_CONFIG_JOB_ID ?? String(process.pid);
    const heartbeatIntervalMs = threadData?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    await runThreaded(jobId, files, heartbeatIntervalMs);
  } else {
    let statusTimer: ReturnType<typeof setInterval> | undefined;
    let processedFiles = 0;

    const reportStatus = (filePath?: string) => {
      const payload: WorkerStatusMessage = {
        type: "status",
        status: "working",
        filePath,
        filesProcessed: processedFiles,
        timestamp: Date.now(),
      };
      parentPort?.postMessage(payload);
    };

    const stopStatusReporting = () => {
      if (statusTimer) {
        clearInterval(statusTimer);
        statusTimer = undefined;
      }
    };

    const startStatusReporting = (filePath: string) => {
      stopStatusReporting();
      reportStatus(filePath);
      statusTimer = setInterval(() => reportStatus(filePath), 3000);
    };

    parentPort.on("message", async (filePath: string) => {
      startStatusReporting(filePath);
      try {
        const payload = await readStructsFromFile(filePath);
        processedFiles += 1;
        parentPort?.postMessage(payload);
      } finally {
        stopStatusReporting();
      }
    });
  }
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

  const results: WorkerResultMessage[] = [];
  for (const file of files) {
    results.push(await readStructsFromFile(file));
  }
  await writeFile(outputPath, JSON.stringify({ results }), "utf8");
  if (results.some((result) => result.error)) process.exitCode = 1;
}
