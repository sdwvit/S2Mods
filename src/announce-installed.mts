/**
 * Every mod announces itself: a `ModWorldSubsystem` blueprint applies a permanent `<SdkMod>Installed`
 * flag effect to the player on world load, so quest logic in other mods can check for it (see
 * DesignDocs/DetectInstalledModSpec.md).
 *
 * The blueprint derives the SID from its own class path, so every mod ships the same graph: the
 * template (ANNOUNCE_TEMPLATE), renamed into `/<SdkMod>/`, with the mod's `gameStartCommand`. The flag effect
 * goes in its own `EffectPrototypes_patch_<SdkMod>Installed.cfg`, so it never collides with a
 * transformer that patches EffectPrototypes.cfg (one transformer per cfg, one file per transformer).
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { Struct } from "s2cfgtojson";
import type { EDuplicateResolveType, EEffectType, EffectPrototype } from "s2cfgtojson";

import { logger } from "./logger.mts";
import { parseUasset, renameLocalizationPackage, replaceExportStrings } from "./localization/uasset.mts";

/**
 * The blueprint every mod's copy is made from, as saved in the Mod Editor. To change the graph, edit
 * any mod's copy there, then run `S2_MOD=<Mod> node src/refresh-announce-template.mts`.
 */
export const ANNOUNCE_TEMPLATE = path.join(import.meta.dirname, "localization/fixtures/announce-mod-is-active.uasset");
export const ANNOUNCE_BLUEPRINT = "announce_mod_is_active.uasset";

/**
 * Mods that don't announce: repacks of other authors' mods (kept cfg-only, so no blueprint to cook),
 * the runtime bridge, and test mods.
 */
const NOT_ANNOUNCED = new Set([
  "ShaysDistantHorizons250",
  "ShaysDistantHorizons300",
  "ShaysDistantHorizons350",
  "NodeBridge",
  "AmokBodyDamageTest",
  "LairWarTest",
  "SpawnSquads",
]);

export const announcesInstalled = (modName: string) => !NOT_ANNOUNCED.has(modName);

/**
 * HeadlessArmors' `GameFeatureData` (`/HeadlessArmors/HeadlessArmors`) as the Mod Editor created it.
 *
 * A mod that ships assets is mounted from the Steam Workshop as a Game Feature plugin, and that
 * fails without a `GameFeatureData` package named after the plugin
 * (`GameFeaturePlugin.StateMachine.Registering.Plugin_Missing_GameFeatureData`, "errors while
 * installing"). From ~mods the paks are mounted without activating the plugin, so it went unnoticed
 * there. The Mod Editor creates the package for mods made in it; `GSCCreatePlainMod` does not, and
 * the blueprint is what turned those plain mods into asset mods.
 */
export const GAME_FEATURE_TEMPLATE = path.join(import.meta.dirname, "localization/fixtures/game-feature-data.uasset");
const TEMPLATE_CONTENT_BUNDLE_GUID = Buffer.from("bbb9751bffba8c4eaa3220574c7e3abf", "hex");

/**
 * What the Mod Editor writes into a mod's .uplugin and `GSCCreatePlainMod` leaves out. The mod
 * mounting pipeline refuses a plugin without `Mod` ("Mod plugin '%s' is not marked as a mod").
 */
const MOD_PLUGIN_FIELDS = {
  Category: "Game Features",
  EnabledByDefault: true,
  IsBetaVersion: false,
  IsExperimentalVersion: false,
  Installed: false,
  ExplicitlyLoaded: true,
  BuiltInInitialFeatureState: "Registered",
  Mod: true,
};

/**
 * Give the mod a `/<sdkModName>/<sdkModName>` GameFeatureData in every existing dir in
 * `contentDirs` that lacks one. One the Mod Editor made is kept as it is.
 */
