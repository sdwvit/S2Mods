import path from "node:path";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { logger } from "./logger.mts";
import { modFolderSteam } from "./base-paths.mts";
import { modClassification, sdkModTargets } from "./mod-meta-paths.mts";

/**
 * Mirror the staged tree into steamworkshop/ so releases ship the shape the game installs:
 * Windows/<variant>/Windows/Stalker2/Mods/<mod>/Content/Paks/Windows, one folder per cook variant.
 *
 * This is where "one repo mod ships as one published mod" is enforced: a split mod has two SDK
 * mods, and BOTH staged trees are merged into this single payload. They differ only in their
 * Stalker2/Mods/<sdkName> subfolder and in their container basenames, so the merge is a plain
 * overlay with no possible collision, and every publisher downstream (steam takes
 * steamworkshop/ as its content folder, mod.io zips it, xbox zips raw/) ships both halves
 * without knowing there are two.
 */
const copyStaged = async () => {
  const targets = await sdkModTargets;
  const destinationPath = path.join(modFolderSteam, "Windows");
  const usable = targets.filter(
    ({ stagedModFolder }) => existsSync(stagedModFolder) && readdirSync(stagedModFolder).length,
  );

  if (!usable.length) {
    console.error(
      `No files found in source path(s): ${targets.map(({ stagedModFolder }) => stagedModFolder).join(", ")}`,
    );
    return;
  }
  // A split mod that is missing one half would silently publish half a mod, which is worse than
  // failing: the .cfg patches and the assets that reference them only work together.
  if (usable.length !== targets.length) {
    throw new Error(
      `Only ${usable.length}/${targets.length} halves of this mod are staged - ` +
        `cook the missing one before publishing: ` +
        targets
          .filter((t) => !usable.includes(t))
          .map(({ kind, name }) => `${kind}=${name}`)
          .join(", "),
    );
  }

  rmSync(destinationPath, { recursive: true, force: true });
  mkdirSync(path.dirname(destinationPath), { recursive: true });
  for (const target of usable) {
    const label = modClassification.isSplit ? ` (${target.kind})` : "";
    logger.log(`Pulling staged mod${label} from ${target.stagedModFolder}...`);
    cpSync(target.stagedModFolder, destinationPath, { recursive: true });
  }
  logger.log(`Staged mod copied to ${destinationPath}`);
};

await copyStaged();
