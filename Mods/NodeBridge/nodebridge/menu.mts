// Game menu state and player-style input: reads the UMG widget trees of the active popup, the init
// screens (start / shader cooking) and the menu/game view stacks, and presses keys or clicks
// widgets through window messages (game.windowMessage). Nothing calls UI handlers directly.
// Live probe 2026-11-19: PopupManager.PopupView.ActivePopupWidget, WC_InitScreensViewController.InitScreensView,
// UIMainMenuManager/UIManagerEx.OpenViews; hint widgets (W_HintInputController_C) keep their input
// action FName at ControllerSettings (+0 of the struct), e.g. IA_UI_PopupConfirm.
import type { Bridge } from "@nodebridge/runtime";
import {
  decodeFName,
  findPropertyOffset,
  findUFunction,
  getBuildAddrs,
  getObjectAt,
  getObjectName,
  getObjectPointers,
  parseHex,
  readBuildCache,
  readU32LE,
  readU64At,
  writeBuildCache,
} from "@nodebridge/runtime";

const VISIBILITY = ["Visible", "Collapsed", "Hidden", "HitTestInvisible", "SelfHitTestInvisible"];
const UWIDGET_VISIBILITY = 0xdc; // UWidget.Visibility (ESlateVisibility, 1 byte)
const SINGLETONS = ["PopupManager", "UIMainMenuManager", "UIManagerEx", "WC_InitScreensViewController_C", "LoadingScreenManager"];

export interface MenuItem {
  name: string;
  class: string;
  path: string;
  visibility: string;
  /** Input action of a key hint (W_HintInputController_C), e.g. IA_UI_PopupConfirm. */
  action?: string;
  addr: string;
}

export class Menu {
  private bridge: Bridge;
  private singletons: Record<string, number> | null = null;
  private offsets = new Map<string, number | null>();

  constructor(bridge: Bridge) {
    this.bridge = bridge;
  }

  private ptr = async (a: number) => (await readU64At(this.bridge, a)) ?? 0;
  private async u32(a: number): Promise<number> {
    const r = await this.bridge.game.readMemory(a, 4);
    return "hex" in r ? readU32LE(parseHex(r.hex), 0) : 0;
  }
  private async u8(a: number): Promise<number> {
    const r = await this.bridge.game.readMemory(a, 1);
    return "hex" in r ? parseHex(r.hex)[0] : 0;
  }
  private async className(obj: number): Promise<string> {
    const cls = await this.ptr(obj + 0x10);
    return cls ? getObjectName(this.bridge, cls) : "";
  }

  /** Property offset by name on the object's class chain (cached per class). */
  private async off(obj: number, name: string): Promise<number | null> {
    let cls = await this.ptr(obj + 0x10);
    const key = `${cls}:${name}`;
    if (this.offsets.has(key)) return this.offsets.get(key)!;
    let found: number | null = null;
    for (let d = 0; cls && d < 16 && found == null; d++) {
      found = await findPropertyOffset(this.bridge, cls, name, 4096);
      cls = await this.ptr(cls + 0x40); // UStruct.SuperStruct
    }
    this.offsets.set(key, found);
    return found;
  }
  private async prop(obj: number, name: string): Promise<number> {
    const o = await this.off(obj, name);
    return o == null ? 0 : this.ptr(obj + o);
  }
  private async array(obj: number, name: string): Promise<number[]> {
    const o = await this.off(obj, name);
    if (o == null) return [];
    const data = await this.ptr(obj + o);
    const n = await this.u32(obj + o + 8);
    if (!data || !(n > 0 && n < 512)) return [];
    const r = await this.bridge.game.readMemory(data, n * 8);
    if (!("hex" in r)) return [];
    const b = parseHex(r.hex);
    return Array.from({ length: n }, (_, i) => readU32LE(b, i * 8) + readU32LE(b, i * 8 + 4) * 0x100000000);
  }

  /** UI manager singletons; object indices cached per build and checked by name. */
  private async getSingletons(): Promise<Record<string, number>> {
    const cached: Record<string, number> = (await readBuildCache(this.bridge)).menuIndices ?? {};
    const out: Record<string, number> = {};
    for (const [k, idx] of Object.entries(cached)) {
      const obj = await getObjectAt(this.bridge, idx);
      if (obj && (await getObjectName(this.bridge, obj)).startsWith(`${k}_`)) out[k] = obj;
    }
    if (SINGLETONS.every((k) => out[k])) return out;
    const objects = await getObjectPointers(this.bridge);
    const indices: Record<string, number> = {};
    // UI singletons are created during startup, in the 30k-60k slot range in this build; scan that first.
    const order = [...Array(objects.length).keys()];
    order.sort((a, b) => Number(!(a >= 30000 && a < 60000)) - Number(!(b >= 30000 && b < 60000)));
    for (const i of order) {
      if (SINGLETONS.every((k) => out[k])) break;
      if (!objects[i]) continue;
      const name = await getObjectName(this.bridge, objects[i]);
      const k = SINGLETONS.find((s) => !out[s] && name.startsWith(`${s}_`));
      if (!k) continue;
      out[k] = objects[i];
      indices[k] = i;
    }
    await writeBuildCache(this.bridge, { menuIndices: { ...cached, ...indices } });
    return out;
  }

