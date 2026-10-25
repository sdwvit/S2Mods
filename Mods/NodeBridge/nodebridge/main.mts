// Serves console commands over a local HTTP API; the EWeather UEnum extension is disabled.
// See src/nodebridge/offsets.md for layout details and verified addresses.

import http from "node:http";
import type { Bridge, ModInit } from "@nodebridge/runtime";
import {
  decodeFName,
  getObjectName,
  getObjectPointers,
  getPlayerPawnLocation,
  parseHex,
  readU32LE,
  readU64At,
  readU64LE,
  runConsoleCommand,
  waitForReflection,
} from "@nodebridge/runtime";

const COMMAND_PORT = 47811;

/** Endpoint docs, served by GET / (and with every 404). */
const ENDPOINTS = [
  { path: "/", usage: "GET /", doc: "this list" },
  { path: "/cmd", usage: "GET /cmd?c=<console command>", doc: "run any console command" },
  { path: "/find", usage: "GET /find?q=<substring>&limit=200", doc: "live UObjects whose name or class contains q" },
  { path: "/mem", usage: "GET /mem?addr=<n>&n=256", doc: "raw memory read (max 4096 bytes)" },
  {
    path: "/props",
    usage: "GET /props?struct=<n>",
    doc: "property chain of a UStruct/UClass (name, offset, field class, inner pointers)",
  },
  { path: "/obj", usage: "GET /obj?addr=<n>", doc: "name, class and outer path of the UObject at addr" },
  { path: "/pos", usage: "GET /pos", doc: "player location" },
  { path: "/squad", usage: "GET /squad?faction=Spark&size=5", doc: "spawnSquad at the player" },
];

/**
 * Local control server, so one bridge process serves a whole play session: the object-table
 * scan behind runConsoleCommand runs once, and later commands reuse the cached session.
 * Bound to 127.0.0.1 only. Endpoints are listed in ENDPOINTS.
 */
function startCommandServer(bridge: Bridge): void {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      if (url.pathname === "/") return reply(200, { port: COMMAND_PORT, endpoints: ENDPOINTS });
      if (url.pathname === "/cmd") {
        const c = url.searchParams.get("c");
        if (!c) return reply(400, { error: "c required" });
        await runConsoleCommand(bridge, c);
        bridge.log(`[http] ran: ${c}`);
        return reply(200, { ok: true, ran: c });
      }
      if (url.pathname === "/find") {
        const q = url.searchParams.get("q");
        if (!q) return reply(400, { error: "q required" });
        return reply(200, await findObjects(bridge, q, Number(url.searchParams.get("limit") ?? 200)));
      }
      if (url.pathname === "/mem") {
        const addr = Number(url.searchParams.get("addr"));
        const n = Number(url.searchParams.get("n") ?? 256);
        return reply(200, await bridge.game.readMemory(addr, Math.min(n, 4096)));
      }
      if (url.pathname === "/props") return reply(200, await describeProperties(bridge, Number(url.searchParams.get("struct"))));
      if (url.pathname === "/obj") return reply(200, await describeObject(bridge, Number(url.searchParams.get("addr"))));
      if (url.pathname === "/pos") return reply(200, await getPlayerPawnLocation(bridge));
      if (url.pathname === "/squad") {
        const faction = url.searchParams.get("faction") ?? "Spark";
        const size = Number(url.searchParams.get("size") ?? 5);
        return reply(200, { ok: true, ran: await spawnSquad(bridge, faction, size) });
      }
      return reply(404, { error: "unknown path", endpoints: ENDPOINTS });
    } catch (e) {
      bridge.log.error(`[http] ${url.pathname}: ${(e as Error).message}`);
      return reply(500, { error: (e as Error).message });
    }
  });
  server.on("error", (e) => bridge.log.error(`[http] server: ${e.message}`));
  server.listen(COMMAND_PORT, "127.0.0.1", () => bridge.log(`[http] listening on 127.0.0.1:${COMMAND_PORT}`));
}

/**
 * Live UObjects whose name or class contains `q` (case-insensitive). Names are
 * decoded in JS from FNamePool: the C++ listObjects filter matches nothing in this build.
 */
