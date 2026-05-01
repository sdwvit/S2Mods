// EWeather UEnum scanner.
//
// Goal: locate the UEnum object EWeather in memory, find its
// `Names` TArray (TArray<TPair<FName, int64>>), and dump every
// entry. Lays the groundwork for extending the enum with new
// values (donor-swap or virtualAlloc-grown buffer).
//
// UE 5.1 layout reminder:
//   UEnum : UField : UObject
//   key field is `TArray<TPair<FName, int64>> Names` somewhere
//   inside the UEnum body. TArray on Win64 = { void* data; i32 num; i32 max }.
//   Each pair = 8B FName (comp:u32, num:u32) + 8B int64 = 16B.
// We don't know the exact `Names` offset for this build, so we
// scan candidate offsets and look for {ptr, num=9, max=9} (9 known
// EWeather options).

import type { ModInit } from "@nodebridge/runtime";
import {
  waitForReflection,
  parseHex,
  readU32LE,
  readU64LE,
} from "@nodebridge/runtime";

const KNOWN_COUNT = 9;
const SCAN_START = 0x28;
const SCAN_END = 0x80;

const init: ModInit = async (bridge) => {
  bridge.log("---------------------------------------");
  bridge.log("EWeather scanner");
  await waitForReflection(bridge);

  // 1. Locate the UEnum object. listObjects matches by name substring.
  const list = await bridge.game.listObjects({ filter: "EWeather", limit: 64 });
  if (!("items" in list)) {
    bridge.log.error("listObjects failed");
    return;
  }
  const enums = list.items.filter((it) => it.className === "Enum");
  bridge.log(`hits: ${list.items.length}, of which Enum: ${enums.length}`);
  for (const it of list.items) {
    bridge.log(`  [${it.index}] ${it.className.padEnd(16)} ${it.name}`);
  }
  if (enums.length === 0) {
    bridge.log.error("no UEnum named 'EWeather' — bail");
    return;
  }

  for (const en of enums) {
    bridge.log(`---- scanning UEnum [${en.index}] ${en.name} ----`);

    // 2. Dump enough bytes to cover the Names TArray slot.
    const dump = await bridge.game.dumpObjectMemory(en.index, 0, SCAN_END + 0x10);
    if (!("hex" in dump)) {
      bridge.log.error(`could not dump UEnum body (target=${en.index})`);
      continue;
    }
    const enumPtr = dump.objPtr;
    const body = parseHex(dump.hex);
    bridge.log(`  UEnum @ 0x${enumPtr.toString(16)}, dumped ${body.length} bytes`);

    // 3. Walk candidate offsets for a TArray<{16B}> of length 9.
    type Cand = { off: number; ptr: number; num: number; max: number };
    const candidates: Cand[] = [];
    for (let off = SCAN_START; off + 16 <= body.length; off += 8) {
      const ptr = readU64LE(body, off);
      const num = readU32LE(body, off + 8);
      const max = readU32LE(body, off + 12);
      const ptrPlausible = ptr > 0x10000000 && ptr < 0x800000000000;
      const sizesPlausible = num === KNOWN_COUNT && max >= num && max <= num + 64;
      if (ptrPlausible && sizesPlausible) {
        candidates.push({ off, ptr, num, max });
      }
    }
    bridge.log(`  TArray candidates (num==${KNOWN_COUNT}): ${candidates.length}`);
    for (const c of candidates) {
      bridge.log(`    @+0x${c.off.toString(16).padStart(2, "0")} -> ptr=0x${c.ptr.toString(16)} num=${c.num} max=${c.max}`);
    }

    // 4. For each candidate, read the entries and try decoding FNames.
    for (const c of candidates) {
      bridge.log(`  -- entries at +0x${c.off.toString(16)} --`);
      const bytesNeeded = c.num * 16;
      const r = await bridge.game.readMemory(c.ptr, bytesNeeded);
      if (!("hex" in r)) {
        bridge.log(`    fault reading 0x${c.ptr.toString(16)}+${bytesNeeded}`);
        continue;
      }
      const entries = parseHex(r.hex);
      let allDecoded = true;
      for (let i = 0; i < c.num; i++) {
        const base = i * 16;
        const comp = readU32LE(entries, base + 0);
        const numF = readU32LE(entries, base + 4);
        // int64 value at base+8; safe-int range — JS number is fine here.
        const valLo = readU32LE(entries, base + 8);
        const valHi = readU32LE(entries, base + 12);
        const value = valHi === 0 ? valLo : valHi * 0x100000000 + valLo;
        const dec = await bridge.game.fnameToString(comp, numF);
        const name = "name" in dec ? dec.name : "<fault>";
        if (!("name" in dec) || !name) allDecoded = false;
        bridge.log(`    [${i}] comp=${comp} num=${numF} value=${value}  "${name}"`);
      }
      if (allDecoded) {
        bridge.log(`  ✓ Names array CONFIRMED at UEnum+0x${c.off.toString(16)}`);
        bridge.log(`    data ptr   = 0x${c.ptr.toString(16)}`);
        bridge.log(`    num/max    = ${c.num}/${c.max}`);
        bridge.log(`    headroom   = ${c.max - c.num} entries (${(c.max - c.num) * 16} bytes)`);
        bridge.log(`    TArray hdr = UEnum+0x${c.off.toString(16)} .. +0x${(c.off + 0x10).toString(16)}`);
      }
    }
  }
  bridge.log("---- end EWeather scanner ----");
};

export default init;
