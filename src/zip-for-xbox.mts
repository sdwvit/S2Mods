import { sdkModFolder, sdkModsFolder } from "./base-paths.mjs";
import { createModZip } from "./zip.mts";
import { metaPromise } from "./meta-promise.mts";
import path from "node:path";
const { meta } = await metaPromise;

const resolvedSdkModFolder = path.join(sdkModsFolder, meta.sdkModNameOverride) || sdkModFolder;

await createModZip(resolvedSdkModFolder, false);
