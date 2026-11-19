/**
 * Minimal Playwright-style runner for in-game STALKER 2 e2e specs (*.e2e.mts).
 * Talks to NodeBridge (127.0.0.1:47811) and the Living Zone Tracker (127.0.0.1:8765) over HTTP.
 * Run specs with: node src/e2e/run.mts <spec files...>
 */
import { spawn, execSync } from "node:child_process";

const BRIDGE = "http://127.0.0.1:47811";
const TRACKER = "http://127.0.0.1:8765";
const REQUEST_TIMEOUT = 5_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(base: string, path: string): Promise<any> {
  const res = await fetch(base + path, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
const bridge = (path: string) => getJson(BRIDGE, path);
const tracker = (path: string) => getJson(TRACKER, path);
const enc = encodeURIComponent;

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeout: number, interval = 500): Promise<T> {
  const end = Date.now() + timeout;
  let lastErr: unknown;
  while (true) {
    try {
      const v = await fn();
      if (v) return v as T;
    } catch (e) {
      lastErr = e;
    }
    if (Date.now() >= end) throw new Error(`timed out after ${timeout} ms waiting for ${what}${lastErr ? ` (last error: ${(lastErr as Error).message})` : ""}`);
    await sleep(interval);
  }
}

// ---------- fixtures ----------

export interface Npc {
  uid: number;
  sid: string;
}

const cmd = (c: string) => bridge(`/cmd?c=${enc(c)}`);

function gameRunning(): boolean {
  const out = execSync("ps -eo cmd", { encoding: "utf8" });
  return out.split("\n").some((l) => /^[SZ]:.*Stalker2-Win64-Shipping/.test(l));
}

const game = {
  cmd,
  async restart() {
    try {
      await cmd("quit");
    } catch {
      /* bridge dies with the game */
    }
    await waitFor("game process to exit", async () => !gameRunning(), 120_000, 1000);
    await sleep(6_000);
    spawn("steam", ["steam://run/1643320"], { detached: true, stdio: "ignore" }).unref();
  },
  async loadLastSave(timeout = 10 * 60_000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      let m: any;
      try {
        m = await bridge("/menu");
      } catch {
        await sleep(2_000); // bridge not up yet
        continue;
      }
      try {
        const gameViews: string[] = m.gameViews ?? [];
        const menuViews: string[] = m.menuViews ?? [];
        if (gameViews.includes("W_GameHUD_C")) return;
        if (m.popup) {
          await bridge("/menu/key?k=F");
        } else if (m.idle?.text === "Text_PressAnyKey") {
          await bridge("/menu/focus");
          await bridge("/menu/key?k=Space&real=1");
          await sleep(1_000);
          await bridge("/menu/key?k=F&real=1");
        } else if (menuViews.includes("W_StartMenuMainView_C")) {
          await bridge("/menu/select?action=LoadLastSaveAction&press=1");
          await sleep(3_000);
        } else if (m.loading?.waitingForKey || (m.screen === "game" && gameViews.length === 0)) {
          await bridge("/menu/key?k=Space");
        }
      } catch {
        /* transient; retry */
      }
      await sleep(1_000);
    }
    throw new Error(`loadLastSave: W_GameHUD_C not shown within ${timeout} ms`);
  },
};

const quest = {
  async activeNodes(qsid: string): Promise<string[]> {
    const q = await bridge(`/quest?sid=${enc(qsid)}`);
    return (q.active ?? []).map((a: any) => a.sid);
  },
  async isRunning(qsid: string): Promise<boolean> {
    const q = await bridge(`/quest?sid=${enc(qsid)}`);
    return !!q.running;
  },
};

const npc = {
  async bySidOrNull(sid: string): Promise<Npc | null> {
    // NodeBridge reads the live unit pool; the tracker lags behind a fresh load (it held no units for a
    // while after a restart on 2026-11-19), so it's only the fallback.
    try {
      const r = await bridge(`/npcs?sid=${enc(sid)}&limit=5`);
      const e = (r.items ?? []).find((x: any) => x.sid === sid && x.alive !== false);
      if (e) return { uid: e.uid, sid: e.sid };
    } catch {}
    try {
      const s = await tracker("/api/state");
      const e = (s.entities ?? []).find((x: any) => x.sid === sid);
      if (e) return { uid: e.uid, sid: e.sid };
    } catch {}
    return null;
  },
  async bySid(sid: string): Promise<Npc> {
    return waitFor(`npc ${sid} (NodeBridge /npcs, tracker /api/state)`, () => npc.bySidOrNull(sid), 60_000, 2000);
  },
};

const relation = {
  async toPlayer(n: Npc): Promise<number> {
    const u = await tracker(`/api/unit/${n.uid}`);
    const v = u.player_relation ?? u.unit?.player_relation;
    if (typeof v !== "number") throw new Error(`no player_relation for uid ${n.uid}`);
    return v;
  },
};

const toNum = (v: unknown) => (typeof v === "boolean" ? Number(v) : Number(v));

