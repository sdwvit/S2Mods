/**
 * Writes the AkAudioEvent .uasset of every voice event in `wwise/GeneratedSoundBanks` (the banks
 * `wwise_import.py` + a trimmed-project bank generation produced), so no Wwise Browser reconcile is needed.
 * Each one is OGBarRadio's editor-saved event renamed to
 * `/WolfArmorFetch/_STALKER2/Audio/WwiseAudio/Events/Voiceover/Hubs/VO_WolfArmorFetch/<speaker>/<Event>` with the
 * event's GUID and ShortId from its bank json - the package path `voice/runtime-data.mts` points the phrases at.
 * Written to raw/ and to the SDK mod's Content/ (through the mod's `sdk` link): the cook only reads the latter.
 * usage: node Mods/WolfArmorFetch/voice/event-assets.mts [regex]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeWwiseEventAsset } from "../../../src/wwise-event-asset.mts";

const MOD = "WolfArmorFetch";
const ROOT = path.join(import.meta.dirname, "..");
const TEMPLATE = path.join(
  ROOT,
  "../OGBarRadio/raw/Stalker2/Content/_STALKER2/Audio/WwiseAudio/Events/Interactive_Objects/IO_RadioTable/HubsBars/SFX_RadioTable_Rostok100Rads_On.uasset",
);
const BANKS = path.join(ROOT, "wwise/GeneratedSoundBanks/Windows/Event/English(US)");
const REL = `_STALKER2/Audio/WwiseAudio/Events/Voiceover/Hubs/VO_${MOD}`;
const only = new RegExp(process.argv[2] ?? "");

const contents = [path.join(ROOT, "raw/Stalker2/Content"), path.join(ROOT, "sdk/Content")].filter((d) => existsSync(d));
let n = 0;
for (const file of readdirSync(BANKS).filter((f) => f.endsWith(".json") && only.test(f))) {
  const event = JSON.parse(readFileSync(path.join(BANKS, file), "utf8")).SoundBanksInfo.SoundBanks[0].Events[0];
  const speaker = event.Name.split("_")[1];
  for (const content of contents)
    writeWwiseEventAsset(TEMPLATE, path.join(content, REL, speaker, `${event.Name}.uasset`), `/${MOD}/${REL}/${speaker}/${event.Name}`, event.GUID, Number(event.Id));
  n++;
}
console.log(`${n} event assets -> ${contents.join(", ")}`);
