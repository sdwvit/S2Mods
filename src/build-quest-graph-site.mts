import "./ensure-env.mts";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { questCfgToGraphHtml } from "./quest-cfg-to-graph-html.mts";

const defaultQuestCfgPath = "src/build-quest-graph-example.cfg";
const outputDir = path.resolve("site");
const outputFilePath = path.join(outputDir, "index.html");

await mkdir(outputDir, { recursive: true });
const result = await questCfgToGraphHtml(defaultQuestCfgPath, outputFilePath);
console.log(`${result.sourceFilePath} -> ${result.outputFilePath}`);
