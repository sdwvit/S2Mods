/**
 * Writes one `<ChainSID>_Voiceover` `DialogRuntimeData` asset per dialog chain that has approved voice
 * takes: the asset the game looks a chain's voice lines up by name, mapping each phrase key (the
 * phrase SID) to its `AkAudioEvent`. The events are `VO_<speaker>_<SID>`, as `./wwise_import.py` names
 * them, under the mod's `Voiceover/Hubs/VO_WolfArmorFetch/<speaker>/` events folder.
 *
 * Output: `<ChainSID>_Voiceover.uasset` (`/WolfArmorFetch/<ChainSID>_Voiceover`) in raw/ and in the SDK mod's
 * Content/ (through the mod's `sdk` link; the cook only reads the latter). The game looks them up at the Content root
 * of the plugin a chain names in its `DLC` field (`DLC = WolfArmorFetch`), as the SOC workshop mod does; with
 * `DLC = None` it only searches the base game's runtime data.
 * With `--face`, also `<ChainSID>_FaceAnimation` for the NPC lines (Skif has no face): phrase -> the lip-sync anims
 * `voice/create_face_anims.py` saves as /WolfArmorFetch/Animations/<speaker>/<EN|UA>/AS_FAC_<EN|UA>_<speaker>_<SID>
 * (a line with one language only uses that anim for both). Only pass it once those anims are in the SDK mod.
 * usage: node Mods/WolfArmorFetch/voice/runtime-data.mts [chain regex] [--face]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeDialogRuntimeData } from "../../../src/localization/uasset.mts";
import { chainSID, lineSID, walk } from "../dialog.mts";
import { ALL_TOPICS } from "../topics.mts";
import { speakerOf } from "./speakers.mts";

const MOD = "WolfArmorFetch";
const ROOT = path.join(import.meta.dirname, "..");
const TEMPLATE = path.join(ROOT, "../../src/localization/fixtures/dialog-runtime-voiceover.uasset");
const FACE_TEMPLATE = path.join(ROOT, "../../src/localization/fixtures/dialog-runtime-faceanimation.uasset");
const FACE = process.argv.includes("--face");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const OUTS = ["raw/Stalker2/Content", "sdk/Content"].map((d) => path.join(ROOT, d)).filter((d) => existsSync(d)); // the Content root
const only = new RegExp(args[0] ?? "");
const EVENTS = `/${MOD}/_STALKER2/Audio/WwiseAudio/Events/Voiceover/Hubs/VO_${MOD}`;

const manifest: Record<string, { sid: string }> = JSON.parse(readFileSync(path.join(import.meta.dirname, "approved/manifest.json"), "utf8"));
const voiced = new Set(Object.values(manifest).map((m) => m.sid));
/** sid -> the languages it has a take in (folder `<speaker>_<en|uk>`). */
const langs = new Map<string, Set<string>>();
for (const [rel, m] of Object.entries(manifest)) {
  if (!langs.has(m.sid)) langs.set(m.sid, new Set());
  langs.get(m.sid)!.add(rel.split("/")[0].endsWith("_uk") ? "UA" : "EN");
}
const anim = (speaker: string, sid: string, lang: "EN" | "UA") => {
  const l = langs.get(sid)!.has(lang) ? lang : lang === "EN" ? "UA" : "EN";
  const name = `AS_FAC_${l}_${speaker}_${sid}`;
  return `/${MOD}/Animations/${speaker}/${l}/${name}.${name}`;
};

OUTS.forEach((d) => mkdirSync(d, { recursive: true }));
let missing = 0;
for (const topic of ALL_TOPICS.filter((t) => only.test(chainSID(t)))) {
  const entries = walk(topic).labels.flatMap((label) =>
    label.lines.flatMap((line, i) => {
      const key = lineSID(topic, label, i);
      if (!voiced.has(key)) return missing++, [];
      const event = `VO_${speakerOf(topic, line)}_${key}`;
      return [{ key, path: `${EVENTS}/${speakerOf(topic, line)}/${event}.${event}` }];
    }),
  );
  if (!entries.length) continue;
  const name = `${chainSID(topic)}_Voiceover`;
  for (const out of OUTS) writeDialogRuntimeData(TEMPLATE, `/${MOD}/${name}`, entries, path.join(out, `${name}.uasset`));
  console.log(`${name}: ${entries.length} lines`);
  if (!FACE) continue;
  const faces = walk(topic).labels.flatMap((label) =>
    label.lines.flatMap((line, i) => {
      const key = lineSID(topic, label, i);
      const speaker = speakerOf(topic, line);
      return voiced.has(key) && speaker !== "pc"
        ? [{ key, paths: { Ukrainian: anim(speaker, key, "UA"), English: anim(speaker, key, "EN") } }]
        : [];
    }),
  );
  if (!faces.length) continue;
  const faceName = `${chainSID(topic)}_FaceAnimation`;
  for (const out of OUTS) writeDialogRuntimeData(FACE_TEMPLATE, `/${MOD}/${faceName}`, faces, path.join(out, `${faceName}.uasset`));
  console.log(`${faceName}: ${faces.length} lines`);
}
console.log(`${missing} lines have no approved take yet`);
