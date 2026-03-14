import { createModZip } from "./zip.mts";
import { sdkModFolder } from "../mod-meta-paths.mts";
import { uploadFileToGoogleDrive } from "../upload-google-drive.mts";

const zipPath = await createModZip(await sdkModFolder, false);
await uploadFileToGoogleDrive(zipPath);
