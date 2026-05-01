import type { ModInit } from "@nodebridge/runtime";
import {
  waitForReflection,
  parseHex,
  readU32LE,
  readU64LE,
} from "@nodebridge/runtime";

// UE appends EnumName_MAX, so actual count = 10 for 9-variant EWeather.
const NUM_MIN = 9;
const NUM_MAX = 20;
const SCAN_START = 0x28;
const SCAN_END = 0xC0;

// patternsleuth offline scan against Stalker2-Win64-Shipping.exe (2026-05-01)
const KNOWN_FNAME_CTOR_RVA = 0xd26be8;
const KNOWN_FNAME_TOSTRING_RVA = 0xb73bc4;

const init: ModInit = async (bridge) => {
  bridge.log("---------------------------------------");
  bridge.log("EWeather scanner");
  await waitForReflection(bridge);

  // Validate FName function addresses against known RVAs.
  const { base } = await bridge.game.mainExeBase();
  const expectedCtor = base + KNOWN_FNAME_CTOR_RVA;
  const expectedToString = base + KNOWN_FNAME_TOSTRING_RVA;
  bridge.log(`imageBase=0x${base.toString(16)}`);

  const aobCtor = await bridge.game.scanAOB(
    "EB 07 48 8D 15 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 41 B8 01 00 00 00 E8"
  );
  if ("hit" in aobCtor && aobCtor.hit) {
    const callInstr = aobCtor.hit + 23;
    const relBytes = await bridge.game.readMemory(callInstr + 1, 4);
    if ("hex" in relBytes) {
      const rel = parseHex(relBytes.hex);
      const disp = (rel[0] | (rel[1] << 8) | (rel[2] << 16) | (rel[3] << 24)) | 0;
      const resolved = callInstr + 5 + disp;
      const match = resolved === expectedCtor;
      bridge.log(`FNameCtor  AOB→0x${resolved.toString(16)}  expected=0x${expectedCtor.toString(16)}  ${match ? "✓ MATCH" : "✗ MISMATCH"}`);
    }
  } else {
    bridge.log.warn(`FNameCtor AOB: no hit — installing via known RVA 0x${expectedCtor.toString(16)}`);
    await bridge.game.installFnameCtorAddr(expectedCtor);
  }

  const fnameTest = await bridge.game.fnameFromString("NodeBridgeAOBTest");
  if ("comp" in fnameTest) {
    bridge.log(`fnameFromString OK  comp=${fnameTest.comp}`);
  } else {
    bridge.log.warn(`fnameFromString: ${"error" in fnameTest ? fnameTest.error : "unresolved"}`);
  }
  bridge.log("---------------------------------------");

  const list = await bridge.game.listObjects({ filter: "Weather", limit: 64 });
  if (!("items" in list)) { bridge.log.error("listObjects failed"); return; }
  const enums = list.items.filter((it) => it.className === "Enum");
  bridge.log(`hits: ${list.items.length}, Enum: ${enums.length}`);

  for (const en of enums) {
    bridge.log(`---- scanning UEnum [${en.index}] ${en.name} ----`);

    const dump = await bridge.game.dumpObjectMemory(en.index, 0, SCAN_END + 0x10);
    if (!("hex" in dump)) { bridge.log.error(`dump failed target=${en.index}`); continue; }
    const body = parseHex(dump.hex);
    bridge.log(`  UEnum @ 0x${dump.objPtr.toString(16)}, ${body.length} bytes`);

    // Print raw hex for manual inspection (16 bytes per row)
    for (let row = 0; row < body.length; row += 16) {
      const slice = body.slice(row, row + 16);
      const hex = Array.from(slice).map(b => b.toString(16).padStart(2,'0')).join(' ');
      bridge.log(`  +0x${row.toString(16).padStart(3,'0')}: ${hex}`);
    }

    type Cand = { off: number; ptr: number; num: number; max: number };
    const candidates: Cand[] = [];
    for (let off = SCAN_START; off + 16 <= body.length; off += 8) {
      const ptr = readU64LE(body, off);
      const num = readU32LE(body, off + 8);
      const max = readU32LE(body, off + 12);
      const ptrOk = ptr > 0x10000000 && ptr < 0x800000000000;
      const sizeOk = num >= NUM_MIN && num <= NUM_MAX && max >= num && max <= num + 128;
      if (ptrOk && sizeOk) candidates.push({ off, ptr, num, max });
    }
    bridge.log(`  TArray candidates (num ${NUM_MIN}-${NUM_MAX}): ${candidates.length}`);
    for (const c of candidates) {
      bridge.log(`    @+0x${c.off.toString(16)} ptr=0x${c.ptr.toString(16)} num=${c.num} max=${c.max}`);
    }

    for (const c of candidates) {
      bridge.log(`  -- entries at +0x${c.off.toString(16)} --`);
      const r = await bridge.game.readMemory(c.ptr, c.num * 16);
      if (!("hex" in r)) { bridge.log(`    fault`); continue; }
      const entries = parseHex(r.hex);
      let ok = true;
      for (let i = 0; i < c.num; i++) {
        const base = i * 16;
        const comp = readU32LE(entries, base);
        const numF = readU32LE(entries, base + 4);
        const valLo = readU32LE(entries, base + 8);
        const valHi = readU32LE(entries, base + 12);
        const value = valHi === 0 ? valLo : valHi * 0x100000000 + valLo;
        const dec = await bridge.game.fnameToString(comp, numF);
        const name = "name" in dec ? dec.name : "<fault>";
        if (!("name" in dec)) ok = false;
        bridge.log(`    [${i}] ${value}  "${name}"  (comp=${comp} num=${numF})`);
      }
      if (ok) {
        bridge.log(`  CONFIRMED Names @ UEnum+0x${c.off.toString(16)}`);
        bridge.log(`    ptr=${c.ptr.toString(16)} num=${c.num} max=${c.max} headroom=${c.max - c.num}`);
      }
    }
  }
  bridge.log("---- end scanner ----");
};

export default init;