  /** Visible user widgets and buttons under `root`. */
  private async walk(root: number, prefix: string, out: MenuItem[], depth = 0): Promise<void> {
    if (!root || depth > 40) return;
    const vis = await this.u8(root + UWIDGET_VISIBILITY);
    if (vis === 1 || vis === 2) return; // Collapsed / Hidden: nothing under it is on screen
    const name = await getObjectName(this.bridge, root);
    const cls = await this.className(root);
    const path = `${prefix}/${name}`;
    if (cls.endsWith("_C") || cls.includes("Button")) {
      const item: MenuItem = { name, class: cls, path, visibility: VISIBILITY[vis] ?? String(vis), addr: `0x${root.toString(16)}` };
      if (cls === "W_HintInputController_C") {
        const o = await this.off(root, "ControllerSettings");
        if (o != null) item.action = await decodeFName(this.bridge, await this.u32(root + o), 0);
      }
      out.push(item);
    }
    const tree = await this.prop(root, "WidgetTree");
    if (tree) await this.walk(await this.prop(tree, "RootWidget"), path, out, depth + 1);
    for (const slot of await this.array(root, "Slots")) {
      if (slot) await this.walk(await this.prop(slot, "Content"), path, out, depth + 1);
    }
  }

  async state() {
    if (!this.singletons || !SINGLETONS.every((k) => this.singletons![k])) this.singletons = await this.getSingletons();
    const s = this.singletons;
    const res: {
      screen: string;
      popup: string | null;
      initScreen: string | null;
      menuViews: string[];
      gameViews: string[];
      items: MenuItem[];
    } = { screen: "game", popup: null, initScreen: null, menuViews: [], gameViews: [], items: [] };
    const view = s.PopupManager ? await this.prop(s.PopupManager, "PopupView") : 0;
    const popup = view ? await this.prop(view, "ActivePopupWidget") : 0;
    if (popup && ![1, 2].includes(await this.u8(popup + UWIDGET_VISIBILITY))) {
      res.popup = await this.className(popup);
    }
    const init = s.WC_InitScreensViewController_C ? await this.prop(s.WC_InitScreensViewController_C, "InitScreensView") : 0;
    if (init && ![1, 2].includes(await this.u8(init + UWIDGET_VISIBILITY))) {
      const box = await this.prop(init, "PresenterSizeBox");
      const slot = box ? (await this.array(box, "Slots"))[0] : 0;
      const cur = slot ? await this.prop(slot, "Content") : 0;
      res.initScreen = cur ? await this.className(cur) : "";
    }
    for (const v of s.UIMainMenuManager ? await this.array(s.UIMainMenuManager, "OpenViews") : []) {
      if (v) res.menuViews.push(await this.className(v));
    }
    for (const v of s.UIManagerEx ? await this.array(s.UIManagerEx, "OpenViews") : []) {
      if (v) res.gameViews.push(await this.className(v));
    }
    res.screen = res.popup ? "popup" : res.initScreen != null ? "init" : res.menuViews.length ? "menu" : res.gameViews.length ? "game-ui" : "game";
    // Items of the topmost layer only: what the player can act on now.
    const top = popup && res.popup ? popup : res.initScreen != null ? init : 0;
    const topViews = top ? [top] : res.menuViews.length ? (await this.array(s.UIMainMenuManager, "OpenViews")).slice(-1) : (await this.array(s.UIManagerEx, "OpenViews")).slice(-1);
    for (const v of topViews) await this.walk(v, "", res.items);
    return res;
  }

  // ---------------------------------------------------------------------------
  // input

  private async msg(msg: number, wparam: number, lparam: number) {
    const r = await this.bridge.game.windowMessage(msg, wparam, lparam);
    if ("error" in r) throw new Error(`windowMessage: ${r.error}`);
  }

  /** Press and release a key: WM_KEYDOWN, WM_CHAR (printable keys), WM_KEYUP. */
  async key(name: string, holdMs = 60) {
    const k = keyCode(name);
    if (!k) throw new Error(`unknown key ${name}; use a letter, digit, F1-F12 or one of ${Object.keys(NAMED).join(", ")}`);
    const lp = (1 | (k.scan << 16) | (k.ext ? 1 << 24 : 0)) >>> 0;
    await this.msg(0x100, k.vk, lp); // WM_KEYDOWN
    if (k.char) await this.msg(0x102, k.char, lp); // WM_CHAR
    await new Promise((r) => setTimeout(r, holdMs));
    await this.msg(0x101, k.vk, (lp | 0xc0000000) >>> 0); // WM_KEYUP
    return { key: name, vk: k.vk };
  }

  /** Hold a key for `ms` (hold-to-confirm hints). */
  async hold(name: string, ms: number) {
    return this.key(name, ms);
  }

