/**
 * Overrides the vanilla `PAK_Quest_BaseGame` QuestAssetLabel with a copy that also lists the mod's
 * `<ChainSID>_Voiceover` / `_FaceAnimation` runtime data (`voice/runtime-data.mts`): base-game chains (`DLC = None`)
 * find their voice through that label's `DialogRuntimeDatas`, and a mod's own label is never consulted.
 * The template is extracted from the SDK's WorldMap pak; the copy goes to raw/ and the SDK mod's Content/ at the
 * vanilla path, so the package classifier cooks it as override content.
 * usage: node Mods/WolfArmorFetch/voice/label-override.mts
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { appendQuestLabelRuntimeData } from "../../../src/localization/uasset.mts";

const MOD = "WolfArmorFetch";
const ROOT = path.join(import.meta.dirname, "..");
const LABEL = "Stalker2/Content/_Stalker_2/maps/_Stalker2_WorldMap/QuestObjects/PAK_Quest_BaseGame.uasset";
const PAK = path.join(process.env.SDK_PATH!, "Stalker2/Content/Paks/WorldMap-WindowsModEditor.pak");
const contents = [path.join(ROOT, "raw/Stalker2/Content"), path.join(ROOT, "sdk/Content")].filter((d) => existsSync(d));

const sdkContent = path.join(ROOT, "sdk/Content");
const paths = readdirSync(sdkContent)
  .filter((f) => /^WolfArmorFetch_.*_(Voiceover|FaceAnimation)\.uasset$/.test(f))
  .map((f) => f.slice(0, -".uasset".length))
  .sort()
  .map((name) => `/${MOD}/${name}.${name}`);

const work = mkdtempSync(path.join(tmpdir(), "label-"));
try {
  execFileSync(process.env.REPAK_PATH || "repak", ["unpack", "-o", work, "-i", LABEL, PAK], { stdio: "ignore" });
  const template = path.join(work, LABEL);
  for (const content of contents) {
    const dest = path.join(content, LABEL.replace(/^Stalker2\/Content\//, ""));
    mkdirSync(path.dirname(dest), { recursive: true });
    appendQuestLabelRuntimeData(template, paths, dest);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`PAK_Quest_BaseGame + ${paths.length} runtime data -> ${contents.join(", ")}`);
