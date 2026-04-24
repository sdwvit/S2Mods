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

    // Dump diagnostic every few attempts: what DOES exist right now, and
    // does anything vaguely player-ish show up even if our substrings missed?
    if (attempt % 3 === 1) {
      const list = await bridge.game.listObjects({ limit: 4096 });
      if ("unresolved" in list) {
        bridge.log.warn(`listObjects unresolved: ${list.reason}`);
      } else {
        const counts = new Map<string, number>();
        for (const it of list.items) counts.set(it.className, (counts.get(it.className) ?? 0) + 1);
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
          .map(([k, v]) => `${k}:${v}`).join(" ");
        bridge.log(`classes (of ${list.items.length}): ${top}`);

        const hits = list.items.filter((it) =>
          /player|pawn|character|controller|stalker/i.test(`${it.className} ${it.name}`),
        );
        if (hits.length) {
          bridge.log(
            `player-ish (${hits.length}): ` +
              hits.slice(0, 8).map((h) => `[${h.index}] ${h.className}='${h.name}'`).join(" | "),
          );
        } else {
          bridge.log("no player-ish classes yet — are you in a save?");
        }
      }
    }

    if (attempt >= 20) {
      bridge.log.error("gave up waiting for player pawn after 20 attempts");
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

  // Don't touch the player until we're actually in-world — lookups in the
  // main menu or during map transitions resolve to CDOs / anim BPs and
  // crash the property walker. Poll for the world name first.
  let worldTick = 0;
  while (true) {
    const world = await bridge.game.getObjectByName(WORLD_NAME);
    if ("found" in world && world.found) {
      bridge.log(`world loaded: ${WORLD_NAME} (idx=${world.index})`);
      break;
    }
    worldTick++;
    if (worldTick % 6 === 1) bridge.log(`still waiting for ${WORLD_NAME}...`);
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
