// Serves console commands over a local HTTP API; the EWeather UEnum extension is disabled.
// See src/nodebridge/offsets.md for layout details and verified addresses.

import http from "node:http";
import type { Bridge, ModInit } from "@nodebridge/runtime";
import {
  decodeFName,
  getBuildId,
  getExeBase,
  getObjectName,
  getObjectPointers,
  getPlayerPawnLocation,
  parseHex,
  readU32LE,
  readU64At,
  readU64LE,
  readBuildCache,
  runConsoleCommand,
  waitForReflection,
  writeBuildCache,
} from "@nodebridge/runtime";
import { Zone } from "./zone.mts";
import { Menu } from "./menu.mts";
import { currentDialog, talkTo } from "./talk.mts";

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
  {
    path: "/npc",
    usage: "GET /npc?uid=<n> | /npc?sid=<SID>[&fresh=1]",
    doc: "A-Life unit(s) by uid or SID: sid, faction, relation subject, state, health, rank, position (record re-read every call)",
  },
  {
    path: "/gv",
    usage: "GET /gv?sid=<SID> | /gv?q=<substr>",
    doc: "global variable value(s) read from UGlobalVariableManager (type Int/Bool/String; String values decode the stored SID index)",
  },
  { path: "/menu", usage: "GET /menu", doc: "screen (init/popup/menu/game-ui/game), active popup, init screen, view stacks, visible widgets/buttons/key hints (with input action)" },
  { path: "/menu/options", usage: "GET /menu/options", doc: "main-menu option buttons top to bottom: buttonAction (LoadLastSaveAction = Continue) and highlighted" },
  { path: "/menu/select", usage: "GET /menu/select?action=LoadLastSaveAction&press=1", doc: "move the highlight onto that option with Up/Down, checking each step; press=1 then presses Enter on it" },
  { path: "/menu/key", usage: "GET /menu/key?k=Enter|Escape|F|Up|F13|num5|ctrl|vk:0x41...&hold=60&real=1&n=1&gap=400", doc: "press any key (n times, gap ms apart) via the game window's message queue (works unfocused: menus, dialogs, popups); real=1 uses SendInput (needs the game focused); vk:<code> for any virtual-key code" },
  { path: "/menu/click", usage: "GET /menu/click?name=<widget>|x=&y=&b=left|right|middle|x1|x2&hold=60", doc: "click a visible widget's centre, window-client x/y, or (no target) press where the cursor/crosshair is; any mouse button; real input via SendInput on DLL v0.2.33+" },
  { path: "/menu/focus", usage: "GET /menu/focus", doc: "focus the game window with one real click near the bottom centre (not in play); needed before real=1 keys" },
  { path: "/menu/wheel", usage: "GET /menu/wheel?x=&y=&n=1", doc: "mouse wheel notches at window-client x/y (n>0 up)" },
  { path: "/dialog", usage: "GET /dialog", doc: "active dialog: current phrase SID and the NPC's spawn-actor SID (DialogManager+0x350)" },
  { path: "/npc/talk", usage: "GET /npc/talk?uid=<n>", doc: "start the NPC's conversation as if the player pressed Use (native interact handler); NPC must be loaded" },
  { path: "/npcs", usage: "GET /npcs?sid=<substr>&faction=<substr>&alive=1&limit=100", doc: "scan the unit pool with filters" },
  {
    path: "/relation",
    usage: "GET /relation?a=player&b=uid:896",
    doc: "relation value and level both ways. a/b: player | uid:N | sid:X (or bare SID) | subject id",
  },
  { path: "/relations", usage: "GET /relations?of=player&limit=200&fresh=1", doc: "every relation record that involves a subject" },
  {
    path: "/relation/set",
    usage: "GET /relation/set?a=player&b=uid:896&value=-1000&both=1",
    doc: "write the relation value straight into the record(s) (-99999..99999); bypasses the game's change hooks",
  },
  {
    path: "/relation/factions",
    usage: "GET /relation/factions?a=Bandits&b=Player&value=-1000",
    doc: "console XSetRelationBetweenFactions a b value",
  },
  { path: "/relation/radius", usage: "GET /relation/radius?r=500&value=-500", doc: "console XSetRelationsInRadius (player vs NPCs within r cm)" },
];

let menuInstance: Menu | null = null;
const menu = (bridge: Bridge) => {
  if (!menuInstance) {
    menuInstance = new Menu(bridge);
    menuInstance.sid = async (i) => (await getZone(bridge)).sid(i);
  }
  return menuInstance;
};