export function writeGameFeatureData(contentDirs: string[], sdkModName: string) {
  const name = `${sdkModName}.uasset`;
  const missing = contentDirs.filter((dir) => existsSync(dir) && !existsSync(path.join(dir, name)));
  if (!missing.length) return;
  const tmp = mkdtempSync(path.join(os.tmpdir(), "game-feature-data-"));
  try {
    const built = path.join(tmp, name);
    renameLocalizationPackage(GAME_FEATURE_TEMPLATE, `/${sdkModName}/${sdkModName}`, built, { keepNameOrder: true });
    // ConfigPath and the content bundle's DisplayName spell the template's mod name as plain strings.
    replaceExportStrings(built, parseUasset(GAME_FEATURE_TEMPLATE).summary.packageName.split("/")[1], sdkModName);
    // The content bundle's Guid identifies it among every mod's bundles, so it can't be the template's.
    const bytes = readFileSync(built);
    const guidAt = bytes.indexOf(TEMPLATE_CONTENT_BUNDLE_GUID);
    if (guidAt === -1 || bytes.indexOf(TEMPLATE_CONTENT_BUNDLE_GUID, guidAt + 1) !== -1)
      throw new Error(`${GAME_FEATURE_TEMPLATE}: content bundle Guid not found exactly once`);
    createHash("md5").update(`/${sdkModName}/${sdkModName}`).digest().copy(bytes, guidAt);
    writeFileSync(built, bytes);
    for (const dir of missing) {
      copyFileSync(built, path.join(dir, name));
      logger.info(`${sdkModName}: wrote ${name} to ${dir}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Add the Mod Editor's plugin fields to each existing `.uplugin` in `upluginFiles` that lacks them. */
export function markPluginAsMod(upluginFiles: string[]) {
  for (const file of upluginFiles.filter(existsSync)) {
    const descriptor = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
    if (Object.entries(MOD_PLUGIN_FIELDS).every(([key, value]) => descriptor[key] === value)) continue;
    writeFileSync(file, JSON.stringify({ ...descriptor, ...MOD_PLUGIN_FIELDS }, null, "\t") + "\n");
    logger.info(`marked ${path.basename(file)} as a mod plugin`);
  }
}

/** The flag effect SID the blueprint applies, given the mod's SDK name. */
export const installedEffectSid = (sdkModName: string) => `${sdkModName}Installed`;

/**
 * The Command literal of the template's second Execute Console Command, run after the flag. It is
 * compiled into the blueprint's bytecode, where a length change would move every jump offset behind
 * it, so each mod's copy gets its `gameStartCommand` (meta.mts) padded with spaces to the same length
 * (the console ignores them), or only spaces. Type it into the node exactly as written.
 */
export const GAME_START_COMMAND_PLACEHOLDER = "GAME_START_COMMAND_".padEnd(159, "x");

/** The blueprint bytes with the placeholder swapped for `command` (empty: none), same length. */
export function withGameStartCommand(blueprint: Buffer, command = "") {
  const placeholder = Buffer.from(GAME_START_COMMAND_PLACEHOLDER, "latin1");
  if (command.length > placeholder.length || /[^\x20-\x7e]/.test(command)) {
    throw new Error(`gameStartCommand must be printable ASCII of at most ${placeholder.length} chars: ${command}`);
  }
  const value = Buffer.from(command.padEnd(placeholder.length, " "), "latin1");
  const out = Buffer.from(blueprint);
  let found = 0;
  for (let at = out.indexOf(placeholder); at !== -1; at = out.indexOf(placeholder, at + placeholder.length)) {
    value.copy(out, at);
    found++;
  }
  if (!found && command) throw new Error(`the announce template has no ${GAME_START_COMMAND_PLACEHOLDER} node yet`);
  return out;
}

/**
 * A mod's copy of the blueprint as a template: its command (`gameStartCommand`, or none) swapped back
 * for the placeholder, the reverse of withGameStartCommand.
 */
export function asAnnounceTemplate(blueprint: Buffer, command = "") {
  const value = Buffer.from(command.padEnd(GAME_START_COMMAND_PLACEHOLDER.length, " "), "latin1");
  const placeholder = Buffer.from(GAME_START_COMMAND_PLACEHOLDER, "latin1");
  const out = Buffer.from(blueprint);
  let found = 0;
  for (let at = out.indexOf(value); at !== -1; at = out.indexOf(value, at + value.length)) {
    placeholder.copy(out, at);
    found++;
  }
  if (!found && !out.includes(placeholder)) throw new Error(`no game start command node found (command: "${command}")`);
  return out;
}

/**
 * Write the blueprint, renamed to `/<sdkModName>/announce_mod_is_active` and running
 * `gameStartCommand` (if any) on every world load, into every existing dir in `contentDirs`. Only
 * rewritten when the bytes change, so an unchanged mod keeps its cook fingerprint. `onlyIfMissing`
 * leaves an existing copy alone (the early raw/ write, which runs before the mod's meta.mts is loaded).
 */
export function writeAnnounceBlueprint(
  contentDirs: string[],
  sdkModName: string,
  gameStartCommand?: string,
  { onlyIfMissing = false } = {},
) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "announce-installed-"));
  try {
    const built = path.join(tmp, ANNOUNCE_BLUEPRINT);
    renameLocalizationPackage(ANNOUNCE_TEMPLATE, `/${sdkModName}/announce_mod_is_active`, built, {
      keepNameOrder: true,
    });
    const bytes = withGameStartCommand(readFileSync(built), gameStartCommand);
    for (const dir of contentDirs.filter(existsSync)) {
      const dest = path.join(dir, ANNOUNCE_BLUEPRINT);
      if (existsSync(dest) && (onlyIfMissing || readFileSync(dest).equals(bytes))) continue;
      writeFileSync(dest, bytes);
      logger.info(`${sdkModName}: wrote ${ANNOUNCE_BLUEPRINT} to ${dir}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** The `<sdkModName>Installed` flag effect, as a root struct. Template: vanilla `FaustPsyResist`. */
export function installedEffect(sdkModName: string): EffectPrototype {
  const sid = installedEffectSid(sdkModName);
  const effect = new Struct() as EffectPrototype;
  effect.SID = sid;
  effect.Text = sid;
  effect.Type = "EEffectType::FlagEffect" as EEffectType;
  effect.bIsPermanent = true;
  // The blueprint applies it on every world load; the [0] default KeepAll would stack a copy each time.
  effect.DuplicationType = "EDuplicateResolveType::KeepOld" as EDuplicateResolveType;
  effect.ShowUpgradeEffect = false;
  effect.__internal__.rawName = sid;
  effect.__internal__.refkey = "[0]";
  effect.__internal__.isRoot = true;
  return effect;
}

/** Write the flag effect's cfg under `<modFolderRaw>/Stalker2/Content/GameLite/GameData/EffectPrototypes/`. */
export function writeInstalledEffectCfg(modFolderRaw: string, sdkModName: string) {
  const dir = path.join(modFolderRaw, "Stalker2", "Content", "GameLite", "GameData", "EffectPrototypes");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `EffectPrototypes_patch_${installedEffectSid(sdkModName)}.cfg`),
    installedEffect(sdkModName).toString(),
  );
}
