import { modName } from "./base-paths.mts";
import { logger } from "./logger.mts";
import { nodeSync } from "./cmd.mts";

logger.log(`Publishing mod: ${modName}`);

logger.log("Step 1/3: publish-modio");
nodeSync("./publish-modio.mts");

logger.log("Step 2/3: publish-steam");
nodeSync("./publish-steam.mts");

logger.log("Step 3/3: zip-for-xbox");
nodeSync("./zip-for-xbox.mts");

logger.log(`Publish flow complete for mod: ${modName}`);
