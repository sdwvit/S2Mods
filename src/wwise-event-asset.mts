import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseUasset, renameLocalizationPackage } from "./localization/uasset.mts";

/**
 * Mint a mod's checked-out AkAudioEvent without the Mod Editor's Wwise Browser -> Checkout.
 *
 * A checkout is the vanilla event re-saved under `/<SdkMod>/...`. The vanilla .uassets in
 * Wwise-WindowsModEditor.pak are an older UE5 file version (1008), so the template is another
 * mod's editor-saved event (1013): rename its package, then swap the `EventInfo` Wwise GUID and
 * ShortId (from the event's bank .json `Events[0].GUID` / `.Id`). `WwiseName` is the same FName
 * as the package's short name, so the rename covers it. The export data references names by
 * index, hence `keepNameOrder`.
 *
 *   node src/wwise-event-asset.mts <template.uasset> <dest.uasset> </SdkMod/.../EventName> <{GUID}> <ShortId>
 */
export function writeWwiseEventAsset(template: string, dest: string, packageName: string, guid: string, shortId: number) {
  const { EventInfo } = parseUasset(template).exports[0].properties as {
    EventInfo: { WwiseGuid: { __rawBytes: string }; WwiseShortId: number };
  };
  mkdirSync(path.dirname(dest), { recursive: true });
  renameLocalizationPackage(template, packageName, dest, { keepNameOrder: true });
  const buf = readFileSync(dest);
  const replaceOnce = (from: Buffer, to: Buffer, what: string) => {
    const at = buf.indexOf(from);
    if (at < 0 || buf.indexOf(from, at + 1) >= 0) throw new Error(`${template}: ${what} not found exactly once`);
    to.copy(buf, at);
  };
  // FGuid is four little-endian uint32s: {AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE} -> A, BC, DE[0..4], E[4..12]
  const hex = guid.replace(/[{}-]/g, "");
  const guidBytes = Buffer.alloc(16);
  for (let i = 0; i < 4; i++) guidBytes.writeUInt32LE(parseInt(hex.slice(i * 8, i * 8 + 8), 16), i * 4);
  const u32 = (n: number) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n);
    return b;
  };
  replaceOnce(Buffer.from(EventInfo.WwiseGuid.__rawBytes, "hex"), guidBytes, "WwiseGuid");
  replaceOnce(u32(EventInfo.WwiseShortId), u32(shortId), "WwiseShortId");
  writeFileSync(dest, buf);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [template, dest, packageName, guid, shortId] = process.argv.slice(2);
  writeWwiseEventAsset(template, dest, packageName, guid, Number(shortId));
  const out = parseUasset(dest);
  console.log(out.summary.packageName, JSON.stringify(out.exports[0].properties));
}