async function findObjects(bridge: Bridge, q: string, limit: number) {
  const objects = await getObjectPointers(bridge);
  const names = new Map<number, string>();
  const nameOf = async (obj: number) => {
    let n = names.get(obj);
    if (n == null) names.set(obj, (n = await getObjectName(bridge, obj)));
    return n;
  };
  const needle = q.toLowerCase();
  const items: Array<{ index: number; addr: number; name: string; className: string; path: string }> = [];
  for (let i = 0; i < objects.length && items.length < limit; i++) {
    const obj = objects[i];
    if (!obj) continue;
    const name = await nameOf(obj);
    const cls = (await readU64At(bridge, obj + 0x10)) ?? 0;
    const className = cls ? await nameOf(cls) : "";
    if (!(name + " " + className).toLowerCase().includes(needle)) continue;
    const outers: string[] = [];
    for (let o = (await readU64At(bridge, obj + 0x20)) ?? 0, d = 0; o && d < 8; o = (await readU64At(bridge, o + 0x20)) ?? 0, d++) {
      outers.unshift(await nameOf(o));
    }
    items.push({ index: i, addr: obj, name, className, path: [...outers, name].join(".") });
  }
  return { total: objects.length, returned: items.length, items };
}

async function describeObject(bridge: Bridge, obj: number) {
  const name = await getObjectName(bridge, obj);
  const cls = (await readU64At(bridge, obj + 0x10)) ?? 0;
  const outers: string[] = [];
  for (let o = (await readU64At(bridge, obj + 0x20)) ?? 0, d = 0; o && d < 8; o = (await readU64At(bridge, o + 0x20)) ?? 0, d++) {
    outers.unshift(await getObjectName(bridge, o));
  }
  return { addr: obj, name, className: cls ? await getObjectName(bridge, cls) : "", path: [...outers, name].join(".") };
}

/** Field class name and the two pointers after FProperty (StructProperty's UStruct, ArrayProperty's Inner) per property. */
async function describeProperties(bridge: Bridge, struct: number) {
  const out: Array<{ name: string; off: number; type: string; p70: string; p78: string }> = [];
  const seen = new Set<number>();
  for (let cur = (await readU64At(bridge, struct + 0x70)) ?? 0; cur && !seen.has(cur) && out.length < 256; ) {
    seen.add(cur);
    const r = await bridge.game.readMemory(cur, 0x80);
    if (!("hex" in r)) break;
    const b = parseHex(r.hex);
    const fieldClass = readU64LE(b, 0x8);
    const typeR = fieldClass ? await bridge.game.readMemory(fieldClass, 8) : null;
    const type = typeR && "hex" in typeR ? await decodeFName(bridge, readU32LE(parseHex(typeR.hex), 0), readU32LE(parseHex(typeR.hex), 4)) : "";
    out.push({
      name: await decodeFName(bridge, readU32LE(b, 0x20), readU32LE(b, 0x24)),
      off: readU32LE(b, 0x44),
      type,
      p70: readU64LE(b, 0x70).toString(16),
      p78: readU64LE(b, 0x78).toString(16),
    });
    cur = readU64LE(b, 0x48);
  }
  return out;
}

const SQUAD_ROLES =["Stormtrooper", "Recon", "Sniper", "CloseCombat"];

/**
 * Spawns `size` soldiers of `faction` (GeneralNPC_<Faction>_<Role>) in a row 8 m along +X from
 * the player, 2.5 m apart, facing back toward the player.
 */
async function spawnSquad(bridge: Bridge, faction: string, size: number): Promise<string[]> {
  const p = await getPlayerPawnLocation(bridge);
  const ran: string[] = [];
  for (let i = 0; i < size; i++) {
    const role = SQUAD_ROLES[i % SQUAD_ROLES.length];
    const x = Math.round(p.x + 800);
    const y = Math.round(p.y + (i - (size - 1) / 2) * 250);
    const cmd = `XSpawnObjBySID GeneralNPC_${faction}_${role} 2 0 ${x} ${y} ${Math.round(p.z + 50)} 0 180 0`;
    await runConsoleCommand(bridge, cmd);
    bridge.log(`[squad] ran: ${cmd}`);
    ran.push(cmd);
  }
  return ran;
}

const FNAME_CTOR_RVA = 0xd26be8; // patternsleuth offline scan 2026-05-01
// The RVA above predates the 2026-09-29 game build; calling it now would jump into unrelated code.
const EWEATHER_ENABLED = false;

// New weather variants to append after the original 12 entries (values 12–21).
const NEW_WEATHERS = [
  "EWeather::HeavyRain",
  "EWeather::Blizzard",
  "EWeather::Sandstorm",
  "EWeather::Hail",
  "EWeather::Overcast",
  "EWeather::Mist",
  "EWeather::Drizzle",
  "EWeather::Windy",
  "EWeather::Freezing",
  "EWeather::Toxic",
];

