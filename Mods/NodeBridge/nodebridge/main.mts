// Extends EWeather UEnum in-memory with 10 new weather variants.
// See src/nodebridge/offsets.md for layout details and verified addresses.

import type { ModInit } from "@nodebridge/runtime";
import { waitForReflection, parseHex, readU32LE, readU64LE } from "@nodebridge/runtime";

const FNAME_CTOR_RVA = 0xd26be8; // patternsleuth offline scan 2026-05-01

// New weather variants to append (values 10–19, then Count/MAX at 20).
const NEW_WEATHERS = [
  "EWeather::HeavyRain",
  "EWeather::Blizzard",
  "EWeather::Sandstorm",
  "EWeather::Hail",
  "EWeather::Overcast",
  "EWeather::Mist",
  "EWeather::Drizzle",
  "EWeather::Windy",
  "EWeather::Freezing",
  "EWeather::Toxic",
];

function toLE32(n: number): string {
  return [(n >>> 0) & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
    .map(b => b.toString(16).padStart(2, "0")).join(" ");
}

function toLE64(n: number): string {
  // Safe for values ≤ 2^53; all enum int64 values are small.
  const lo = n >>> 0;
  const hi = Math.floor(n / 0x100000000) >>> 0;
  return toLE32(lo) + " " + toLE32(hi);
}

const init: ModInit = async (bridge) => {
  bridge.log("EWeather extend: start");
  await waitForReflection(bridge);

  // 1. Install FName ctor (AOB misses this build, use known RVA).
  const { base } = await bridge.game.mainExeBase();
  await bridge.game.installFnameCtorAddr(base + FNAME_CTOR_RVA);

  // 2. Locate EWeather UEnum.
  // EWeather may not be registered yet at early load — retry for up to 30s.
  let en: { index: number; name: string; className: string } | undefined;
  for (let attempt = 0; attempt < 30 && !en; attempt++) {
    const list = await bridge.game.listObjects({ filter: "Weather", limit: 64 });
    if ("items" in list) en = list.items.find(it => it.className === "Enum" && it.name === "EWeather");
    if (!en) await new Promise(r => setTimeout(r, 1000));
  }
  if (!en) { bridge.log.error("EWeather UEnum not found after 30s"); return; }
  bridge.log(`EWeather index=${en.index}`);

  // 3. Read TArray header at UEnum+0x40.
  const hdrDump = await bridge.game.dumpObjectMemory(en.index, 0x40, 16);
  if (!("hex" in hdrDump)) { bridge.log.error("dump failed"); return; }
  const hdr = parseHex(hdrDump.hex);
  const oldPtr = readU64LE(hdr, 0);
  const oldNum = readU32LE(hdr, 8);
  const enumBase = hdrDump.objPtr;
  bridge.log(`Names TArray: ptr=0x${oldPtr.toString(16)} num=${oldNum} enumBase=0x${enumBase.toString(16)}`);

  // 4. Read existing entries (keep real ones 0–9, drop old Count/MAX).
  const KEEP = 10;
  const existingBytes = await bridge.game.readMemory(oldPtr, KEEP * 16);
  if (!("hex" in existingBytes)) { bridge.log.error("read existing entries failed"); return; }

  // 5. Register new FNames and build new entries buffer.
  const totalEntries = KEEP + NEW_WEATHERS.length + 2; // +2 for Count and MAX
  const alloc = await bridge.game.virtualAlloc(totalEntries * 16);
  if (!("addr" in alloc)) { bridge.log.error("virtualAlloc failed"); return; }
  bridge.log(`new buffer @ 0x${alloc.addr.toString(16)}`);

  // Write existing 10 entries.
  await bridge.game.writeMemory(alloc.addr, existingBytes.hex);

  // Append new 10 entries.
  let writeAddr = alloc.addr + KEEP * 16;
  for (let i = 0; i < NEW_WEATHERS.length; i++) {
    const fn = await bridge.game.fnameFromString(NEW_WEATHERS[i]);
    if (!("comp" in fn)) { bridge.log.error(`fnameFromString failed: ${NEW_WEATHERS[i]}`); return; }
    const value = KEEP + i;
    const entryHex = `${toLE32(fn.comp)} ${toLE32(fn.num)} ${toLE64(value)}`;
    await bridge.game.writeMemory(writeAddr, entryHex);
    bridge.log(`  [${value}] "${NEW_WEATHERS[i]}" comp=${fn.comp}`);
    writeAddr += 16;
  }

  // Append new Count (value=20) and EWeather_MAX (value=20).
  const newTotal = KEEP + NEW_WEATHERS.length;
  for (const label of ["EWeather::Count", "EWeather::EWeather_MAX"]) {
    const fn = await bridge.game.fnameFromString(label);
    if (!("comp" in fn)) { bridge.log.error(`fnameFromString failed: ${label}`); return; }
    const entryHex = `${toLE32(fn.comp)} ${toLE32(fn.num)} ${toLE64(newTotal)}`;
    await bridge.game.writeMemory(writeAddr, entryHex);
    writeAddr += 16;
  }

  // 6. Patch TArray header: new ptr (8B) + num (4B) + max (4B).
  const ptrLo = alloc.addr >>> 0;
  const ptrHi = Math.floor(alloc.addr / 0x100000000) >>> 0;
  const patchHex = `${toLE32(ptrLo)} ${toLE32(ptrHi)} ${toLE32(totalEntries)} ${toLE32(totalEntries)}`;
  await bridge.game.writeMemory(enumBase + 0x40, patchHex);
  bridge.log(`patched TArray header → ptr=0x${alloc.addr.toString(16)} num=${totalEntries}`);

  // 7. Verify by reading back all entries in one shot.
  const allBytes = await bridge.game.readMemory(alloc.addr, totalEntries * 16);
  if ("hex" in allBytes) {
    const buf = parseHex(allBytes.hex);
    const names: string[] = [];
    for (let i = 0; i < totalEntries; i++) {
      names.push(readU32LE(buf, i * 16).toString());
    }
    bridge.log(`verified ${totalEntries} entries, first comp=${names[0]}, last comp=${names[totalEntries - 1]}`);
  }
  bridge.log("EWeather extend: done");
};

export default init;
