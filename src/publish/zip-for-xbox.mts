import path from "node:path";
import { createModZip } from "./zip.mts";
import { uploadFileToGoogleDrive } from "../upload-google-drive.mts";
import { modFolderRaw } from "../base-paths.mts";

const zipPath = await createModZip(path.join(modFolderRaw, "Stalker2"), false);
await uploadFileToGoogleDrive(zipPath);
