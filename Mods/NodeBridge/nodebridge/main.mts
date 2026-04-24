// Smoke-test mod for NodeBridge.
//
// Tries to find the player pawn and teleport it. If no pawn is present
// (e.g. in the main menu), falls back to a diagnostic dump so we can see
// what classes exist in the current game state and confirm FName
// resolution is producing real strings.

import type { ModInit, Vector3 } from "../../../src/nodebridge/runtime/bridge.d.ts";

const TARGET: Vector3 = { x: 404533, y: 550669, z: 579 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// --- JS-side property walker (Phase B of NodeBridge plan) ---------------
// We build the UStruct/FProperty walker here in TS instead of patching
// uproperty.h every time we discover the GSC fork has shifted an offset.
// Uses only memory primitives + fnameToString from bridge.game.

type Bridge = Awaited<Parameters<ModInit>[0]>;

// Verified GSC UE 5.1 layout (Stalker 2). Confirmed via the JS probe in
// session 2026-04-24 23:15. FField/FProperty are stock UE 5.1; only
// UStruct has a +0x10 shift on its members.
const GSC = {
  uStructPropertyLink: 0x70,    // stock +0x60
  uStructPropertiesSize: 0x58,  // stock +0x48
  uStructSuperStruct: 0x40,     // stock +0x30 (assumed +0x10 same shift)
  fFieldNamePrivate: 0x28,      // stock
  fPropertyNextLink: 0x58,      // stock
  fPropertyOffsetInternal: 0x4c,// stock
  uObjectClassPtr: 0x10,        // stock UObjectBase
} as const;

function parseHex(hex: string): Uint8Array {
  const parts = hex.trim().split(/\s+/).filter(Boolean);
  const out = new Uint8Array(parts.length);
  for (let i = 0; i < parts.length; i++) out[i] = parseInt(parts[i], 16);
  return out;
}

function readU32LE(b: Uint8Array, off: number): number {
  return (b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24)) >>> 0;
}

// Stalker 2 64-bit pointers fit comfortably under 2^53, so plain numbers
// are fine here — bigint would force await/JSON gymnastics for no benefit.
function readU64LE(b: Uint8Array, off: number): number {
  let hi = readU32LE(b, off + 4);
  let lo = readU32LE(b, off);
  return hi * 0x100000000 + lo;
}

async function readU64At(bridge: Bridge, addr: number): Promise<number | null> {
  const r = await bridge.game.readMemory(addr, 8);
  if (!("hex" in r)) return null;
  return readU64LE(parseHex(r.hex), 0);
}

async function decodeFName(bridge: Bridge, comp: number, num: number): Promise<string> {
  if (comp === 0 && num === 0) return "None";
  const r = await bridge.game.fnameToString(comp, num);
  if ("name" in r) return r.name;
  return "";
}

// Heuristic chain walk. Given a head pointer plus the FField/FProperty
// `name` and `next` offsets, walk the property_link_next chain and
// decode the FName at each node. Bounded to avoid runaway loops on
// garbage. We cache each entry's raw bytes so a follow-up pass can
// disambiguate offset_internal without re-reading memory.
async function walkPropertyChain(
  bridge: Bridge,
  head: number,
  nameOff: number,
  nextOff: number,
  max = 256,
): Promise<{ name: string; ptr: number; bytes: Uint8Array }[]> {
  const out: { name: string; ptr: number; bytes: Uint8Array }[] = [];
  let cur = head;
  const seen = new Set<number>();
  while (cur && !seen.has(cur) && out.length < max) {
    seen.add(cur);
    const r = await bridge.game.readMemory(cur, 0x80);
    if (!("hex" in r)) break;
    const bytes = parseHex(r.hex);
    if (bytes.length < Math.max(nameOff + 8, nextOff + 8)) break;
    const comp = readU32LE(bytes, nameOff);
    const num = readU32LE(bytes, nameOff + 4);
    // Sanity: comparison_index for valid FNames is never absurdly huge in
    // practice (FNamePool entries fit in ~24 bits). Bail early on trash.
    if (comp > 0x10_000_000 || num > 0x10_000_000) break;
    const name = await decodeFName(bridge, comp, num);
    out.push({ name, ptr: cur, bytes });

    cur = readU64LE(bytes, nextOff);
  }
  return out;
}

