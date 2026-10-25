/**
 * Puts the announce blueprint and its flag effect cfg into raw/ before anything classifies raw/:
 * `modClassification` in mod-meta-paths.mts is computed once at import, and a mod only becomes a
 * split mod (assets in `<Mod>`, cfgs in `<Mod>Cfg`) if both its blueprint and a cfg are already
 * there. Import this before mod-meta-paths.mts; it must not import it itself.
 *
 * Uses the repo mod name: only the excluded repacks carry `sdkModNameOverride`. pullAssets()
 * writes the SDK copy under the real SDK name afterwards.
 */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { modFolderRaw, modName } from "./base-paths.mts";
import {
  announcesInstalled,
  markPluginAsMod,
  writeAnnounceBlueprint,
  writeGameFeatureData,
  writeInstalledEffectCfg,
} from "./announce-installed.mts";

if (announcesInstalled(modName)) {
  const content = path.join(modFolderRaw, "Stalker2", "Content");
  mkdirSync(content, { recursive: true });
  // Only a first copy: meta.mts (and its gameStartCommand) isn't loaded yet; pullAssets() settles it.
  writeAnnounceBlueprint([content], modName, undefined, { onlyIfMissing: true });
  writeGameFeatureData([content], modName);
  // The flag effect is a cfg, so it is what makes a mod with no cfgs of its own (CP77MenuMusic) a
  // split mod. prepare-configs writes it again at the end; writing it here as well means the
  // classification already sees it, and push-to-sdk creates the `<Mod>Cfg` half on the first run.
  writeInstalledEffectCfg(modFolderRaw, modName);
  markPluginAsMod([path.join(modFolderRaw, "Stalker2", `${modName}.uplugin`)]);
}
