// Smoke-test mod for NodeBridge.
// Runs inside the bundled node.exe launched by dwmapi.dll. Receives a `bridge`
// handle bound to this mod's name. For v2 (mutation API) the surface grows;
// this file today just exercises the RO path.

export default async function init(bridge) {
  bridge.log("hello from node!");
  let tick = 0;
  setInterval(async () => {
    tick++;
    try {
      const loc = await bridge.game.getPlayerLocation();
      bridge.log(`tick ${tick} player=${JSON.stringify(loc)}`);
    } catch (e) {
      bridge.log.error(`tick ${tick} failed: ${e?.stack || e}`);
    }
  }, 5000);
}
