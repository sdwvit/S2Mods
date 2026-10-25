/**
 * Copies a mod's announce blueprint, edited in the Mod Editor, over ANNOUNCE_TEMPLATE, with its game start
 * command swapped back for the placeholder. Every mod's copy is generated from the template on its next
 * prepare-configs / cook-inject.
 * usage: S2_MOD=<Mod> node src/refresh-announce-template.mts
 */
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import "./ensure-env.mts";
import { logger } from "./logger.mts";
import { modMeta, primarySdkModTarget } from "./mod-meta-paths.mts";
import { ANNOUNCE_BLUEPRINT, ANNOUNCE_TEMPLATE, asAnnounceTemplate } from "./announce-installed.mts";

const edited = path.join((await primarySdkModTarget).modFolder, "Content", ANNOUNCE_BLUEPRINT);
writeFileSync(ANNOUNCE_TEMPLATE, asAnnounceTemplate(readFileSync(edited), (await modMeta).gameStartCommand));
logger.log(`${edited} -> ${ANNOUNCE_TEMPLATE}`);
