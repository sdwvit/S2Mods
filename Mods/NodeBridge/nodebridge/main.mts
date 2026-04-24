// Smoke-test mod for NodeBridge.
//
// Tries to find the player pawn and teleport it. If no pawn is present
// (e.g. in the main menu), falls back to a diagnostic dump so we can see
// what classes exist in the current game state and confirm FName
// resolution is producing real strings.

import type { ModInit, Vector3 } from "../../../src/nodebridge/runtime/bridge.d.ts";

const TARGET: Vector3 = { x: 404533, y: 550669, z: 579 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitForPlayer(
  bridge: Awaited<Parameters<ModInit>[0]>,
): Promise<
  | { index: number; name: string; className: string; fullPath: string }
  | null
> {
  for (let attempt = 1; ; attempt++) {
    const pawn = await bridge.game.getPlayerPawn();
    if ("found" in pawn && pawn.found) return pawn;

    // Fallback: broad scan across the FULL object array (not just first
    // 4096 — those are class definitions; actor instances are higher up).
    // Filter by substring — server-side decodes name + class once per
    // object, much faster than per-candidate loops from the client.
    if (attempt % 2 === 1) {
      const report = async (filter: string, label: string) => {
        const list = await bridge.game.listObjects({ filter, limit: 32 });
        if ("unresolved" in list) return;
        // Strip Default__ CDOs — we want live instances.
        const items = list.items.filter((it) => !it.name.startsWith("Default__"));
        if (!items.length) { bridge.log(`${label}: none`); return; }
        const line = items.slice(0, 8).map((h) => `[${h.index}] ${h.className}='${h.name}'`).join(" | ");
        bridge.log(`${label} (${items.length}+): ${line}`);
      };
      await report("Character", "class~Character");
      await report("Pawn",      "class~Pawn");
      await report("Stalker",   "class~Stalker");
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
  bridge.log(`pawn idx=${pawn.index} class=${pawn.className} path=${pawn.fullPath}`);

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
    bridge.log(`tick ${tick} tp -> (${destination.x}, ${destination.y}, ${destination.z}); read-back=${verifyStr}`);
    atHome = !atHome;
  }
};

export default init;
