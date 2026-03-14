import { allValidMods } from "./mod-context.mts";
import { nodeSync } from "./cmd.mts";

nodeSync("./gitbranches/pull-git-branches.mts");

allValidMods.forEach((mod) => {
  nodeSync("./prepare-configs.mts", { S2_MOD: mod });
});
