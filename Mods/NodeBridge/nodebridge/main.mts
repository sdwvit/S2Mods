// NodeBridge smoke test mod.
//
// All the heavy lifting (memory primitives, FProperty walker, GSC
// offsets, player session, teleport) lives in
// src/nodebridge/runtime/s2lib.mts. This file is just the
// mod-specific recipe.
//
// What it does on launch:
//   1. Wait for engine reflection + the player pawn.
//   2. Resolve the player session (pawn / RootComponent / cached
//      FTransform Translation / CharacterMovement.Velocity).
//   3. Teleport once to TARGET.
//
// Hot reload: edit + save and `[bootstrap] reload: NodeBridge/main.mts`
// fires within ~1s, then a fresh boot runs this init again.

// Imports resolve via `node_modules/@nodebridge/runtime` — same package
// name source-time and game-time, no path translation. At source-time
// the package is a symlink in this mod's node_modules pointing back at
// `src/nodebridge/runtime/`. At deploy-time inject-nodebridge sets up
// the same symlink under the deployed mod folder pointing at the
// shared `<Win64>/NodeBridge/runtime/`.
import type { ModInit, Vector3 } from "@nodebridge/runtime";
import {
  waitForReflection,
  waitForPlayer,
  getPlayerSession,
  teleportPlayer,
  readPlayerLocation,
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

  const { home, relLocAddr, ctwTranslationAddr, velocityAddr } = session;
  bridge.log(
    `home=(${home.x.toFixed(1)}, ${home.y.toFixed(1)}, ${home.z.toFixed(1)})  relLoc=0x${relLocAddr.toString(16)} ctwTrans=${ctwTranslationAddr ? "0x" + ctwTranslationAddr.toString(16) : "<n/a>"} velocity=${velocityAddr ? "0x" + velocityAddr.toString(16) : "<n/a>"}`,
  );

  const ok = await teleportPlayer(bridge, session, TARGET);
  if (!ok) {
    bridge.log.error("teleport writeMemory faulted");
    return;
  }
  const { rel, ctw } = await readPlayerLocation(bridge, session);
  const fmt = (v: Vector3 | null) =>
    v ? `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})` : "<n/a>";
  bridge.log(`tp once -> (${TARGET.x}, ${TARGET.y}, ${TARGET.z}); rel=${fmt(rel)} ctw=${fmt(ctw)}`);
};

export default init;