// Once the chain is decoded, scan each entry's cached bytes for the
// offset_internal field. Stock UE 5.1 has it at +0x4C; the GSC build
// shifts FProperty members by +0x08, so +0x54 is most likely. Pick by
// "how many values fall inside [0, classSize]" — a real offset_internal
// is the byte offset of the property within an instance, so it must
// be < the class's PropertiesSize.
function probeOffsetInternal(
  entries: { bytes: Uint8Array }[],
  classSize: number,
): { off: number; valid: number; total: number; samples: number[] } {
  const candidates = [0x44, 0x4C, 0x50, 0x54, 0x58, 0x5C, 0x60];
  let best = { off: candidates[0], valid: -1, total: entries.length, samples: [] as number[] };
  for (const off of candidates) {
    let valid = 0;
    const samples: number[] = [];
    for (const e of entries) {
      if (e.bytes.length < off + 4) continue;
      const v = readU32LE(e.bytes, off) | 0;
      if (v >= 0 && v < classSize) valid++;
      if (samples.length < 8) samples.push(v);
    }
    if (valid > best.valid) best = { off, valid, total: entries.length, samples };
  }
  return best;
}

const EXPECTED_PAWN_PROPS = new Set([
  // AActor
  "RootComponent", "OwnedComponents", "ReplicatedMovement",
  "InstanceComponents", "Tags", "ActorHasBegunPlay", "bReplicates",
  "bHidden", "bCanBeDamaged", "InitialLifeSpan", "CustomTimeDilation",
  // APawn
  "Controller", "PlayerState", "BaseEyeHeight", "AutoPossessAI",
  "AutoPossessPlayer",
  // ACharacter
  "Mesh", "CharacterMovement", "CapsuleComponent", "JumpKeyHoldTime",
  "JumpMaxCount", "JumpMaxHoldTime", "BaseRotationOffset",
]);

// Find a property by name on a UClass using the verified GSC offsets.
// Returns the property's offset_internal (byte offset within an instance)
// or null if not found. Walks PropertyLink, which already includes
// inherited properties — no need to walk SuperStruct manually.
async function findPropertyOffset(
  bridge: Bridge,
  classPtr: number,
  propName: string,
  max = 512,
): Promise<number | null> {
  const head = await readU64At(bridge, classPtr + GSC.uStructPropertyLink);
  if (!head) return null;
  let cur = head;
  const seen = new Set<number>();
  while (cur && !seen.has(cur) && seen.size < max) {
    seen.add(cur);
    const r = await bridge.game.readMemory(cur, 0x80);
    if (!("hex" in r)) return null;
    const bytes = parseHex(r.hex);
    if (bytes.length < 0x60) return null;
    const comp = readU32LE(bytes, GSC.fFieldNamePrivate);
    const num = readU32LE(bytes, GSC.fFieldNamePrivate + 4);
    if (comp > 0x10_000_000 || num > 0x10_000_000) return null;
    const name = await decodeFName(bridge, comp, num);
    if (name === propName) return readU32LE(bytes, GSC.fPropertyOffsetInternal) | 0;
    cur = readU64LE(bytes, GSC.fPropertyNextLink);
  }
  return null;
}

// Read 24 bytes (3×double) at addr → FVector3d.
async function readVector3dAt(bridge: Bridge, addr: number): Promise<Vector3 | null> {
  const r = await bridge.game.readMemory(addr, 24);
  if (!("hex" in r)) return null;
  const bytes = parseHex(r.hex);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, 24);
  return { x: dv.getFloat64(0, true), y: dv.getFloat64(8, true), z: dv.getFloat64(16, true) };
}