function toLE32(n: number): string {
  return [(n >>> 0) & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
    .map(b => b.toString(16).padStart(2, "0")).join(" ");
}

function toLE64(n: number): string {
  // Safe for values ≤ 2^53; all enum int64 values are small.
  const lo = n >>> 0;
  const hi = Math.floor(n / 0x100000000) >>> 0;
  return toLE32(lo) + " " + toLE32(hi);
}

const init: ModInit = async (bridge) => {
  if (!EWEATHER_ENABLED) {
    bridge.log("EWeather extend: disabled (stale FName ctor RVA)");
    startCommandServer(bridge);
    return;
  }
  bridge.log("EWeather extend: start");
  await waitForReflection(bridge);

  // 1. Install FName ctor (AOB misses this build, use known RVA).
  const { base } = await bridge.game.mainExeBase();
  await bridge.game.installFnameCtorAddr(base + FNAME_CTOR_RVA);

  // 2. Locate EWeather UEnum.
  // EWeather may not be registered yet at early load — retry for up to 30s.
  let en: { index: number; name: string; className: string } | undefined;
  for (let attempt = 0; attempt < 30 && !en; attempt++) {
    const list = await bridge.game.listObjects({ filter: "Weather", limit: 64 });
    if ("items" in list) en = list.items.find(it => it.className === "Enum" && it.name === "EWeather");
    if (!en) await new Promise(r => setTimeout(r, 1000));
  }
  if (!en) { bridge.log.error("EWeather UEnum not found after 30s"); return; }
  bridge.log(`EWeather index=${en.index}`);

  // 3. Read TArray header at UEnum+0x40.
  const hdrDump = await bridge.game.dumpObjectMemory(en.index, 0x40, 16);
  if (!("hex" in hdrDump)) { bridge.log.error("dump failed"); return; }
  const hdr = parseHex(hdrDump.hex);
  const oldPtr = readU64LE(hdr, 0);
  const oldNum = readU32LE(hdr, 8);
  const enumBase = hdrDump.objPtr;
  bridge.log(`Names TArray: ptr=0x${oldPtr.toString(16)} num=${oldNum} enumBase=0x${enumBase.toString(16)}`);

  // 4. Keep all 12 original entries (real weathers 0–9 + Count=10 + MAX=11).
  //    New entries are appended after them with values 12–21, so the game's
  //    own "for i < EWeather::Count (==10)" loops never touch them.
  const KEEP = oldNum; // 12
  const VALUE_OFFSET = 12; // new weather values start here, clear of Count/MAX
  const existingBytes = await bridge.game.readMemory(oldPtr, KEEP * 16);
  if (!("hex" in existingBytes)) { bridge.log.error("read existing entries failed"); return; }

  // 5. Register new FNames and build new entries buffer.
  const totalEntries = KEEP + NEW_WEATHERS.length;
  const alloc = await bridge.game.virtualAlloc(totalEntries * 16);
  if (!("addr" in alloc)) { bridge.log.error("virtualAlloc failed"); return; }
  bridge.log(`new buffer @ 0x${alloc.addr.toString(16)}`);

  // Write all original entries verbatim.
  await bridge.game.writeMemory(alloc.addr, existingBytes.hex);

  // Append new 10 entries with values 12–21.
  let writeAddr = alloc.addr + KEEP * 16;
  for (let i = 0; i < NEW_WEATHERS.length; i++) {
    const fn = await bridge.game.fnameFromString(NEW_WEATHERS[i]);
    if (!("comp" in fn)) { bridge.log.error(`fnameFromString failed: ${NEW_WEATHERS[i]}`); return; }
    const value = VALUE_OFFSET + i;
    const entryHex = `${toLE32(fn.comp)} ${toLE32(fn.num)} ${toLE64(value)}`;
    await bridge.game.writeMemory(writeAddr, entryHex);
    bridge.log(`  [${value}] "${NEW_WEATHERS[i]}" comp=${fn.comp}`);
    writeAddr += 16;
  }

  // 6. Patch TArray header: new ptr (8B) + num (4B) + max (4B).
  const ptrLo = alloc.addr >>> 0;
  const ptrHi = Math.floor(alloc.addr / 0x100000000) >>> 0;
  const patchHex = `${toLE32(ptrLo)} ${toLE32(ptrHi)} ${toLE32(totalEntries)} ${toLE32(totalEntries)}`;
  await bridge.game.writeMemory(enumBase + 0x40, patchHex);
  bridge.log(`patched TArray header → ptr=0x${alloc.addr.toString(16)} num=${totalEntries}`);

  // 7. Verify by reading back all entries in one shot.
  const allBytes = await bridge.game.readMemory(alloc.addr, totalEntries * 16);
  if ("hex" in allBytes) {
    const buf = parseHex(allBytes.hex);
    const names: string[] = [];
    for (let i = 0; i < totalEntries; i++) {
      names.push(readU32LE(buf, i * 16).toString());
    }
    bridge.log(`verified ${totalEntries} entries, first comp=${names[0]}, last comp=${names[totalEntries - 1]}`);
  }
  bridge.log("EWeather extend: done");
};

export default init;
