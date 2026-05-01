// NodeBridge runtime helpers for Stalker 2 / GSC UE 5.1.
//
// Mods import what they need from this file. Each helper takes `bridge`
// (the value that comes into the mod's init function) as its first
// parameter. Lower-level memory + FName plumbing sits at the top; the
// player-pawn orchestration helpers (waitForPlayer, getPlayerLocation,
// teleportPlayer) sit at the bottom.
//
// At deploy-time inject-nodebridge copies this whole runtime/ tree
// into <gameRoot>/Stalker2/Binaries/Win64/NodeBridge/runtime/, so
// mods at <gameRoot>/.../NodeBridge/mods/<modName>/main.mts import via
// `import { ... } from "../../runtime/s2lib.mts"`.

import type { Bridge, Vector3 } from "./types.mts";

// Re-export types so mods can `import type { ModInit, Vector3, Bridge }
// from "@nodebridge/runtime"` and not chase a separate sub-path.
export type { Bridge, Vector3, ModInit, GameApi, ObjectRef, Unresolved } from "./types.mts";

// ---------------------------------------------------------------------------
// Verified GSC UE 5.1 layout offsets (Stalker 2). FField/FProperty are
// stock; UStruct's own members are shifted by +0x10 from stock UE 5.1.
// Confirmed by the JS-side probe in session 2026-04-24 23:15.

export const GSC = {
  uStructPropertyLink: 0x70,    // stock +0x60
  uStructPropertiesSize: 0x58,  // stock +0x48
  uStructSuperStruct: 0x40,     // stock +0x30 (assumed +0x10 same shift)
  /** UStruct.Children — UField* head of UFunction/UProperty linked list.
   *  Walk via UField.Next at +0x28 to enumerate functions defined on a
   *  class. Stock UE5 +0x38 → GSC +0x48 with the +0x10 UStruct shift. */
  uStructChildren: 0x48,
  fFieldNamePrivate: 0x28,      // stock
  /** UField.Next — same chain UFunctions and UProperties live on. */
  uFieldNext: 0x28,
  fPropertyNextLink: 0x58,      // stock
  fPropertyOffsetInternal: 0x4c,// stock
  uObjectClassPtr: 0x10,        // stock UObjectBase
  /** Empirical: the cached FTransform.Translation slot lives at
   *  RelativeLocation + 0x130 within USceneComponent memory. UE renders
   *  from the cached transform, not from RelativeLocation, so a
   *  visible teleport requires writing both. */
  sceneCompCachedTranslationDelta: 0x130,
} as const;

// ---------------------------------------------------------------------------
// Hex / number helpers

export function parseHex(hex: string): Uint8Array {
  // Accept both whitespace-separated ("ab cd ef") and tightly packed
  // ("abcdef") forms. C++ readMemory emits whitespace-separated;
  // game.processEvent emits packed; writeMemory accepts either.
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, "");
  if (cleaned.length % 2 !== 0) {
    // Fall back to original space-aware split (lets a malformed input
    // still try to parse byte-by-byte).
    const parts = hex.trim().split(/\s+/).filter(Boolean);
    const out = new Uint8Array(parts.length);
    for (let i = 0; i < parts.length; i++) out[i] = parseInt(parts[i], 16);
    return out;
  }
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function readU32LE(b: Uint8Array, off: number): number {
  return (b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24)) >>> 0;
}

// Stalker 2 64-bit pointers fit comfortably under 2^53, so plain numbers
// are fine here — bigint would force await/JSON gymnastics for no benefit.
export function readU64LE(b: Uint8Array, off: number): number {
  const hi = readU32LE(b, off + 4);
  const lo = readU32LE(b, off);
  return hi * 0x100000000 + lo;
}

export async function readU64At(bridge: Bridge, addr: number): Promise<number | null> {
  const r = await bridge.game.readMemory(addr, 8);
  if (!("hex" in r)) return null;
  return readU64LE(parseHex(r.hex), 0);
}

// ---------------------------------------------------------------------------
// FName decoder. comp=0 num=0 is FName::None; we short-circuit it so
// the in-game resolver doesn't need to be ready before we can return.

export async function decodeFName(bridge: Bridge, comp: number, num: number): Promise<string> {
  if (comp === 0 && num === 0) return "None";
  const r = await bridge.game.fnameToString(comp, num);
  if ("name" in r) return r.name;
  return "";
}

// ---------------------------------------------------------------------------
// Vector3 (FVector3d, 24B little-endian doubles)

