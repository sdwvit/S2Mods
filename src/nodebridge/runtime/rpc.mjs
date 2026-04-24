import net from "node:net";

const LEN_BYTES = 4;

export function createRpc(pipePath) {
  const handlers = new Map();
  const eventListeners = new Map();
  const pending = new Map();
  let nextId = 1;
  let sock = null;
  let readBuf = Buffer.alloc(0);
  let connected = false;
  let onClose = null;

  const connect = () =>
    new Promise((resolve, reject) => {
      const s = net.createConnection({ path: pipePath }, () => {
        sock = s;
        connected = true;
        resolve();
      });
      s.on("data", onData);
      s.on("error", (err) => {
        if (!connected) reject(err);
        else shutdown(err);
      });
      s.on("close", () => shutdown(null));
    });

  const shutdown = (err) => {
    connected = false;
    for (const p of pending.values()) p.reject(err ?? new Error("pipe closed"));
    pending.clear();
    if (onClose) onClose(err);
  };

  const onData = (chunk) => {
    readBuf = Buffer.concat([readBuf, chunk]);
    while (readBuf.length >= LEN_BYTES) {
      const len = readBuf.readUInt32BE(0);
      if (readBuf.length < LEN_BYTES + len) break;
      const payload = readBuf.subarray(LEN_BYTES, LEN_BYTES + len);
      readBuf = readBuf.subarray(LEN_BYTES + len);
      let msg;
      try {
        msg = JSON.parse(payload.toString("utf8"));
      } catch (e) {
        send({ type: "error", error: `bad json: ${e.message}` });
        continue;
      }
      dispatch(msg);
    }
  };

  const dispatch = (msg) => {
    if (msg.type === "response") {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error));
      else p.resolve(msg.result);
      return;
    }
    if (msg.type === "request") {
      const fn = handlers.get(msg.method);
      if (!fn) {
        send({ type: "response", id: msg.id, error: `no handler: ${msg.method}` });
        return;
      }
      Promise.resolve()
        .then(() => fn(msg.params))
        .then(
          (result) => send({ type: "response", id: msg.id, result: result ?? null }),
          (err) => send({ type: "response", id: msg.id, error: String(err?.stack || err) }),
        );
      return;
    }
    if (msg.type === "event") {
      const list = eventListeners.get(msg.name);
      if (!list) return;
      for (const cb of list) {
        try {
          cb(msg.payload);
        } catch (e) {
          send({ type: "event", name: "bridge.listenerError", payload: { event: msg.name, error: String(e?.stack || e) } });
        }
      }
    }
  };

  const send = (msg) => {
    if (!sock) throw new Error("pipe not connected");
    const body = Buffer.from(JSON.stringify(msg), "utf8");
    const header = Buffer.alloc(LEN_BYTES);
    header.writeUInt32BE(body.length, 0);
    sock.write(Buffer.concat([header, body]));
  };

  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send({ type: "request", id, method, params: params ?? null });
    });

  const emit = (name, payload) => send({ type: "event", name, payload: payload ?? null });

  const handle = (method, fn) => {
    handlers.set(method, fn);
  };

  const on = (event, cb) => {
    if (!eventListeners.has(event)) eventListeners.set(event, []);
    eventListeners.get(event).push(cb);
  };

  return {
    connect,
    call,
    emit,
    handle,
    on,
    setOnClose: (fn) => {
      onClose = fn;
    },
    close: () => {
      if (sock) sock.end();
    },
  };
}
