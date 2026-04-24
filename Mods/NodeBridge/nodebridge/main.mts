// Smoke-test mod for NodeBridge.
//
// Current goal: identify the Stalker 2 player pawn class name so the next
// commit can target it with a read+write (teleport) loop.
//
// Emits one "scan" line per tick with:
//   - engine-reflection status
//   - UObject count
//   - the top 10 most common class names among currently-live objects
//   - any object whose class name includes "Player"/"Pawn"/"Stalker"

import type { ModInit } from "../../../src/nodebridge/runtime/bridge.d.ts";

const init: ModInit = async (bridge) => {
  bridge.log("mod boot");
  let tick = 0;

  setInterval(async () => {
    tick++;
    try {
      const { ready } = await bridge.game.isReady();
      if (!ready) {
        bridge.log(`tick ${tick} reflection not ready yet`);
        return;
      }
      const [ver, count] = await Promise.all([
        bridge.game.getEngineVersion(),
        bridge.game.getObjectCount(),
      ]);
      bridge.log(
        `tick ${tick} UE=${ver.major}.${ver.minor} ${JSON.stringify(count)}`,
      );

      // Pull a decent-sized slice and do histogram-y things with it.
      const list = await bridge.game.listObjects({ limit: 4096 });
      if ("unresolved" in list) {
        bridge.log(`listObjects unresolved: ${list.reason}`);
        return;
      }

      const items = list.items as Array<{
        index: number;
        name: string;
        className: string;
        fullPath: string;
      }>;

      // Class-name histogram, top 10.
      const classCounts = new Map<string, number>();
      for (const it of items) {
        classCounts.set(it.className, (classCounts.get(it.className) ?? 0) + 1);
      }
      const top = [...classCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([k, v]) => `${k}:${v}`)
        .join(" ");
      bridge.log(`top10 classes (of first ${items.length}): ${top}`);

      // Anything player-ish — print the first few hits.
      const playery = items.filter((it) =>
        /player|pawn|stalker/i.test(`${it.className} ${it.name}`),
      );
      if (playery.length) {
        bridge.log(
          `player candidates (${playery.length}): ` +
            playery
              .slice(0, 5)
              .map((p) => `[${p.index}] ${p.className} '${p.name}'`)
              .join(" | "),
        );
      }
    } catch (e) {
      bridge.log.error(
        `tick ${tick} failed: ${(e as Error)?.stack ?? String(e)}`,
      );
    }
  }, 5000);
};

export default init;
