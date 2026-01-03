import { sdkModFolder } from "./base-paths.mjs";
import { createModZip } from "./zip.mts";

await createModZip(sdkModFolder, false);
