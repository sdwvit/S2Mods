import { createModZip } from "./zip.mts";
import { sdkModFolder } from "./base-paths.mts";

await createModZip(await sdkModFolder, false);