// Write 24 bytes (3×double) at addr from a Vector3.
async function writeVector3dAt(bridge: Bridge, addr: number, v: Vector3): Promise<boolean> {
  const buf = new ArrayBuffer(24);
  const dv = new DataView(buf);
  dv.setFloat64(0, v.x, true);
  dv.setFloat64(8, v.y, true);
  dv.setFloat64(16, v.z, true);
  let hex = "";
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i++) hex += u8[i].toString(16).padStart(2, "0");
  const r = await bridge.game.writeMemory(addr, hex);
  return "count" in r;
}

// Locate the Translation slot within an FTransform by matching a hint
// vector against the 96-byte transform memory. UE5 LWC FTransform is
// canonically alignas(16) with TQuat<double> (32B) + TVector<double>
// (24B) + TVector<double> (24B), so Translation lives at +0x20 — but
// rather than assume, we scan and verify against the live world
// position. Returns the byte offset within the FTransform, or null
// if no run of 3 consecutive doubles matches the hint.
function locateTranslationOffset(ctwBytes: Uint8Array, hint: Vector3, tol = 1.0): number | null {
  const dv = new DataView(ctwBytes.buffer, ctwBytes.byteOffset, ctwBytes.byteLength);
  for (let off = 0; off + 24 <= ctwBytes.length; off += 8) {
    const x = dv.getFloat64(off, true);
    const y = dv.getFloat64(off + 8, true);
    const z = dv.getFloat64(off + 16, true);
    if (Math.abs(x - hint.x) < tol && Math.abs(y - hint.y) < tol && Math.abs(z - hint.z) < tol) {
      return off;
    }
  }
  return null;
}

// --- Property accessor API ----------------------------------------------
// Grouped helpers for reading/writing UProperty fields by name. Designed
// to be copy-pasted into other NodeBridge mods. Every method takes a
// (bridge, uobjPtr, classPtr, propName) tuple — find the offset once,
// remember it, then use the typed reader/writer.