  /** Window-client position of a widget's centre, from UWidget::GetCachedGeometry (a read-only getter). */
  async widgetCenter(widget: number) {
    await this.ensureHook();
    const fn = await findUFunction(this.bridge, await this.ptr(widget + 0x10), "GetCachedGeometry", 32);
    if (!fn) throw new Error("GetCachedGeometry not found");
    const r = await this.bridge.game.processEvent(widget, fn, "00".repeat(0x80));
    if (r.ok === false) throw new Error(`GetCachedGeometry: ${r.reason}`);
    const b = parseHex(r.paramsHex);
    const f = (o: number) => new DataView(b.buffer, b.byteOffset).getFloat32(o, true);
    // FGeometry (UE 5.1): Size (2f), Scale (f), AbsolutePosition (2f)
    const size = { x: f(0), y: f(4) },
      scale = f(8),
      abs = { x: f(12), y: f(16) };
    const win = await this.bridge.game.getWindow();
    if ("error" in win) throw new Error(`getWindow: ${win.error}`);
    return {
      x: Math.round(abs.x - win.left + (size.x * scale) / 2),
      y: Math.round(abs.y - win.top + (size.y * scale) / 2),
      size,
      scale,
      abs,
      window: win,
    };
  }

  /** Left-click at window-client coordinates: move, button down, button up. */
  async clickAt(x: number, y: number) {
    const lp = ((y & 0xffff) << 16) | (x & 0xffff);
    if (this.bridge.game.setCursor) await this.bridge.game.setCursor(x, y); // older DLLs lack it
    await this.msg(0x200, 0, lp); // WM_MOUSEMOVE
    await new Promise((r) => setTimeout(r, 50));
    await this.msg(0x201, 1, lp); // WM_LBUTTONDOWN (MK_LBUTTON)
    await new Promise((r) => setTimeout(r, 60));
    await this.msg(0x202, 0, lp); // WM_LBUTTONUP
    return { x, y };
  }

  /** Click the visible widget whose name (or path suffix) matches; hints click their mimic button. */
  async click(name: string) {
    const { items } = await this.state();
    const hit =
      items.find((i) => i.name === name || i.path.endsWith(`/${name}`)) ??
      items.find((i) => i.name.toLowerCase().includes(name.toLowerCase()));
    if (!hit) throw new Error(`no visible widget named ${name}`);
    const button = items.find((i) => i.path.startsWith(hit.path + "/") && i.class === "Button") ?? hit;
    const c = await this.widgetCenter(Number(button.addr));
    return { clicked: button.path, geometry: { size: c.size, scale: c.scale, abs: c.abs }, window: c.window, ...(await this.clickAt(c.x, c.y)) };
  }

  private hooked = false;
  private async ensureHook() {
    if (this.hooked) return;
    const hook = await this.bridge.game.installProcessEventHook((await getBuildAddrs(this.bridge)).processEvent);
    if ("error" in hook) throw new Error(`installProcessEventHook: ${hook.error}`);
    this.hooked = true;
  }
}

// Virtual-key codes with set-1 scan codes (US layout); ext = extended-key flag.
const NAMED: Record<string, { vk: number; scan: number; ext?: boolean; char?: number }> = {
  enter: { vk: 0x0d, scan: 0x1c, char: 0x0d },
  escape: { vk: 0x1b, scan: 0x01, char: 0x1b },
  esc: { vk: 0x1b, scan: 0x01, char: 0x1b },
  space: { vk: 0x20, scan: 0x39, char: 0x20 },
  tab: { vk: 0x09, scan: 0x0f, char: 0x09 },
  backspace: { vk: 0x08, scan: 0x0e, char: 0x08 },
  up: { vk: 0x26, scan: 0x48, ext: true },
  down: { vk: 0x28, scan: 0x50, ext: true },
  left: { vk: 0x25, scan: 0x4b, ext: true },
  right: { vk: 0x27, scan: 0x4d, ext: true },
  delete: { vk: 0x2e, scan: 0x53, ext: true },
};
const LETTER_SCAN = "1e30 2e20 1221 2223 1724 2526 3231 1819 1013 1f14 162f 112d 152c".replace(/ /g, "");
const DIGIT_SCAN = [0x0b, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a];

function keyCode(name: string): { vk: number; scan: number; ext?: boolean; char?: number } | null {
  const n = name.toLowerCase();
  if (NAMED[n]) return NAMED[n];
  if (/^f([1-9]|1[0-2])$/.test(n)) {
    const i = Number(n.slice(1));
    return { vk: 0x6f + i, scan: i <= 10 ? 0x3a + i : 0x56 + i - 10 };
  }
  if (/^[a-z]$/.test(n)) {
    const i = n.charCodeAt(0) - 97;
    return { vk: 0x41 + i, scan: parseInt(LETTER_SCAN.slice(i * 2, i * 2 + 2), 16), char: n.charCodeAt(0) };
  }
  if (/^[0-9]$/.test(n)) return { vk: 0x30 + Number(n), scan: DIGIT_SCAN[Number(n)], char: n.charCodeAt(0) };
  return null;
}
