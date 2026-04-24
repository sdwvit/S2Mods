// Smoke-test mod for NodeBridge.
//
// Reads the player pawn, logs its location, then teleports between the
// requested target and the origin every 5 seconds. If property resolution
// fails, logs the reason with the partial offsets we got so the next
// iteration has concrete data to debug with — no silent failure.

import type { ModInit, Vector3 } from "../../../src/nodebridge/runtime/bridge.d.ts";

const TARGET: Vector3 = { x: 404533, y: 550669, z: 579 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const init: ModInit = async (bridge) => {
  bridge.log("mod boot; waiting for reflection...");

  // Wait until the DLL reports GUObjectArray populated.
  while (true) {
    const { ready } = await bridge.game.isReady();
    if (ready) break;
    await sleep(500);
  }
  bridge.log("reflection ready; locating player pawn");

  const pawn = await bridge.game.getPlayerPawn();
  if ("found" in pawn && pawn.found) {
    bridge.log(`pawn idx=${pawn.index} class=${pawn.className} path=${pawn.fullPath}`);
  } else if ("found" in pawn && !pawn.found) {
    bridge.log.error(`player pawn not found: ${pawn.reason}`);
    return;
  } else {
    bridge.log.error(`player pawn unresolved: ${pawn.reason}`);
    return;
  }

  // Read current location once — becomes the "home" to bounce back to.
  const home = await bridge.game.getPlayerLocation();
  if ("unresolved" in home) {
    bridge.log.error(
      `getPlayerLocation unresolved: ${home.reason} (rootOff=${home.rootOffset} locOff=${home.locOffset})`,
    );
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
    bridge.log(
      `tick ${tick} tp -> (${destination.x}, ${destination.y}, ${destination.z}); read-back=${verifyStr}`,
    );
    atHome = !atHome;
  }
};

export default init;