let zone: Promise<Zone> | null = null;
function getZone(bridge: Bridge): Promise<Zone> {
  zone ??= (async () =>
    new Zone(bridge, {
      exeBase: await getExeBase(bridge),
      buildId: await getBuildId(bridge),
      decodeFName: (c, n) => decodeFName(bridge, c, n),
      readCache: () => readBuildCache(bridge),
      writeCache: (p) => writeBuildCache(bridge, p),
    }))().catch((e) => {
    zone = null;
    throw e;
  });
  return zone;
}

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
      const q = (k: string) => url.searchParams.get(k);
      const flag = (k: string) => q(k) === "1" || q(k) === "true";
      if (url.pathname === "/npc") {
        const z = await getZone(bridge);
        if (q("uid") != null) {
          const n = await z.npcByUid(Number(q("uid")));
          return n ? reply(200, n) : reply(404, { error: "no live unit with that uid" });
        }
        if (q("sid")) return reply(200, await z.npcsBySid(q("sid")!, flag("fresh")));
        return reply(400, { error: "uid or sid required" });
      }
      if (url.pathname === "/npcs") {
        const alive = q("alive") == null ? undefined : flag("alive");
        return reply(200, await (await getZone(bridge)).npcs({ sid: q("sid") ?? undefined, faction: q("faction") ?? undefined, alive, limit: Number(q("limit") ?? 100) }));
      }
      if (url.pathname === "/menu") return reply(200, await menu(bridge).state());
      if (url.pathname === "/menu/options") return reply(200, await menu(bridge).options());
      if (url.pathname === "/menu/select") {
        if (!q("action")) return reply(400, { error: "action required" });
        return reply(200, await menu(bridge).select(q("action")!, flag("press")));
      }
      if (url.pathname === "/menu/key") {
        if (!q("k")) return reply(400, { error: "k required" });
        // n>1: repeat with a gap (default 400 ms; 250 ms still dropped one Up of two, 2026-11-19); back-to-back posted keys get dropped (14 Downs moved 2 rows).
        const n = Math.min(Math.max(Number(q("n") ?? 1), 1), 50);
        let r: unknown;
        for (let i = 0; i < n; i++) {
          if (i) await new Promise((res) => setTimeout(res, Number(q("gap") ?? 400)));
          r = await menu(bridge).key(q("k")!, Number(q("hold") ?? 60), flag("real"));
        }
        if (n > 1) r = { ...(r as object), n };
        bridge.log(`[http] menu key ${q("k")}`);
        return reply(200, r);
      }
      if (url.pathname === "/menu/click") {
        const m = menu(bridge);
        const b = q("b") ?? "left";
        const hold = Number(q("hold") ?? 60);
        const r = q("name")
          ? await m.click(q("name")!, b)
          : q("x") != null && q("y") != null
            ? await m.clickAt(Number(q("x")), Number(q("y")), b, hold)
            : await m.press(b, hold); // no target: press where the cursor/crosshair is
        bridge.log(`[http] menu click ${JSON.stringify(r)}`);
        return reply(200, r);
      }
      if (url.pathname === "/menu/focus") {
        // Real input (real=1) only reaches the focused window; a SendInput click on the game focuses it under
        // Wine/Wayland (2026-11-19). Refused in play, where a left click fires the weapon.
        const m = menu(bridge);
        const st = await m.state();
        if (st.screen === "game") return reply(409, { error: "in play a click would shoot; focus the game by hand" });
        const win = await bridge.game.getWindow();
        if ("error" in win) return reply(500, win);
        const r = await m.clickAt(Math.round(win.width / 2), Math.round(win.height * 0.97), "left", 40);
        return reply(200, { focused: true, screen: st.screen, click: r });
      }
      if (url.pathname === "/menu/wheel") return reply(200, await menu(bridge).wheel(Number(q("x")), Number(q("y")), Number(q("n") ?? 1)));
      if (url.pathname === "/dialog") return reply(200, await currentDialog(bridge, await getZone(bridge)));
      if (url.pathname === "/npc/talk") {
        if (q("uid") == null) return reply(400, { error: "uid required" });
        const r = await talkTo(bridge, await getZone(bridge), Number(q("uid")));
        bridge.log(`[http] npc talk ${q("uid")}: ${JSON.stringify(r)}`);
        return reply(r.ok ? 200 : 409, r);
      }
      if (url.pathname === "/gv") {
        const z = await getZone(bridge);
        if (q("sid")) {
          const hit = (await z.globalVariables(q("sid")!)).find((v) => v.sid === q("sid"));
          return hit ? reply(200, hit) : reply(404, { error: "no global variable with that SID" });
        }
        const all = await z.globalVariables(q("q") ?? undefined);
        return reply(200, { count: all.length, items: all });
      }
      if (url.pathname === "/relation") {
        if (!q("a") || !q("b")) return reply(400, { error: "a and b required" });
        return reply(200, await (await getZone(bridge)).relation(q("a")!, q("b")!));
      }
      if (url.pathname === "/relations") {
        return reply(200, await (await getZone(bridge)).relationsOf(q("of") ?? "player", Number(q("limit") ?? 200), flag("fresh")));
      }
      if (url.pathname === "/relation/set") {
        if (!q("a") || !q("b") || q("value") == null) return reply(400, { error: "a, b and value required" });
        const r = await (await getZone(bridge)).setRelation(q("a")!, q("b")!, Number(q("value")), q("both") !== "0");
        bridge.log(`[http] relation ${q("a")} ${q("b")} = ${q("value")}: ${JSON.stringify(r.written)}`);
        return reply(200, r);
      }
      if (url.pathname === "/relation/factions" || url.pathname === "/relation/radius") {
        const v = Number(q("value"));
        if (!Number.isInteger(v)) return reply(400, { error: "integer value required" });
        const cmd =
          url.pathname === "/relation/radius"
            ? `XSetRelationsInRadius ${Number(q("r") ?? 500)} ${v}`
            : `XSetRelationBetweenFactions ${(q("a") ?? "").replace(/\s/g, "")} ${(q("b") ?? "").replace(/\s/g, "")} ${v}`;
        await runConsoleCommand(bridge, cmd);
        bridge.log(`[http] ran: ${cmd}`);
        return reply(200, { ok: true, ran: cmd });
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
