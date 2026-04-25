// NodeBridge smoke test mod.
//
// All the heavy lifting (memory primitives, FProperty walker, GSC
// offsets, player session, teleport, UFunction lookup) lives in
// src/nodebridge/runtime/s2lib.mts. This file is just the
// mod-specific recipe.
//
// Hot reload: edit + save and `[bootstrap] reload: NodeBridge/main.mts`
// fires within ~1s, then a fresh boot runs this init again.

import type { ModInit, Vector3 } from "@nodebridge/runtime";
import {
  waitForReflection,
  waitForPlayer,
  getPlayerSession,
  teleportPlayer,
  readPlayerLocation,
  GSC,
  parseHex,
  readU64LE,
  readU64At,
  findUFunction,
  callUFunction,
} from "@nodebridge/runtime";

const TARGET: Vector3 = { x: 443283, y: 654576, z: -3000 };

const init: ModInit = async (bridge) => {
  bridge.log("---------------------------------------");
  bridge.log("mod boot");

  await waitForReflection(bridge);
  bridge.log("waiting for player pawn (load a save if you're at the menu)");
  const pawn = await waitForPlayer(bridge);
  bridge.log(`pawn ${JSON.stringify(pawn)}`);

  const session = await getPlayerSession(bridge, pawn);
  if (!session) {
    bridge.log.error("player session resolution failed");
    return;
  }

  // One-shot teleport (still confirms read/write primitives work).
  await teleportPlayer(bridge, session, TARGET);
  const { rel, ctw } = await readPlayerLocation(bridge, session);
  const fmt = (v: Vector3 | null) =>
    v ? `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})` : "<n/a>";
  bridge.log(`tp once -> (${TARGET.x}, ${TARGET.y}, ${TARGET.z}); rel=${fmt(rel)} ctw=${fmt(ctw)}`);

  // -------- ProcessEvent infrastructure probe ---------
  // Goal: confirm the new bridge.game.processEvent primitive can call a
  // UFunction without crashing the game. We pick K2_GetActorLocation —
  // a kismet wrapper on AActor with NO inputs, returns FVector(24
  // bytes). Params buffer is 24 zero bytes; if the call works, those
  // 24 bytes come back as the actor's location.
  bridge.log("---- processEvent probe ----");
  const pawnObjR = await bridge.game.dumpObjectMemory(pawn.index, 0, 8);
  if (!("hex" in pawnObjR)) {
    bridge.log.error("could not read pawn UObject");
    return;
  }
  const pawnPtr = pawnObjR.objPtr;
  const pawnClassPtr = await readU64At(bridge, pawnPtr + GSC.uObjectClassPtr);
  if (!pawnClassPtr) {
    bridge.log.error("no pawn class");
    return;
  }

  const fnAddr = await findUFunction(bridge, pawnClassPtr, "K2_GetActorLocation");
  if (!fnAddr) {
    bridge.log.error("K2_GetActorLocation UFunction not found on pawn class chain");
    bridge.log("---- end processEvent probe ----");
    return;
  }
  bridge.log(`K2_GetActorLocation UFunction @ 0x${fnAddr.toString(16)}`);

  // Verify the resolved address really is K2_GetActorLocation +
  // read PropertiesSize (UFunction inherits UStruct → +0x58 in GSC).
  const fnNameR = await bridge.game.readMemory(fnAddr + 0x18, 8);
  let nameDecoded = "?";
  if ("hex" in fnNameR) {
    const nb = parseHex(fnNameR.hex);
    const dv = new DataView(nb.buffer, nb.byteOffset, nb.byteLength);
    const comp = dv.getUint32(0, true);
    const num = dv.getUint32(4, true);
    const decoded = await bridge.game.fnameToString(comp, num);
    nameDecoded = "name" in decoded ? decoded.name : "?";
  }
  const sizeR = await bridge.game.readMemory(fnAddr + GSC.uStructPropertiesSize, 4);
  let propSize = -1;
  if ("hex" in sizeR) {
    const sb = parseHex(sizeR.hex);
    propSize = new DataView(sb.buffer, sb.byteOffset, 4).getUint32(0, true);
  }
  bridge.log(`  func name="${nameDecoded}" PropertiesSize=${propSize}`);
  if (propSize <= 0 || propSize > 4096) {
    bridge.log.error("PropertiesSize looks bad — aborting");
    return;
  }

  // Diagnostic dump — hex dump of UFunction at fnAddr (first 0x100 bytes).
  // Look for the UE5 layout: vtable / NamePrivate / class / outer at std
  // UObject offsets, then UStruct fields, then UFunction-specific
  // (ParmsSize, Func ptr).
  const ufnDump = await bridge.game.readMemory(fnAddr, 0x100);
  if ("hex" in ufnDump) {
    const fb = parseHex(ufnDump.hex);
    bridge.log(`UFunction memory dump (first 0x100 bytes):`);
    for (let off = 0; off < fb.length; off += 16) {
      const row = [];
      for (let j = 0; j < 16 && off + j < fb.length; j++) {
        row.push(fb[off + j].toString(16).padStart(2, "0"));
      }
      const ascii: string[] = [];
      for (let j = 0; j < 16 && off + j < fb.length; j++) {
        const b = fb[off + j];
        ascii.push(b >= 32 && b < 127 ? String.fromCharCode(b) : ".");
      }
      bridge.log(`  fn+0x${off.toString(16).padStart(2, "0")}  ${row.join(" ")}  ${ascii.join("")}`);
    }
  }

  // Read vtable[67] at the pawn — log the function pointer + first
  // 16 bytes of the function so we can see if it looks like a real
  // function prologue (push regs, mov rbp,rsp, etc).
  const vtR = await bridge.game.readMemory(pawnPtr, 8);
  if ("hex" in vtR) {
    const vtPtr = readU64LE(parseHex(vtR.hex), 0);
    bridge.log(`pawn vtable @ 0x${vtPtr.toString(16)}`);
    const slotR = await bridge.game.readMemory(vtPtr + 67 * 8, 8);
    if ("hex" in slotR) {
      const fnPtr = readU64LE(parseHex(slotR.hex), 0);
      bridge.log(`vtable[67] = 0x${fnPtr.toString(16)}`);
      const codeR = await bridge.game.readMemory(fnPtr, 16);
      if ("hex" in codeR) {
        bridge.log(`vtable[67] code: ${codeR.hex.slice(0, 48)}`);
      }
    }
  }

  // Still try the call so we see the fault for context.
  const paramsHex = "00".repeat(propSize);
  const r = await bridge.game.processEvent(pawnPtr, fnAddr, paramsHex, 67);
  bridge.log(`ProcessEvent result: ${JSON.stringify(r)}`);
  bridge.log("---- end processEvent probe ----");
};

export default init;