const S2 = {
  // Read N bytes at uobjPtr + propOff and return as little-endian primitives.
  async readU32(bridge: Bridge, uobjPtr: number, propOff: number): Promise<number | null> {
    const r = await bridge.game.readMemory(uobjPtr + propOff, 4);
    return "hex" in r ? readU32LE(parseHex(r.hex), 0) : null;
  },
  async readI32(bridge: Bridge, uobjPtr: number, propOff: number): Promise<number | null> {
    const r = await bridge.game.readMemory(uobjPtr + propOff, 4);
    return "hex" in r ? (readU32LE(parseHex(r.hex), 0) | 0) : null;
  },
  async readF32(bridge: Bridge, uobjPtr: number, propOff: number): Promise<number | null> {
    const r = await bridge.game.readMemory(uobjPtr + propOff, 4);
    if (!("hex" in r)) return null;
    const b = parseHex(r.hex);
    return new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, true);
  },
  async readF64(bridge: Bridge, uobjPtr: number, propOff: number): Promise<number | null> {
    const r = await bridge.game.readMemory(uobjPtr + propOff, 8);
    if (!("hex" in r)) return null;
    const b = parseHex(r.hex);
    return new DataView(b.buffer, b.byteOffset, 8).getFloat64(0, true);
  },
  async readBool(bridge: Bridge, uobjPtr: number, propOff: number): Promise<boolean | null> {
    const r = await bridge.game.readMemory(uobjPtr + propOff, 1);
    if (!("hex" in r)) return null;
    return parseHex(r.hex)[0] !== 0;
  },
  async readPtr(bridge: Bridge, uobjPtr: number, propOff: number): Promise<number | null> {
    return readU64At(bridge, uobjPtr + propOff);
  },
  async readVector3(bridge: Bridge, uobjPtr: number, propOff: number): Promise<Vector3 | null> {
    return readVector3dAt(bridge, uobjPtr + propOff);
  },
  async writeU32(bridge: Bridge, uobjPtr: number, propOff: number, v: number): Promise<boolean> {
    const b = new ArrayBuffer(4);
    new DataView(b).setUint32(0, v >>> 0, true);
    let hex = "";
    const u8 = new Uint8Array(b);
    for (let i = 0; i < 4; i++) hex += u8[i].toString(16).padStart(2, "0");
    const r = await bridge.game.writeMemory(uobjPtr + propOff, hex);
    return "count" in r;
  },
  async writeF32(bridge: Bridge, uobjPtr: number, propOff: number, v: number): Promise<boolean> {
    const b = new ArrayBuffer(4);
    new DataView(b).setFloat32(0, v, true);
    let hex = "";
    const u8 = new Uint8Array(b);
    for (let i = 0; i < 4; i++) hex += u8[i].toString(16).padStart(2, "0");
    const r = await bridge.game.writeMemory(uobjPtr + propOff, hex);
    return "count" in r;
  },
  async writeVector3(bridge: Bridge, uobjPtr: number, propOff: number, v: Vector3): Promise<boolean> {
    return writeVector3dAt(bridge, uobjPtr + propOff, v);
  },
  // Convenience: find a property's offset on a UClass and return both
  // offset + the absolute address inside an instance. Use to verify and
  // probe before deciding what reader to use.
  async resolve(
    bridge: Bridge,
    uobjPtr: number,
    classPtr: number,
    propName: string,
  ): Promise<{ off: number; addr: number } | null> {
    const off = await findPropertyOffset(bridge, classPtr, propName);
    if (off == null) return null;
    return { off, addr: uobjPtr + off };
  },
};

// Walk every property on a UClass (via PropertyLink) and log
// {name, offset, raw 4 bytes as u32 + f32}. Useful for spotting which
// property holds a value you care about (health = ~100, ammo = ~30,
// etc.) when you don't know the name.
async function dumpAllProperties(
  bridge: Bridge,
  uobjPtr: number,
  classPtr: number,
  max = 256,
): Promise<void> {
  const head = await readU64At(bridge, classPtr + GSC.uStructPropertyLink);
  if (!head) {
    bridge.log("dumpAllProperties: no property chain");
    return;
  }
  let cur = head;
  const seen = new Set<number>();
  let count = 0;
  while (cur && !seen.has(cur) && count < max) {
    seen.add(cur);
    const r = await bridge.game.readMemory(cur, 0x80);
    if (!("hex" in r)) break;
    const propBytes = parseHex(r.hex);
    const comp = readU32LE(propBytes, GSC.fFieldNamePrivate);
    const num = readU32LE(propBytes, GSC.fFieldNamePrivate + 4);
    if (comp > 0x10_000_000 || num > 0x10_000_000) break;
    const name = await decodeFName(bridge, comp, num);
    const off = readU32LE(propBytes, GSC.fPropertyOffsetInternal) | 0;

    // Probe the first 4 bytes at uobjPtr + off as both u32 and f32 so
    // numeric properties (health, stamina, count, etc.) show their
    // current value.
    const valR = await bridge.game.readMemory(uobjPtr + off, 4);
    if ("hex" in valR) {
      const vb = parseHex(valR.hex);
      const u = readU32LE(vb, 0);
      const f = new DataView(vb.buffer, vb.byteOffset, 4).getFloat32(0, true);
      const fStr = Number.isFinite(f) ? f.toFixed(3) : "?";
      bridge.log(`  prop[${String(count).padStart(3)}] ${name.padEnd(36)} @ +0x${off.toString(16).padStart(4, "0")}  u32=${u} f32=${fStr}`);
    } else {
      bridge.log(`  prop[${String(count).padStart(3)}] ${name.padEnd(36)} @ +0x${off.toString(16).padStart(4, "0")}  <fault>`);
    }
    count++;
    cur = readU64LE(propBytes, GSC.fPropertyNextLink);
  }
  bridge.log(`dumpAllProperties: ${count} entries`);
}

