import { modName } from "./base-paths.mts";
import { logger } from "./logger.mts";

logger.log(`Publishing mod: ${modName}`);

logger.log("Step 1/3: publish-modio");
await import(new URL("./publish-modio.mts", import.meta.url).href);

logger.log("Step 2/3: publish-steam");
await import(new URL("./publish-steam.mts", import.meta.url).href);

logger.log("Step 3/3: zip-for-xbox");
await import(new URL("./zip-for-xbox.mts", import.meta.url).href);

logger.log(`Publish flow complete for mod: ${modName}`);
