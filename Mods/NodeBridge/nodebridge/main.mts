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
  readU64At,
  findUFunction,
  callUFunction,
} from "@nodebridge/runtime";

const TARGET: Vector3 = { x: 443283, y: 654576, z: -3000 };

const init: ModInit = async (bridge) => {
  bridge.log("----------------------------------------");
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
  } else {
    bridge.log(`K2_GetActorLocation UFunction @ 0x${fnAddr.toString(16)}`);
    // 24 zero bytes = empty FVector return slot.
    const result = await callUFunction(bridge, pawn.index, "K2_GetActorLocation", "00".repeat(24));
    if (!result.ok) {
      bridge.log.error(`K2_GetActorLocation call failed: ${result.reason}`);
    } else {
      // Decode FVector from result paramsHex.
      const out = parseHex(result.paramsHex);
      if (out.length >= 24) {
        const dv = new DataView(out.buffer, out.byteOffset, 24);
        const x = dv.getFloat64(0, true);
        const y = dv.getFloat64(8, true);
        const z = dv.getFloat64(16, true);
        bridge.log(`K2_GetActorLocation returned (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
      } else {
        bridge.log(`K2_GetActorLocation returned only ${out.length} bytes (expected 24)`);
      }
    }
  }
  bridge.log("---- end processEvent probe ----");
};

export default init;
