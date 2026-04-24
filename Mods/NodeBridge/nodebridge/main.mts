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

// Heuristic chain walk. Given a head pointer and three candidate offsets
// inside an FField/FProperty record, walk the property_link_next chain,
// decoding the FName at each node. Bounded to avoid loops on garbage.
async function walkPropertyChain(
  bridge: Bridge,
  head: number,
  nameOff: number,
  nextOff: number,
  offsetInternalOff: number,
  max = 64,
): Promise<{ name: string; ptr: number; offset: number }[]> {
  const out: { name: string; ptr: number; offset: number }[] = [];
  let cur = head;
  const seen = new Set<number>();
  while (cur && !seen.has(cur) && out.length < max) {
    seen.add(cur);
    const r = await bridge.game.readMemory(cur, 0x80);
    if (!("hex" in r)) break;
    const bytes = parseHex(r.hex);
    if (bytes.length < Math.max(nameOff + 8, nextOff + 8, offsetInternalOff + 4)) break;
    const comp = readU32LE(bytes, nameOff);
    const num = readU32LE(bytes, nameOff + 4);
    // Sanity: comparison_index for valid FNames is never absurdly huge in
    // practice (FNamePool entries fit in ~24 bits). Bail early on trash.
    if (comp > 0x10_000_000 || num > 0x10_000_000) break;
    const name = await decodeFName(bridge, comp, num);
    const offset = readU32LE(bytes, offsetInternalOff) | 0;  // signed
    out.push({ name, ptr: cur, offset });
    const next = readU64LE(bytes, nextOff);
    cur = next;
  }
  return out;
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

function scoreNames(names: string[]): { score: number; matched: string[] } {
  const matched = names.filter((n) => EXPECTED_PAWN_PROPS.has(n));
  // Reward unique recognizable hits; penalize empty/garbage names.
  const empty = names.filter((n) => n === "" || n === "None").length;
  return { score: matched.length * 10 - empty, matched };
}

// Try every (linkOff, nameOff, nextOff, offsetInternalOff) quadruple that's
// plausible for stock UE 5.1 ± an FFieldVariant size shift. Pick the combo
// that decodes the most expected pawn-class property names.
async function probeUStructLayout(bridge: Bridge, classPtr: number) {
  const linkOffsets = [0x60, 0x68, 0x70, 0x78];
  // FField in stock UE 5.1: NamePrivate at +0x28. With FFieldVariant=24
  // bytes (instead of 16), it shifts to +0x30. With +16 shift, +0x38.
  const nameOffsets = [0x28, 0x30, 0x38];
  // FProperty.property_link_next in stock UE 5.1: +0x58. Same shifts.
  const nextOffsets = [0x58, 0x60, 0x68];
  // FProperty.offset_internal: stock +0x4C. Could shift +/- 8.
  const internalOffsets = [0x44, 0x4C, 0x54];

  bridge.log(`UStruct layout probe @ classPtr=0x${classPtr.toString(16)}`);

  // First, log the head pointer at each linkOff so we know which look real.
  const heads: { off: number; ptr: number }[] = [];
  for (const off of linkOffsets) {
    const ptr = await readU64At(bridge, classPtr + off);
    bridge.log(`  link@+0x${off.toString(16)} = 0x${(ptr ?? 0).toString(16)}`);
    if (ptr) heads.push({ off, ptr });
  }

  let best: {
    linkOff: number;
    nameOff: number;
    nextOff: number;
    internalOff: number;
    score: number;
    matched: string[];
    chain: { name: string; ptr: number; offset: number }[];
  } | null = null;

  for (const { off: linkOff, ptr: head } of heads) {
    for (const nameOff of nameOffsets) {
      for (const nextOff of nextOffsets) {
        for (const internalOff of internalOffsets) {
          const chain = await walkPropertyChain(
            bridge, head, nameOff, nextOff, internalOff, 64,
          );
          if (chain.length === 0) continue;
          const { score, matched } = scoreNames(chain.map((e) => e.name));
          if (!best || score > best.score) {
            best = { linkOff, nameOff, nextOff, internalOff, score, matched, chain };
          }
        }
      }
    }
  }

  if (!best) {
    bridge.log.error("layout probe found no walkable chain at any candidate offsets");
    return null;
  }

  bridge.log(
    `BEST: linkOff=+0x${best.linkOff.toString(16)} nameOff=+0x${best.nameOff.toString(16)} nextOff=+0x${best.nextOff.toString(16)} internalOff=+0x${best.internalOff.toString(16)} score=${best.score} matched=${best.matched.length}/${best.chain.length}`,
  );
  bridge.log(`matched names: ${best.matched.join(", ")}`);
  bridge.log(`first ${Math.min(30, best.chain.length)} chain entries:`);
  for (let i = 0; i < Math.min(30, best.chain.length); i++) {
    const e = best.chain[i];
    bridge.log(`  [${i}] ${e.name || "<empty>"} @ +0x${e.offset.toString(16)} (ptr=0x${e.ptr.toString(16)})`);
  }
  return best;
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

  const home = await bridge.game.getPlayerLocation();
  if ("unresolved" in home) {
    bridge.log.error(
      `getPlayerLocation unresolved: ${home.reason} (rootOff=${home.rootOffset} locOff=${home.locOffset})`,
    );

    // Self-test: FName{0,0} should always decode to "None".
    const noneCheck = await bridge.game.fnameToString(0, 0);
    bridge.log(`fnameToString self-test: ${JSON.stringify(noneCheck)}`);

    // Read class_ptr from the pawn UObject (UObjectBase + 0x10).
    const classPtr = await (async () => {
      const r = await bridge.game.dumpObjectMemory(pawn.index, 0x10, 8);
      if (!("hex" in r)) return null;
      return readU64LE(parseHex(r.hex), 0);
    })();
    if (!classPtr) {
      bridge.log.error("could not read class_ptr from pawn");
      return;
    }

    await probeUStructLayout(bridge, classPtr);
    return;
  }
  const origin: Vector3 = { x: home.x, y: home.y, z: home.z };
  bridge.log(
    `home=(${origin.x.toFixed(1)}, ${origin.y.toFixed(1)}, ${origin.z.toFixed(1)}) rootOff=${home.rootOffset} locOff=${home.locOffset}`,
  );

  let atHome = true;
  let tick = 0;
  while (true) {
    await sleep(5000);
    tick++;
    const destination = atHome ? TARGET : origin;
    const result = await bridge.game.setPlayerLocation(destination);
    if ("unresolved" in result) {
      bridge.log.error(`setPlayerLocation unresolved: ${result.reason}`);
      continue;
    }
    if (!result.ok) {
      bridge.log.error(`tick ${tick} tp failed: ${result.reason}`);
      continue;
    }
    const verify = await bridge.game.getPlayerLocation();
    const verifyStr =
      "unresolved" in verify
        ? verify.reason
        : `(${verify.x.toFixed(1)}, ${verify.y.toFixed(1)}, ${verify.z.toFixed(1)})`;
    bridge.log(`tick ${tick} tp -> (${destination.x}, ${destination.y}, ${destination.z}); read-back=${verifyStr}`);
    atHome = !atHome;
  }
};

export default init;


