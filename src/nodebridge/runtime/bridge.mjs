export function createBridge(rpc, modName) {
  const prefix = `[${modName}]`;
  const call = (method, args) => rpc.call(method, args);

  const log = (...args) => {
    const msg = args
      .map((a) =>
        typeof a === "string"
          ? a
          : (() => {
              try {
                return JSON.stringify(a);
              } catch {
                return String(a);
              }
            })(),
      )
      .join(" ");
    rpc.emit("log", { level: "info", mod: modName, msg });
  };
  log.warn = (...args) =>
    rpc.emit("log", { level: "warn", mod: modName, msg: args.map(String).join(" ") });
  log.error = (...args) =>
    rpc.emit("log", { level: "error", mod: modName, msg: args.map(String).join(" ") });
  log.debug = (...args) =>
    rpc.emit("log", { level: "debug", mod: modName, msg: args.map(String).join(" ") });

  const on = (event, cb) => rpc.on(`mod.${modName}.${event}`, cb);

  const game = {
    // Meta
    isReady: () => call("game.isReady"),
    getEngineVersion: () => call("game.getEngineVersion"),

    // Read — UObject enumeration
    getObjectCount: () => call("game.getObjectCount"),
    listObjects: (opts) => call("game.listObjects", opts ?? {}),
    getObjectByIndex: (index) => call("game.getObjectByIndex", { index }),
    getObjectByName: (name) => call("game.getObjectByName", { name }),
    getPlayerPawn: () => call("game.getPlayerPawn"),
    getPlayerLocation: () => call("game.getPlayerLocation"),
    setPlayerLocation: (value) => call("game.setPlayerLocation", { value }),

    // Read — properties
    getProperty: (target, prop) => call("game.getProperty", { target, prop }),
    listProperties: (target, max) => call("game.listProperties", { target, max: max ?? 256 }),

    // Write — UObject / UProperty / UFunction. Stubbed until v3; returns
    // { unresolved: true } today so JS authors can wire up code against the
    // final shape now.
    setProperty: (target, prop, value) =>
      call("game.setProperty", { target, prop, value }),
    callFunction: (target, func, args) =>
      call("game.callFunction", { target, func, args }),
  };

  return { modName, prefix, log, call, on, game };
}