const globals = {
  async get(sid: string): Promise<number> {
    const r = await bridge(`/gv?sid=${enc(sid)}`);
    const item = r.items ? r.items.find((i: any) => i.sid === sid) : r;
    if (!item || item.value === undefined) throw new Error(`global var ${sid} not found`);
    return toNum(item.value);
  },
  async trueSids(re: RegExp): Promise<string[]> {
    // literal prefix after ^ for /gv?q=
    const prefix = /^\^?([A-Za-z0-9_]*)/.exec(re.source)?.[1] ?? "";
    const r = await bridge(`/gv?q=${enc(prefix)}`);
    return (r.items ?? []).filter((i: any) => re.test(i.sid) && toNum(i.value)).map((i: any) => i.sid);
  },
};

const player = {
  async giveItem(itemSid: string, n: number) {
    await cmd(`XCreateItemInInventoryByID ${itemSid} 0 ${n} 1`);
  },
  async itemCount(_sid: string): Promise<number> {
    throw new Error("player.itemCount not supported yet: NodeBridge has no inventory endpoint");
  },
};

async function replies(): Promise<{ sid: string; index: number }[]> {
  const m = await bridge("/menu");
  return m.dialogReplies ?? [];
}

async function chooseBy(pred: (sid: string) => boolean, label: string) {
  const r = await waitFor(`dialog reply ${label}`, async () => (await replies()).find((x) => pred(x.sid)), 20_000);
  const res = await bridge(`/dialog/select?reply=${enc(r.sid)}&press=1`);
  if (res && typeof res === "object" && (res.ok === false || res.error)) throw new Error(`dialog/select ${r.sid}: ${JSON.stringify(res).slice(0, 300)}`);
  await waitFor(`reply ${r.sid} to go away`, async () => !(await replies()).some((x) => x.sid === r.sid), 10_000);
}

const dialog = {
  async talkTo(n: Npc) {
    await bridge(`/npc/talk?uid=${n.uid}`);
    await waitFor("dialog replies", async () => (await replies()).length > 0, 20_000);
  },
  choose: (sid: string) => chooseBy((s) => s === sid, sid),
  chooseMatching: (re: RegExp) => chooseBy((s) => re.test(s), String(re)),
  async currentNode(): Promise<string | undefined> {
    const d = await bridge("/dialog");
    const list: any[] = d.dialogs ?? [];
    return (list.find((x) => x.current) ?? list[0])?.node;
  },
};

export const fixtures = { game, quest, npc, dialog, player, globals, relation };
export type Fixtures = typeof fixtures;

// ---------- registry ----------

type Fn = (f: Fixtures) => Promise<void> | void;
export interface TestCase { name: string; fn: Fn }
export interface Suite { name: string; beforeAll: Fn[]; tests: TestCase[] }

export const suites: Suite[] = [];
let current: Suite | null = null;
const rootSuite = (): Suite => {
  let s = suites.find((x) => x.name === "");
  if (!s) suites.push((s = { name: "", beforeAll: [], tests: [] }));
  return s;
};

export class SkipError extends Error {}

function testFn(name: string, fn: Fn) {
  (current ?? rootSuite()).tests.push({ name, fn });
}
testFn.describe = (name: string, body: () => void) => {
  const prev = current;
  current = { name: prev?.name ? `${prev.name} > ${name}` : name, beforeAll: [], tests: [] };
  suites.push(current);
  try {
    body();
  } finally {
    current = prev;
  }
};
testFn.beforeAll = (fn: Fn) => (current ?? rootSuite()).beforeAll.push(fn);
testFn.skip = (cond: unknown, reason = "") => {
  if (cond) throw new SkipError(reason);
};
export const test = testFn;

// ---------- expect ----------

const fmt = (v: unknown) => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

function check(actual: any) {
  return {
    toBe(exp: unknown) {
      if (!Object.is(actual, exp)) throw new Error(`expected ${fmt(actual)} to be ${fmt(exp)}`);
    },
    toBeLessThan(exp: number) {
      if (!(actual < exp)) throw new Error(`expected ${fmt(actual)} to be < ${exp}`);
    },
    toHaveLength(n: number) {
      if (actual?.length !== n) throw new Error(`expected length ${n}, got ${actual?.length} (${fmt(actual)})`);
    },
    toContainMatch(re: RegExp) {
      if (!Array.isArray(actual) || !actual.some((x) => re.test(String(x)))) throw new Error(`expected some element to match ${re}, got ${fmt(actual)}`);
    },
  };
}
type Matchers = ReturnType<typeof check>;
type AsyncMatchers = { [K in keyof Matchers]: (...a: Parameters<Matchers[K]>) => Promise<void> };

function expectFn(actual: unknown): Matchers {
  return check(actual);
}
expectFn.poll = (fn: () => unknown, opts: { timeout?: number; interval?: number } = {}): AsyncMatchers => {
  const timeout = opts.timeout ?? 10_000;
  const interval = opts.interval ?? 500;
  const wrap =
    (name: keyof Matchers) =>
    async (...args: any[]) => {
      const end = Date.now() + timeout;
      while (true) {
        try {
          (check(await fn()) as any)[name](...args);
          return;
        } catch (e) {
          if (Date.now() >= end) throw new Error(`expect.poll timed out after ${timeout} ms: ${(e as Error).message}`);
        }
        await sleep(interval);
      }
    };
  return { toBe: wrap("toBe"), toBeLessThan: wrap("toBeLessThan"), toHaveLength: wrap("toHaveLength"), toContainMatch: wrap("toContainMatch") } as AsyncMatchers;
};
export const expect = expectFn;