export async function readVector3At(bridge: Bridge, addr: number): Promise<Vector3 | null> {
  const r = await bridge.game.readMemory(addr, 24);
  if (!("hex" in r)) return null;
  const bytes = parseHex(r.hex);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, 24);
  return { x: dv.getFloat64(0, true), y: dv.getFloat64(8, true), z: dv.getFloat64(16, true) };
}

export async function writeVector3At(bridge: Bridge, addr: number, v: Vector3): Promise<boolean> {
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

// ---------------------------------------------------------------------------
// FProperty chain walking. Walks PropertyLink (which already includes
// inherited fields — stock UE invariant), so a single walk over a UClass
// surfaces every property up the AActor/UObject hierarchy too.

/** Find a property's offset within a UClass instance by name.
 *  Returns the byte offset (offset_internal) or null on miss. */
export async function findPropertyOffset(
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

/** Walk every property on a UClass and return {name, off}. */
export async function listAllProperties(
  bridge: Bridge,
  classPtr: number,
  max = 256,
): Promise<Array<{ name: string; off: number }>> {
  const head = await readU64At(bridge, classPtr + GSC.uStructPropertyLink);
  if (!head) return [];
  const out: Array<{ name: string; off: number }> = [];
  let cur = head;
  const seen = new Set<number>();
  while (cur && !seen.has(cur) && out.length < max) {
    seen.add(cur);
    const r = await bridge.game.readMemory(cur, 0x80);
    if (!("hex" in r)) break;
    const propBytes = parseHex(r.hex);
    const comp = readU32LE(propBytes, GSC.fFieldNamePrivate);
    const num = readU32LE(propBytes, GSC.fFieldNamePrivate + 4);
    if (comp > 0x10_000_000 || num > 0x10_000_000) break;
    const name = await decodeFName(bridge, comp, num);
    const off = readU32LE(propBytes, GSC.fPropertyOffsetInternal) | 0;
    out.push({ name, off });
    cur = readU64LE(propBytes, GSC.fPropertyNextLink);
  }
  return out;
}

/** Walk every property on a UClass, log {name, offset, first 4 bytes
 *  as u32 + f32}. Use to spot Health/Stamina/Ammo when you don't know
 *  the property name yet. */
export async function dumpAllProperties(
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

/** Filter `props` against name regexes, log each match's value as
 *  u32/f32/bool. Run after listAllProperties to spotlight candidates. */
export async function highlightProperties(
  bridge: Bridge,
  uobjPtr: number,
  props: Array<{ name: string; off: number }>,
  patterns: RegExp[],
  label: string,
): Promise<void> {
  const matches = props.filter((p) => patterns.some((re) => re.test(p.name)));
  if (matches.length === 0) {
    bridge.log(`${label}: no candidates`);
    return;
  }
  bridge.log(`${label} (${matches.length} candidates):`);
  for (const m of matches) {
    const r = await bridge.game.readMemory(uobjPtr + m.off, 4);
    if (!("hex" in r)) {
      bridge.log(`    ${m.name.padEnd(36)} @ +0x${m.off.toString(16).padStart(4, "0")}  <fault>`);
      continue;
    }
    const b = parseHex(r.hex);
    const u = readU32LE(b, 0);
    const f = new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, true);
    const fStr = Number.isFinite(f) ? f.toFixed(3) : "?";
    const bool = b[0] !== 0 ? "true" : "false";
    bridge.log(`    ${m.name.padEnd(36)} @ +0x${m.off.toString(16).padStart(4, "0")}  u32=${u} f32=${fStr} bool=${bool}`);
  }
}

// ---------------------------------------------------------------------------
// Typed property accessors — read/write a property at a known
// (uobjPtr, propOff). Named `s2` so callers can write `s2.readF32(...)`.

export const s2 = {
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
    return readVector3At(bridge, uobjPtr + propOff);
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
    return writeVector3At(bridge, uobjPtr + propOff, v);
  },
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

// ---------------------------------------------------------------------------
// UFunction lookup + invocation. Walks UStruct.Children (a UField*
// chain) to find a UFunction by name, then invokes ProcessEvent via
// the C++ primitive. Once you have callUFunction working you can call
// any kismet helper from JS, including UI helpers like
// KismetSystemLibrary::PrintString and UWidgetBlueprintLibrary::Create.

/** Walk classPtr's Children chain looking for a UFunction with the
 *  given name. Walks SuperStruct chain too (so e.g. APawn methods are
 *  found on a derived BP class). Returns the UFunction's address
 *  (UObject*) so the caller can pass it to processEvent. */
export async function findUFunction(
  bridge: Bridge,
  classPtr: number,
  funcName: string,
  maxClasses = 16,
  maxFields = 4096,
): Promise<number | null> {
  let cls = classPtr;
  let parentWalks = 0;
  while (cls && parentWalks < maxClasses) {
    let field = await readU64At(bridge, cls + GSC.uStructChildren);
    let fieldsSeen = 0;
    const seen = new Set<number>();
    while (field && !seen.has(field) && fieldsSeen < maxFields) {
      seen.add(field);
      // Read the FName at +0x18 (UObjectBase.NamePrivate). UFunction is
      // a UObject, so NamePrivate lives at the standard UObject offset.
      const nameR = await bridge.game.readMemory(field + 0x18, 8);
      if (!("hex" in nameR)) break;
      const nb = parseHex(nameR.hex);
      const comp = readU32LE(nb, 0);
      const num = readU32LE(nb, 4);
      if (comp > 0x10_000_000) break;
      const fieldName = await decodeFName(bridge, comp, num);
      if (fieldName === funcName) return field;
      // Advance via UField.Next (+0x28).
      const nextField = await readU64At(bridge, field + GSC.uFieldNext);
      field = nextField ?? 0;
      fieldsSeen++;
    }
    // Try parent class.
    const superStruct = await readU64At(bridge, cls + GSC.uStructSuperStruct);
    if (!superStruct) break;
    cls = superStruct;
    parentWalks++;
  }
  return null;
}

/** Find a UFunction by name on `target`'s class hierarchy and call it.
 *  paramsHex is the function's parameter struct as a hex string; the
 *  caller knows the layout. Returns the post-call params buffer so out
 *  params / return values can be decoded. Looks up the target's
 *  UObject address, the UFunction address, then forwards to
 *  bridge.game.processEvent. */
export async function callUFunction(
  bridge: Bridge,
  targetIdx: number,
  funcName: string,
  paramsHex: string,
  opts?: { fnAddr?: number; vtableIdx?: number },
): Promise<{ ok: true; paramsHex: string } | { ok: false; reason: string }> {
  const objR = await bridge.game.dumpObjectMemory(targetIdx, 0, 8);
  if (!("hex" in objR)) return { ok: false, reason: "target not found" };
  const targetAddr = objR.objPtr;
  const classPtr = await readU64At(bridge, targetAddr + GSC.uObjectClassPtr);
  if (!classPtr) return { ok: false, reason: "target has no class" };
  const funcAddr = await findUFunction(bridge, classPtr, funcName);
  if (!funcAddr) return { ok: false, reason: `UFunction '${funcName}' not found on class chain` };
  const r: any = await bridge.game.processEvent(targetAddr, funcAddr, paramsHex, opts);
  if (r.ok) return { ok: true, paramsHex: r.paramsHex as string };
  return { ok: false, reason: (r.reason as string) ?? "processEvent failed" };
}

// ---------------------------------------------------------------------------
// Player session helpers. These bind the mod-boot dance into single
// awaits so mods don't have to reimplement the wait-for-reflection +
// wait-for-pawn handshake.

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Wait until the C++ reflection layer reports a populated GUObjectArray. */
export async function waitForReflection(bridge: Bridge): Promise<void> {
  while (true) {
    const { ready } = await bridge.game.isReady();
    if (ready) break;
    await sleep(500);
  }
  // The C++ poller declares ready when GUObjectArray's `objects` ptr is
  // non-null — but UE may not have registered any UObjects yet. Wait
  // until the count looks plausible, otherwise we'd loop on an empty
  // array forever.
  while (true) {
    const r = await bridge.game.getObjectCount();
    if ("count" in r && r.count > 1000) {
      bridge.log(`object count = ${r.count}; reflection live`);
      return;
    }
    await sleep(500);
  }
}

/** Wait for the player pawn to spawn. Logs object-count progress every
 *  ~10s — count stable means the user is at the menu and hasn't loaded
 *  a save yet. Loops indefinitely (no timeout). After 30s with high
 *  object count and no pawn, dumps candidate Stalker/Character/Pawn
 *  classes from listObjects (the C++ getPlayerPawn might be missing
 *  the actual class — different cutscene character, mod variant, etc). */
export async function waitForPlayer(
  bridge: Bridge,
): Promise<{ index: number; name: string; className: string; fullPath: string }> {
  let lastCount = 0;
  let stuckTicks = 0;
  let scanned = false;
  for (let attempt = 0; ; attempt++) {
    const pawn = await bridge.game.getPlayerPawn();
    if ("found" in pawn && pawn.found) return pawn;
    if (attempt > 0 && attempt % 5 === 0) {
      const r = await bridge.game.getObjectCount();
      const count = "count" in r ? r.count : -1;
      const delta = count - lastCount;
      if (delta < 100) stuckTicks++; else stuckTicks = 0;
      const hint = stuckTicks >= 2 ? "  (count stable — load a save)" : "";
      bridge.log(`waiting for player pawn… objectCount=${count} (Δ${delta >= 0 ? "+" : ""}${delta})${hint}`);
      lastCount = count;
      if (!scanned && count > 100_000) {
        scanned = true;
        await dumpPawnCandidates(bridge);
      }
    }
    await sleep(2000);
  }
}

/** When getPlayerPawn keeps missing, dump diagnostic info. First the
 *  per-substring filter view (Stalker/Character/Pawn/Player) so we
 *  see exactly what listObjects matched even if our META filter is
 *  hiding something. Then an unfiltered dump grouped by className —
 *  shows the most populous classes regardless of name pattern, which
 *  surfaces e.g. a renamed player class we'd otherwise miss. */
async function dumpPawnCandidates(bridge: Bridge): Promise<void> {
  bridge.log("scanning for plausible pawn classes…");
  const META = new Set([
    "Class", "Package", "ScriptStruct", "Enum", "Function",
    "StructProperty", "ObjectProperty", "BlueprintGeneratedClass",
  ]);

  for (const filter of ["Stalker", "Character", "Pawn", "Player"]) {
    const list = await bridge.game.listObjects({ filter, limit: 4096 });
    if (!("items" in list)) continue;
    const total = list.items.length;
    const noCdo = list.items.filter((it) => !it.name.startsWith("Default__"));
    const real = noCdo.filter((it) => !META.has(it.className));
    bridge.log(`  filter='${filter}' → ${total} total, ${noCdo.length} non-CDO, ${real.length} non-meta`);
    if (real.length === 0 && noCdo.length > 0) {
      // Show what META filter ate, so we can adjust if a real player
      // class is being misclassified.
      const byClass = new Map<string, number>();
      for (const it of noCdo) byClass.set(it.className, (byClass.get(it.className) ?? 0) + 1);
      const top = [...byClass.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      bridge.log(`    (all matches are meta-typed; classNames: ${top.map(([c, n]) => `${c}×${n}`).join(", ")})`);
      continue;
    }
    const byClass = new Map<string, { count: number; sample: string; idx: number }>();
    for (const it of real) {
      const cur = byClass.get(it.className);
      if (cur) cur.count++;
      else byClass.set(it.className, { count: 1, sample: it.name, idx: it.index });
    }
    for (const [cls, info] of [...byClass.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15)) {
      bridge.log(`    ${cls.padEnd(40)} × ${String(info.count).padStart(4)}  (e.g. [${info.idx}] '${info.sample}')`);
    }
  }

  // Unfiltered top-classes view. Walk a chunk of GUObjectArray, group
  // by className, log the most populous classes regardless of name.
  // Useful when our hardcoded filter strings don't match anything.
  bridge.log("  (unfiltered) top classes in first 4096 objects:");
  const all = await bridge.game.listObjects({ limit: 4096 });
  if ("items" in all) {
    const byClass = new Map<string, { count: number; sample: string; idx: number }>();
    for (const it of all.items) {
      if (it.name.startsWith("Default__")) continue;
      if (META.has(it.className)) continue;
      const cur = byClass.get(it.className);
      if (cur) cur.count++;
      else byClass.set(it.className, { count: 1, sample: it.name, idx: it.index });
    }
    for (const [cls, info] of [...byClass.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 25)) {
      bridge.log(`    ${cls.padEnd(40)} × ${String(info.count).padStart(4)}  (e.g. [${info.idx}] '${info.sample}')`);
    }
  }
}

/** Resolve everything needed to read or move the player: pawn UObject,
 *  pawn class, RootComponent, RelativeLocation address, cached
 *  FTransform.Translation address, current home position. Returns null
 *  on any resolution failure. */
export interface PlayerSession {
  pawn: { index: number; name: string; className: string; fullPath: string };
  pawnPtr: number;
  pawnClassPtr: number;
  rootPtr: number;
  rootClassPtr: number;
  rootOff: number;
  relLocOff: number;
  relLocAddr: number;
  /** Address of the cached FTransform.Translation slot (UE renders
   *  from this; writing only RelativeLocation leaves the visual
   *  position stale). null if we couldn't locate it. */
  ctwTranslationAddr: number | null;
  /** The player's RelativeLocation at session-resolve time. */
  home: Vector3;
  /** CharacterMovement.Velocity address, or null if unresolved. Zero
   *  this before writing a new position to prevent the movement
   *  component re-integrating from old velocity. */
  velocityAddr: number | null;
}

export async function getPlayerSession(
  bridge: Bridge,
  pawn: { index: number; className: string },
): Promise<PlayerSession | null> {
  const pawnR = await bridge.game.dumpObjectMemory(pawn.index, 0, 24);
  if (!("hex" in pawnR)) return null;
  const pawnPtr = pawnR.objPtr;
  const pawnBytes = parseHex(pawnR.hex);
  const pawnClassPtr = readU64LE(pawnBytes, GSC.uObjectClassPtr);

  const rootOff = await findPropertyOffset(bridge, pawnClassPtr, "RootComponent");
  if (rootOff == null) return null;
  const rootPtr = await readU64At(bridge, pawnPtr + rootOff);
  if (!rootPtr) return null;

  const rootClassPtr = await readU64At(bridge, rootPtr + GSC.uObjectClassPtr);
  if (!rootClassPtr) return null;

  const relLocOff = await findPropertyOffset(bridge, rootClassPtr, "RelativeLocation");
  if (relLocOff == null) return null;
  const relLocAddr = rootPtr + relLocOff;

  const home = await readVector3At(bridge, relLocAddr);
  if (!home) return null;

  // Cached FTransform.Translation lives at relLocOff + 0x130 within
  // USceneComponent memory on the GSC build. Verified by experiment;
  // this is the only known reliable way to find it (ComponentToWorld
  // is a private/transient field with no UPROPERTY tag in this fork).
  const ctwTranslationAddr = rootPtr + relLocOff + GSC.sceneCompCachedTranslationDelta;

  // CharacterMovement.Velocity (best-effort).
  let velocityAddr: number | null = null;
  const charMovOff = await findPropertyOffset(bridge, pawnClassPtr, "CharacterMovement");
  if (charMovOff != null) {
    const cmPtr = await readU64At(bridge, pawnPtr + charMovOff);
    if (cmPtr) {
      const cmClassPtr = await readU64At(bridge, cmPtr + GSC.uObjectClassPtr);
      if (cmClassPtr) {
        const velOff = await findPropertyOffset(bridge, cmClassPtr, "Velocity");
        if (velOff != null) velocityAddr = cmPtr + velOff;
      }
    }
  }

  return {
    pawn: pawn as PlayerSession["pawn"],
    pawnPtr,
    pawnClassPtr,
    rootPtr,
    rootClassPtr,
    rootOff,
    relLocOff,
    relLocAddr,
    ctwTranslationAddr,
    home,
    velocityAddr,
  };
}

/** Teleport the player to (x, y, z). Zeroes velocity, then writes both
 *  RelativeLocation and the cached FTransform.Translation. Returns
 *  true if all writes succeeded. */
export async function teleportPlayer(
  bridge: Bridge,
  session: PlayerSession,
  target: Vector3,
): Promise<boolean> {
  const ZERO: Vector3 = { x: 0, y: 0, z: 0 };
  if (session.velocityAddr != null) await writeVector3At(bridge, session.velocityAddr, ZERO);
  const ok1 = await writeVector3At(bridge, session.relLocAddr, target);
  const ok2 = session.ctwTranslationAddr != null
    ? await writeVector3At(bridge, session.ctwTranslationAddr, target)
    : true;
  return ok1 && ok2;
}

/** Read the player's CURRENT location (re-reads RelativeLocation and
 *  the cached FTransform.Translation; doesn't use the home cached on
 *  the session). */
export async function readPlayerLocation(
  bridge: Bridge,
  session: PlayerSession,
): Promise<{ rel: Vector3 | null; ctw: Vector3 | null }> {
  const rel = await readVector3At(bridge, session.relLocAddr);
  const ctw = session.ctwTranslationAddr != null
    ? await readVector3At(bridge, session.ctwTranslationAddr)
    : null;
  return { rel, ctw };
}