// Resolve player location entirely in JS using the verified GSC offsets.
// pawn → class.PropertyLink → find "RootComponent" (offset within pawn) →
// pawnPtr + rootOff → USceneComponent → its class.PropertyLink →
// find "RelativeLocation" + "ComponentToWorld" (the cached FTransform  —
// rendering/physics read this, not RelativeLocation, so a teleport
// without updating it stays invisible).
async function getPlayerLocationViaJS(bridge: Bridge, pawnIdx: number): Promise<{
  home: Vector3;
  pawnPtr: number;
  pawnClassPtr: number;
  rootOff: number;
  rootPtr: number;
  rootClassPtr: number;
  relLocOff: number;
  compToWorldOff: number;
  /** Offset of the FVector Translation slot WITHIN the FTransform.
   *  Auto-detected by matching against RelativeLocation; falls back to
   *  +0x20 if the scan misses. Add this to (rootPtr + compToWorldOff)
   *  to get the absolute address you write to teleport. */
  ctwTranslationInner: number;
} | null> {
  // Read pawn's UObject pointer + class pointer.
  const pawnPtrR = await bridge.game.dumpObjectMemory(pawnIdx, 0, 24);
  if (!("hex" in pawnPtrR)) return null;
  const pawnPtr = pawnPtrR.objPtr;
  const pawnBytes = parseHex(pawnPtrR.hex);
  const pawnClassPtr = readU64LE(pawnBytes, GSC.uObjectClassPtr);

  const rootOff = await findPropertyOffset(bridge, pawnClassPtr, "RootComponent");
  if (rootOff == null) return null;
  bridge.log(`RootComponent @ +0x${rootOff.toString(16)}`);

  const rootPtr = await readU64At(bridge, pawnPtr + rootOff);
  if (!rootPtr) return null;

  // Read SceneComponent's class pointer, then find both transform fields.
  const rootClassPtr = await readU64At(bridge, rootPtr + GSC.uObjectClassPtr);
  if (!rootClassPtr) return null;
  const relLocOff = await findPropertyOffset(bridge, rootClassPtr, "RelativeLocation");
  if (relLocOff == null) return null;
  bridge.log(`RelativeLocation @ +0x${relLocOff.toString(16)} (within RootComponent)`);

  const compToWorldOff = await findPropertyOffset(bridge, rootClassPtr, "ComponentToWorld");
  if (compToWorldOff == null) {
    bridge.log.error("ComponentToWorld property not found — teleport will be invisible");
    return null;
  }
  bridge.log(`ComponentToWorld @ +0x${compToWorldOff.toString(16)} (within RootComponent)`);

  const home = await readVector3dAt(bridge, rootPtr + relLocOff);
  if (!home) return null;

  // Dump the FTransform once for visibility, then auto-locate the
  // Translation slot inside it by matching against RelativeLocation.
  // UE5 LWC FTransform is canonically alignas(16) with TQuat<double>
  // (32B) + TVector<double>(24B) + TVector<double>(24B), so Translation
  // should land at +0x20 — but we verify rather than assume.
  let ctwTranslationInner = 0x20;
  const ctwR = await bridge.game.readMemory(rootPtr + compToWorldOff, 96);
  if ("hex" in ctwR) {
    const ctwBytes = parseHex(ctwR.hex);
    for (let off = 0; off < 96; off += 8) {
      const dv = new DataView(ctwBytes.buffer, ctwBytes.byteOffset + off, 8);
      bridge.log(`  ctw+0x${off.toString(16).padStart(2, "0")}: f64=${dv.getFloat64(0, true).toFixed(2)}  u64=0x${readU64LE(ctwBytes, off).toString(16)}`);
    }
    const detected = locateTranslationOffset(ctwBytes, home);
    if (detected != null) {
      ctwTranslationInner = detected;
      bridge.log(`Translation slot auto-detected at FTransform+0x${detected.toString(16)} (matches RelativeLocation)`);
    } else {
      bridge.log(`Translation slot NOT auto-detected (RelativeLocation absent in FTransform); falling back to +0x20`);
    }
  }

  return {
    home, pawnPtr, pawnClassPtr, rootOff, rootPtr, rootClassPtr,
    relLocOff, compToWorldOff, ctwTranslationInner,
  };
}

