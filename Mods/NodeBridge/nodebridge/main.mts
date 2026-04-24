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
    const next = readU64LE(bytes, nextOff);
    cur = next;
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

// Resolve player location entirely in JS using the verified GSC offsets.
// pawn → class.PropertyLink → find "RootComponent" (offset within pawn) →
// pawnPtr + rootOff → USceneComponent → its class.PropertyLink →
// find "RelativeLocation" → that addr → read 24 bytes.
async function getPlayerLocationViaJS(bridge: Bridge, pawnIdx: number): Promise<{
  home: Vector3;
  pawnPtr: number;
  rootOff: number;
  rootPtr: number;
  relLocOff: number;
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

  // Read SceneComponent's class pointer, then find RelativeLocation.
  const rootClassPtr = await readU64At(bridge, rootPtr + GSC.uObjectClassPtr);
  if (!rootClassPtr) return null;
  const relLocOff = await findPropertyOffset(bridge, rootClassPtr, "RelativeLocation");
  if (relLocOff == null) return null;
  bridge.log(`RelativeLocation @ +0x${relLocOff.toString(16)} (within RootComponent)`);

  const home = await readVector3dAt(bridge, rootPtr + relLocOff);
  if (!home) return null;
  return { home, pawnPtr, rootOff, rootPtr, relLocOff };
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

async function waitForPlayer(
  bridge: Awaited<Parameters<ModInit>[0]>,
): Promise<
  | { index: number; name: string; className: string; fullPath: string }
  | null
> {
  for (let attempt = 1; ; attempt++) {
    const pawn = await bridge.game.getPlayerPawn();
    if ("found" in pawn && pawn.found) return pawn;

    // Diagnostic dump: the previous attempt matched only UClass/UPackage
    // metadata (className='Class', 'Package', etc.) — those define types
    // but aren't spawned actors. Filter those out client-side and push the
    // limit up so real instances near the WorldMap_WP index surface.
    if (attempt % 2 === 1) {
      const META = new Set(["Class", "Package", "ScriptStruct", "Enum", "Function", "StructProperty", "ObjectProperty"]);
      const report = async (filter: string, label: string) => {
        const list = await bridge.game.listObjects({ filter, limit: 1024 });
        if ("unresolved" in list) return;
        const items = list.items.filter(
          (it) => !it.name.startsWith("Default__") && !META.has(it.className),
        );
        if (!items.length) { bridge.log(`${label}: no real instances`); return; }
        const line = items
          .slice(0, 10)
          .map((h) => `[${h.index}] ${h.className}='${h.name}'`)
          .join(" | ");
        bridge.log(`${label} (${items.length} real): ${line}`);
      };
      await report("Stalker",   "class~Stalker");
      await report("Character", "class~Character");
      await report("Pawn",      "class~Pawn");
      await report("Player",    "class~Player");
    }

    if (attempt >= 10) {
      bridge.log.error("gave up waiting for player pawn after 10 attempts");
      return null;
    }
    await sleep(5000);
  }
}

const WORLD_NAME = "WorldMap_WP";

const init: ModInit = async (bridge) => {
  bridge.log("----------------------------------------");
  bridge.log("mod boot; waiting for reflection...");
  while (true) {
    const { ready } = await bridge.game.isReady();
    if (ready) break;
    await sleep(500);
  }
  bridge.log("reflection ready; waiting for " + WORLD_NAME);

  // Don't touch the player until we're actually in-world. Poll the UObject
  // list for class='World' instances; one should be named WorldMap_WP when
  // the gameplay level is loaded. Dump the full list if not — tells us
  // what the world is actually called if our assumption is wrong.
  let worldTick = 0;
  while (true) {
    const worlds = await bridge.game.listObjects({ className: "World", limit: 64 });
    if ("unresolved" in worlds) {
      bridge.log.error(`listObjects unresolved: ${worlds.reason}`);
      await sleep(5000);
      continue;
    }
    const match = worlds.items.find((w) => w.name === WORLD_NAME);
    if (match) {
      bridge.log(`world loaded: ${WORLD_NAME} (idx=${match.index})`);
      break;
    }
    worldTick++;
    if (worldTick === 1 || worldTick % 6 === 1) {
      const list = worlds.items.map((w) => `${w.name}`).join(", ");
      bridge.log(`waiting for ${WORLD_NAME}. current Worlds (${worlds.items.length}): [${list || "(none)"}]`);
    }
    await sleep(5000);
  }

  bridge.log("locating player pawn");
  const pawn = await waitForPlayer(bridge);
  if (!pawn) return;
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

  const { home, rootPtr, relLocOff } = located;
  const origin: Vector3 = { ...home };
  const locAddr = rootPtr + relLocOff;
  bridge.log(
    `home=(${home.x.toFixed(1)}, ${home.y.toFixed(1)}, ${home.z.toFixed(1)})  locAddr=0x${locAddr.toString(16)}`,
  );

  // Teleport loop: write RelativeLocation directly via writeMemory, ping
  // back via readMemory each tick to confirm. UE updates physics on the
  // next tick, so the read-back may briefly show old coords.
  let atHome = true;
  let tick = 0;
  while (true) {
    await sleep(5000);
    tick++;
    const dest = atHome ? TARGET : origin;
    const ok = await writeVector3dAt(bridge, locAddr, dest);
    if (!ok) {
      bridge.log.error(`tick ${tick} writeMemory faulted`);
      continue;
    }
    const verify = await readVector3dAt(bridge, locAddr);
    const verifyStr = verify
      ? `(${verify.x.toFixed(1)}, ${verify.y.toFixed(1)}, ${verify.z.toFixed(1)})`
      : "<fault>";
    bridge.log(`tick ${tick} tp -> (${dest.x}, ${dest.y}, ${dest.z}); read-back=${verifyStr}`);
    atHome = !atHome;
  }
};

export default init;


