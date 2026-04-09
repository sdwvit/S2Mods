import path from "node:path";
import { EVENTS } from "./constants.mts";

const EVENTS_SET = new Set(EVENTS);

export function renderQuestJsGlobalFunctionStub(v: string, i?: string) {
  if (v === "ItemAdd") {
    return [
      "const ItemAdd = (...args) => {",
      "  const [actor, itemSid, count = 1] = args;",
      "  __questAddItem(itemSid, count, actor);",
      "  __questLogStub(`ItemAdd(${__questFmtArgs(args)})`);",
      "  return 'ItemAdd';",
      "};",
    ].join("\n");
  }
  if (v === "ItemRemove") {
    return [
      "const ItemRemove = (...args) => {",
      "  const [actor, itemSid, count = 1] = args;",
      "  __questRemoveItem(itemSid, count, actor);",
      "  __questLogStub(`ItemRemove(${__questFmtArgs(args)})`);",
      "  return 'ItemRemove';",
      "};",
    ].join("\n");
  }
  if (v === "isItemInInventory") {
    return `const isItemInInventory = (itemSid, count = 1) => __questIsItemInInventory(itemSid, count, 'Skif');`;
  }
  if (!i && EVENTS_SET.has(v)) {
    return [
      `function ${v}(questNodeFn, ...args) {`,
      `  __questLog(\`${v}(\${__questFmtArgs([questNodeFn, ...args])})\`);`,
      `  setTimeout(() => { __questDepth = 0; __questLog('\\n// ' + questNodeFn.name + '()'); questNodeFn({ name: '${v}' }, ''); });`,
      "}",
    ].join("\n");
  }
  return i
    ? `const ${v} = ${i}`
    : [
        `const ${v} = (...args) => {`,
        `  __questLogStub(\`${v}(\${__questFmtArgs(args)})\`);`,
        `  return '${v}';`,
        "};",
      ].join("\n");
}

export function resolveQuestNodesToJsInputPath(inputPath: string, cfgRoot: string) {
  const trimmed = inputPath.trim();
  const normalized = trimmed.replaceAll("\\", "/");
  const gameLitePrefix = "Stalker2/Content/GameLite/";
  const gameDataPrefix = "GameData/";

  if (normalized.startsWith("/")) {
    const relativeToGameData = normalized.startsWith("/GameData/") ? normalized.slice("/GameData/".length) : normalized.slice(1);
    const looksLikeGameDataRelative = normalized.startsWith("/GameData/") || normalized.startsWith("/QuestNodePrototypes/");
    if (looksLikeGameDataRelative) {
      const sourceFilePath = path.join(cfgRoot, "GameData", relativeToGameData);
      return { contextFilePath: `/${relativeToGameData}`, sourceFilePath, outputFilePath: `${sourceFilePath}.js` };
    }
  }

  if (path.isAbsolute(trimmed)) {
    const normalizedAbs = trimmed.replaceAll("\\", "/");
    const gameDataMarker = "/GameData/";
    const gameDataIndex = normalizedAbs.indexOf(gameDataMarker);
    const contextFilePath = gameDataIndex >= 0 ? `/${normalizedAbs.slice(gameDataIndex + gameDataMarker.length)}` : normalized;
    return { contextFilePath, sourceFilePath: trimmed, outputFilePath: `${trimmed}.js` };
  }

  if (normalized.startsWith("/")) {
    const relativeToGameData = normalized.startsWith("/GameData/") ? normalized.slice("/GameData/".length) : normalized.slice(1);
    const sourceFilePath = path.join(cfgRoot, "GameData", relativeToGameData);
    return { contextFilePath: `/${relativeToGameData}`, sourceFilePath, outputFilePath: `${sourceFilePath}.js` };
  }

  if (normalized.startsWith(gameLitePrefix)) {
    const relativeToGameLite = normalized.slice(gameLitePrefix.length);
    const sourceFilePath = path.join(cfgRoot, relativeToGameLite);
    const contextFilePath = relativeToGameLite.startsWith(gameDataPrefix)
      ? `/${relativeToGameLite.slice(gameDataPrefix.length)}`
      : `/${relativeToGameLite}`;
    return { contextFilePath, sourceFilePath, outputFilePath: `${sourceFilePath}.js` };
  }

  if (normalized.startsWith(gameDataPrefix)) {
    const sourceFilePath = path.join(cfgRoot, normalized);
    return { contextFilePath: `/${normalized.slice(gameDataPrefix.length)}`, sourceFilePath, outputFilePath: `${sourceFilePath}.js` };
  }

  const contextFilePath = normalized.startsWith("QuestNodePrototypes/") ? `/${normalized}` : `/QuestNodePrototypes/${normalized}`;
  const sourceFilePath = path.join(cfgRoot, "GameData", contextFilePath.slice(1));
  return { contextFilePath, sourceFilePath, outputFilePath: `${sourceFilePath}.js` };
}