function scoreNames(names: string[]): { score: number; matched: string[] } {
  const matched = names.filter((n) => EXPECTED_PAWN_PROPS.has(n));
  // Reward unique recognizable hits; penalize empty/garbage names.
  const empty = names.filter((n) => n === "" || n === "None").length;
  return { score: matched.length * 10 - empty, matched };
}

// Sweep candidate UStruct/FField offsets, pick the combo that decodes
// the most expected pawn-class names. Internal-offset is determined in
// a *second* pass (probeOffsetInternal) because it doesn't affect chain
// walking — making it part of this sweep would be tiebreaker noise.
async function probeUStructLayout(bridge: Bridge, classPtr: number) {
  // Stock UE 5.1 has PropertyLink at +0x60 within UStruct; the GSC fork
  // shifts UStruct fields, so try a window above that too.
  const linkOffsets = [0x60, 0x68, 0x70, 0x78];
  // FField stock NamePrivate is +0x28. With FFieldVariant=24 bytes
  // (instead of 16) it shifts to +0x30; with +16 shift, +0x38.
  const nameOffsets = [0x28, 0x30, 0x38];
  // FProperty.property_link_next stock is +0x58. Same shifts.
  const nextOffsets = [0x58, 0x60, 0x68];

  bridge.log(`UStruct layout probe @ classPtr=0x${classPtr.toString(16)}`);

  // Log the head pointer at each linkOff so we know which look real.
  const heads: { off: number; ptr: number }[] = [];
  for (const off of linkOffsets) {
    const ptr = await readU64At(bridge, classPtr + off);
    bridge.log(`  link@+0x${off.toString(16)} = 0x${(ptr ?? 0).toString(16)}`);
    if (ptr) heads.push({ off, ptr });
  }

  // Read PropertiesSize from the class so the internal-offset probe has
  // a valid range to score against. Stock UE 5.1 has it at +0x48; with
  // the +0x10 UStruct-field shift seen in the GSC build, +0x58. Try
  // both — pick whichever returns a small positive int.
  const sizeAt48 = await (async () => {
    const r = await bridge.game.readMemory(classPtr + 0x48, 4);
    return "hex" in r ? readU32LE(parseHex(r.hex), 0) : 0;
  })();
  const sizeAt58 = await (async () => {
    const r = await bridge.game.readMemory(classPtr + 0x58, 4);
    return "hex" in r ? readU32LE(parseHex(r.hex), 0) : 0;
  })();
  const classSize = [sizeAt48, sizeAt58].filter((s) => s > 0 && s < 0x100_000)[0] ?? 0x10_000;
  bridge.log(`  PropertiesSize candidates: +0x48=${sizeAt48}, +0x58=${sizeAt58} → using ${classSize}`);

  let best: {
    linkOff: number;
    nameOff: number;
    nextOff: number;
    score: number;
    matched: string[];
    chain: { name: string; ptr: number; bytes: Uint8Array }[];
  } | null = null;

  for (const { off: linkOff, ptr: head } of heads) {
    for (const nameOff of nameOffsets) {
      for (const nextOff of nextOffsets) {
        const chain = await walkPropertyChain(bridge, head, nameOff, nextOff, 256);
        if (chain.length === 0) continue;
        const { score, matched } = scoreNames(chain.map((e) => e.name));
        if (!best || score > best.score) {
          best = { linkOff, nameOff, nextOff, score, matched, chain };
        }
      }
    }
  }

  if (!best) {
    bridge.log.error("layout probe found no walkable chain at any candidate offsets");
    return null;
  }

  // Phase 2: disambiguate offset_internal against the now-fixed chain.
  const internal = probeOffsetInternal(best.chain, classSize);
  bridge.log(
    `BEST: linkOff=+0x${best.linkOff.toString(16)} nameOff=+0x${best.nameOff.toString(16)} nextOff=+0x${best.nextOff.toString(16)} internalOff=+0x${internal.off.toString(16)} (${internal.valid}/${internal.total} valid; samples ${internal.samples.join(", ")}) score=${best.score} matched=${best.matched.length}/${best.chain.length}`,
  );
  bridge.log(`matched names: ${best.matched.join(", ")}`);
  bridge.log(`chain length: ${best.chain.length}`);

  // Hunt for RootComponent (and a few other AActor natives) so Phase C
  // can pick up the offset directly without a second log round-trip.
  const wanted = new Set(["RootComponent", "Mesh", "CapsuleComponent", "CharacterMovement"]);
  for (const e of best.chain) {
    if (wanted.has(e.name)) {
      const offset = readU32LE(e.bytes, internal.off) | 0;
      bridge.log(`  → ${e.name} @ +0x${offset.toString(16)} (ptr=0x${e.ptr.toString(16)})`);
    }
  }

  // Also dump the first 40 entries (up from 30) so we can eyeball any
  // BP-specific properties that didn't make it into the wanted set.
  bridge.log(`first ${Math.min(40, best.chain.length)} chain entries:`);
  for (let i = 0; i < Math.min(40, best.chain.length); i++) {
    const e = best.chain[i];
    const off = readU32LE(e.bytes, internal.off) | 0;
    bridge.log(`  [${i}] ${e.name || "<empty>"} @ +0x${off.toString(16)} (ptr=0x${e.ptr.toString(16)})`);
  }
  return { ...best, internalOff: internal.off, classSize };
}

