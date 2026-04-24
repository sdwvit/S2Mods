export function createBridge(rpc, modName) {
  const prefix = `[${modName}]`;
  const call = (method, args) => rpc.call(method, args);

  const log = (...args) => {
    const msg = args
      .map((a) => (typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()))
      .join(" ");
    rpc.emit("log", { level: "info", mod: modName, msg });
  };
  log.warn = (...args) => rpc.emit("log", { level: "warn", mod: modName, msg: args.map(String).join(" ") });
  log.error = (...args) => rpc.emit("log", { level: "error", mod: modName, msg: args.map(String).join(" ") });
  log.debug = (...args) => rpc.emit("log", { level: "debug", mod: modName, msg: args.map(String).join(" ") });

  const on = (event, cb) => rpc.on(`mod.${modName}.${event}`, cb);

  const game = {
    getEngineVersion: () => call("game.getEngineVersion"),
    getPlayerLocation: () => call("game.getPlayerLocation"),
    getObjectByName: (name) => call("game.getObjectByName", { name }),
  };

  return { modName, prefix, log, call, on, game };
}