// Wait until BP_Stalker2Character_C exists in GUObjectArray. The pawn
// only spawns once the gameplay world is fully loaded, so this is the
// single, reliable signal that "we're in-game" — no need to also poll
// for a UWorld instance by name. Loops indefinitely; logs object-count
// progress every ~10s so it's obvious when the engine is still loading
// vs genuinely stuck.
async function waitForPlayer(
  bridge: Bridge,
): Promise<{ index: number; name: string; className: string; fullPath: string }> {
  let lastCount = 0;
  let stuckTicks = 0;
  for (let attempt = 0; ; attempt++) {
    const pawn = await bridge.game.getPlayerPawn();
    if ("found" in pawn && pawn.found) return pawn;

    // Every ~10s log progress: object count growing → engine still loading,
    // count stuck → save not loaded yet (probably at main menu).
    if (attempt > 0 && attempt % 5 === 0) {
      const r = await bridge.game.getObjectCount();
      const count = "count" in r ? r.count : -1;
      const delta = count - lastCount;
      if (delta < 100) stuckTicks++; else stuckTicks = 0;
      const hint = stuckTicks >= 2 ? "  (count stable — load a save)" : "";
      bridge.log(`waiting for player pawn… objectCount=${count} (Δ${delta >= 0 ? "+" : ""}${delta})${hint}`);
      lastCount = count;
    }
    await sleep(2000);
  }
}

const init: ModInit = async (bridge) => {
  bridge.log("----------------------------------------");
  bridge.log("mod boot; waiting for reflection...");
  while (true) {
    const { ready } = await bridge.game.isReady();
    if (ready) break;
    await sleep(500);
  }
  // The C++ poller declares ready when GUObjectArray's `objects` ptr is
  // non-null — but UE may not have registered any UObjects yet
  // (num_elements=0). Wait until the count looks plausible before
  // proceeding, otherwise we'd loop on an empty array forever.
  while (true) {
    const r = await bridge.game.getObjectCount();
    if ("count" in r && r.count > 1000) {
      bridge.log(`object count = ${r.count}; reflection live`);
      break;
    }
    await sleep(500);
  }

  // No separate "wait for world" phase — `getPlayerPawn` only succeeds
  // once the gameplay level is fully loaded (the pawn doesn't spawn
  // until then). Polling for the pawn is a tighter signal than polling
  // a hard-coded world name, and survives world-name changes.
  bridge.log("waiting for player pawn (load a save if you're at the menu)");
  const pawn = await waitForPlayer(bridge);
  bridge.log(`pawn ${JSON.stringify(pawn)}`);

  // Sanity: FName{0,0} should always decode to "None".
  const noneCheck = await bridge.game.fnameToString(0, 0);
  bridge.log(`fnameToString self-test: ${JSON.stringify(noneCheck)}`);

  // Resolve location entirely in JS — the C++ getPlayerLocation path is
  // gated on a broken FProperty walker, but the JS walker uses the
  // verified GSC offsets above.
  const located = await getPlayerLocationViaJS(bridge, pawn.index);
  if (!located) {
    bridge.log.error("JS-path location resolution failed; running diagnostic probe");
    const classPtrR = await bridge.game.dumpObjectMemory(pawn.index, GSC.uObjectClassPtr, 8);
    if ("hex" in classPtrR) {
      await probeUStructLayout(bridge, readU64LE(parseHex(classPtrR.hex), 0));
    }
    return;
  }

  const {
    home, pawnPtr, pawnClassPtr, rootPtr, relLocOff, compToWorldOff,
    ctwTranslationInner,
  } = located;
  const origin: Vector3 = { ...home };
  const relLocAddr = rootPtr + relLocOff;
  const ctwTranslationAddr = rootPtr + compToWorldOff + ctwTranslationInner;
  bridge.log(
    `home=(${home.x.toFixed(1)}, ${home.y.toFixed(1)}, ${home.z.toFixed(1)})  relLoc=0x${relLocAddr.toString(16)} ctwTrans=0x${ctwTranslationAddr.toString(16)}`,
  );

  // Diagnostic dump of every property on the pawn class — the menu
  // future mods will pick from when they want Health, Stamina, Ammo,
  // etc. Logged once at startup; doesn't affect the teleport loop.
  bridge.log(`---- pawn class properties (BP_Stalker2Character_C) ----`);
  await dumpAllProperties(bridge, pawnPtr, pawnClassPtr, 256);
  bridge.log(`--------------------------------------------------------`);

  // Teleport loop: write BOTH RelativeLocation (the authored value) and
  // ComponentToWorld.Translation (the cached world transform — what UE
  // actually reads for rendering / physics queries). Without the
  // second write the visual position never moves.
  let atHome = true;
  let tick = 0;
  while (true) {
    await sleep(5000);
    tick++;
    const dest = atHome ? TARGET : origin;
    const ok1 = await writeVector3dAt(bridge, relLocAddr, dest);
    const ok2 = await writeVector3dAt(bridge, ctwTranslationAddr, dest);
    if (!ok1 || !ok2) {
      bridge.log.error(`tick ${tick} writeMemory faulted (rel=${ok1} ctw=${ok2})`);
      continue;
    }
    const rel = await readVector3dAt(bridge, relLocAddr);
    const ctw = await readVector3dAt(bridge, ctwTranslationAddr);
    const fmt = (v: Vector3 | null) =>
      v ? `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})` : "<fault>";
    bridge.log(`tick ${tick} tp -> (${dest.x}, ${dest.y}, ${dest.z}); rel=${fmt(rel)} ctw=${fmt(ctw)}`);
    atHome = !atHome;
  }
};

export default init;


