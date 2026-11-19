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
  getBuildId,
  getExeBase,
  getObjectAt,
  getObjectName,
  parseHex,
  readBuildCache,
  readU32LE,
  readU64At,
} from "@nodebridge/runtime";

const VISIBILITY = ["Visible", "Collapsed", "Hidden", "HitTestInvisible", "SelfHitTestInvisible"];
const UWIDGET_VISIBILITY = 0xdc; // UWidget.Visibility (ESlateVisibility, 1 byte)
/** Live for the whole run. */
const REQUIRED = ["PopupManager", "UIMainMenuManager", "UIManagerEx"];
/**
 * RVAs of the UI managers in the exe's game-singleton pointer table (exe+0xa2c8598.. holds ~70 managers:
 * SoundManager, TimeManager, GlobalVariableManager @0xa2c85f0, ...). Keyed by getBuildId. Re-find after a game
 * update: search exe .data for qwords equal to the live manager addresses.
 */
const SINGLETON_RVAS: Record<string, Record<string, number>> = {
  "2b1aeebf-b954000": { UIMainMenuManager: 0xa2c8618, UIManagerEx: 0xa2c8640, PopupManager: 0xa2c8718 },
};

export interface MenuItem {
  name: string;
  class: string;
  path: string;
  visibility: string;
  /** Input action of a key hint (W_HintInputController_C), e.g. IA_UI_PopupConfirm. */
  action?: string;
  /** Menu option buttons (W_PushOptionButton_C): ButtonAction class, e.g. LoadLastSaveAction = Continue. */
  buttonAction?: string;
  /** Menu option buttons: highlighted now (HoverBackground opacity > 0.5). */
  highlighted?: boolean;
  addr: string;
}

/** Main-menu ButtonAction classes, top to bottom in this build (2026-11-19). GotoViewAction_N open sub-views. */
export const MENU_ACTIONS = { continue: "LoadLastSaveAction", quit: "QuitAction" };

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

  /**
   * UI manager singletons, read from the exe's singleton pointer table (static per exe build, like the Living
   * Zone Tracker's native_layout.json: exe base + RVA survives restarts; only heap addresses change).
   * The init-screen controller is not in that table: it comes from build cache `menuIndices` (startup only,
   * checked by name; stale = not there). No object-table scans.
   */
  private async getSingletons(): Promise<Record<string, number>> {
    const build = await getBuildId(this.bridge);
    const rvas = SINGLETON_RVAS[build];
    if (!rvas) throw new Error(`no UI singleton table for game build ${build}; find it again (see eng-runtime-integration skill)`);
    const base = await getExeBase(this.bridge);
    const out: Record<string, number> = {};
    for (const [k, rva] of Object.entries(rvas)) {
      const obj = await this.ptr(base + rva);
      if (obj && (await getObjectName(this.bridge, obj)).startsWith(`${k}_`)) out[k] = obj;
    }
    const idx: number | undefined = (await readBuildCache(this.bridge)).menuIndices?.WC_InitScreensViewController_C;
    if (idx != null) {
      const obj = await getObjectAt(this.bridge, idx);
      if (obj && (await getObjectName(this.bridge, obj)).startsWith("WC_InitScreensViewController_C_")) out.WC_InitScreensViewController_C = obj;
    }
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
      if (cls === "W_PushOptionButton_C") {
        const act = await this.prop(root, "ButtonAction");
        if (act) item.buttonAction = await getObjectName(this.bridge, act);
        const hover = await this.prop(root, "HoverBackground");
        if (hover) {
          const r = await this.bridge.game.readMemory(hover + 0xe0, 4); // UWidget.RenderOpacity
          if ("hex" in r) item.highlighted = new DataView(parseHex(r.hex).buffer).getFloat32(0, true) > 0.5;
        }
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
    if (!this.singletons || !REQUIRED.every((k) => this.singletons![k])) this.singletons = await this.getSingletons();
    else if (this.singletons.WC_InitScreensViewController_C && !(await getObjectName(this.bridge, this.singletons.WC_InitScreensViewController_C)).startsWith("WC_InitScreensViewController_C_")) {
      delete this.singletons.WC_InitScreensViewController_C; // destroyed after startup
    }
    const s = this.singletons;
    const res: {
      screen: string;
      popup: string | null;
      initScreen: string | null;
      menuViews: string[];
      gameViews: string[];
      items: MenuItem[];
      loading: null | { done: boolean; waitingForKey: boolean };
    } = { screen: "game", popup: null, initScreen: null, menuViews: [], gameViews: [], items: [], loading: null };
    const ls = await this.loadingScreen();
    res.loading = ls && (ls.waitingForKey || !ls.done) ? ls : null; // a finished screen fades out over the HUD
    const view = s.PopupManager ? await this.prop(s.PopupManager, "PopupView") : 0;
    const popup = view ? await this.prop(view, "ActivePopupWidget") : 0;
    // ActivePopupWidget stays set after a popup closes (its own Visibility too); the PopupView container is what
    // collapses. Count a popup only when both are visible and not faded out.
    // Flags alone are not enough: on 2026-11-19 a closed mod-download popup kept every flag (view and popup
    // visible, opacity 1, still in PopupOverlay) but had a 0x0 cached geometry. Require a painted size too.
    if (popup && (await this.shown(view)) && (await this.shown(popup)) && (await this.painted(popup))) {
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
    res.screen = res.popup ? "popup" : res.loading ? "loading" : res.initScreen != null ? "init" : res.menuViews.length ? "menu" : res.gameViews.length ? "game-ui" : "game";
    // Items of the topmost layer only: what the player can act on now.
    const top = popup && res.popup ? popup : res.initScreen != null ? init : 0;
    const topViews = top ? [top] : res.menuViews.length ? (await this.array(s.UIMainMenuManager, "OpenViews")).slice(-1) : (await this.array(s.UIManagerEx, "OpenViews")).slice(-1);
    for (const v of topViews) await this.walk(v, "", res.items);
    return res;
  }

  /**
   * W_LoadingScreen_C (outer BP_SML_C): visible while a level loads; when loading finishes the progress bar
   * collapses and PressAnyButtonText shows ("press any key to continue"). Found by a cached object index
   * (build cache `loadingScreenIndex`, checked by class); no scans: a stale index means no loading screen.
   */
  private async loadingScreen(): Promise<{ done: boolean; waitingForKey: boolean } | null> {
    const idx: number | undefined = (await readBuildCache(this.bridge)).loadingScreenIndex;
    if (idx == null) return null;
    const w = await getObjectAt(this.bridge, idx);
    if (!w || (await this.className(w)) !== "W_LoadingScreen_C") return null;
    if ([1, 2].includes(await this.u8(w + UWIDGET_VISIBILITY))) return null;
    const vis = async (prop: string) => {
      const c = await this.prop(w, prop);
      return c ? ![1, 2].includes(await this.u8(c + UWIDGET_VISIBILITY)) : false;
    };
    const waitingForKey = await vis("PressAnyButtonText");
    return { done: !(await vis("LoadingProgressBar")), waitingForKey };
  }

  /** Slate laid the widget out with a nonzero size (UWidget::GetCachedGeometry, a read-only getter). */
  private async painted(w: number): Promise<boolean> {
    try {
      const g = await this.geometry(w);
      return g.size.x * g.scale > 1 && g.size.y * g.scale > 1;
    } catch {
      return true; // can't tell: fall back to the flags
    }
  }

  private async geometry(widget: number) {
    await this.ensureHook();
    const fn = await findUFunction(this.bridge, await this.ptr(widget + 0x10), "GetCachedGeometry", 32);
    if (!fn) throw new Error("GetCachedGeometry not found");
    const r = await this.bridge.game.processEvent(widget, fn, "00".repeat(0x80));
    if (r.ok === false) throw new Error(`GetCachedGeometry: ${r.reason}`);
    const b = parseHex(r.paramsHex);
    const f = (o: number) => new DataView(b.buffer, b.byteOffset).getFloat32(o, true);
    // FGeometry (UE 5.1): Size (2f), Scale (f), AbsolutePosition (2f)
    return { size: { x: f(0), y: f(4) }, scale: f(8), abs: { x: f(12), y: f(16) } };
  }

  /** Visibility is not Collapsed/Hidden and RenderOpacity is above zero. */
  private async shown(w: number): Promise<boolean> {
    if ([1, 2].includes(await this.u8(w + UWIDGET_VISIBILITY))) return false;
    const r = await this.bridge.game.readMemory(w + 0xe0, 4); // UWidget.RenderOpacity
    if (!("hex" in r)) return false;
    const b = parseHex(r.hex);
    return new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, true) > 0.01;
  }

  // ---------------------------------------------------------------------------
  // input

  private async msg(msg: number, wparam: number, lparam: number) {
    const r = await this.bridge.game.windowMessage(msg, wparam, lparam);
    if ("error" in r) throw new Error(`windowMessage: ${r.error}`);
  }

  /** Press and release a key: WM_KEYDOWN, WM_CHAR (printable keys), WM_KEYUP. */
  /** Real OS input (game.sendInput, DLL v0.2.33+); false when the DLL lacks it. */
  private async input(events: any[]): Promise<boolean> {
    const send = (this.bridge.game as any).sendInput;
    if (!send) return false;
    const r = await send(events, true);
    if (r && "error" in r) {
      if (/no handler/.test(r.error)) return false;
      throw new Error(`sendInput: ${r.error}`);
    }
    return true;
  }

  async key(name: string, holdMs = 60) {
    const k = keyCode(name);
    if (k) {
      const modUps = MODIFIER_VKS.includes(k.vk) ? [] : MODIFIERS.map((m) => ({ type: "key", vk: m.vk, scan: m.scan, ext: !!m.ext, up: true }));
      if (await this.input([...modUps, { type: "key", vk: k.vk, scan: k.scan, ext: !!k.ext }])) {
        await new Promise((r) => setTimeout(r, holdMs));
        await this.input([{ type: "key", vk: k.vk, scan: k.scan, ext: !!k.ext, up: true }]);
        return { key: name, vk: k.vk, via: "SendInput" };
      }
    }
    if (!k) throw new Error(`unknown key ${name}; use a letter, digit, F1-F24, num0-num9, vk:<code> or one of ${Object.keys(NAMED).join(", ")}`);
    // Bit 29 (Alt context) is never set here: Enter goes out as 0x001C0001 / 0xC01C0001. Still, under Wine the
    // game read a posted Enter as Alt+Enter (fullscreen toggle) on 2026-11-19: UE's cached modifier state can
    // keep a stale Alt (e.g. after Alt-Tab). Release every modifier first unless this key is one.
    if (!MODIFIER_VKS.includes(k.vk)) await this.releaseModifiers();
    const lp = (1 | (k.scan << 16) | (k.ext ? 1 << 24 : 0)) >>> 0;
    await this.msg(0x100, k.vk, lp); // WM_KEYDOWN
    if (k.char) await this.msg(0x102, k.char, lp); // WM_CHAR
    await new Promise((r) => setTimeout(r, holdMs));
    await this.msg(0x101, k.vk, (lp | 0xc0000000) >>> 0); // WM_KEYUP
    return { key: name, vk: k.vk, via: "PostMessage" };
  }

  /** Post key-up for Alt/Ctrl/Shift (generic and left/right) so UE's modifier state has none held. */
  private async releaseModifiers() {
    for (const m of MODIFIERS) {
      const lp = (1 | (m.scan << 16) | (m.ext ? 1 << 24 : 0) | 0xc0000000) >>> 0;
      await this.msg(m.alt ? 0x105 : 0x101, m.vk, lp); // WM_SYSKEYUP for Alt (as Windows sends it), else WM_KEYUP
    }
  }

  /** Visible menu option buttons in on-screen order (top to bottom). */
  async options() {
    const { items } = await this.state();
    return items.filter((i) => i.class === "W_PushOptionButton_C");
  }

  /**
   * Move the menu highlight onto the option whose ButtonAction starts with `action` (e.g. "LoadLastSaveAction",
   * "GotoViewAction_1") with Up/Down, re-reading the highlight after every press. With `press`, presses Enter
   * only after the highlight is confirmed on that option.
   */
  async select(action: string, press = false) {
    const steps: string[] = [];
    for (let n = 0; n < 12; n++) {
      const opts = await this.options();
      const target = opts.findIndex((o) => o.buttonAction?.startsWith(action));
      if (target < 0) throw new Error(`no visible menu option with action ${action}; have ${opts.map((o) => o.buttonAction).join(", ")}`);
      const cur = opts.findIndex((o) => o.highlighted);
      if (cur === target) {
        if (press) await this.key("Enter");
        return { selected: opts[target].buttonAction, pressed: press, steps };
      }
      const k = cur < 0 || cur > target ? "Up" : "Down";
      await this.key(k);
      steps.push(k);
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`highlight did not reach ${action} after ${steps.length} presses`);
  }

  /** Hold a key for `ms` (hold-to-confirm hints). */
  async hold(name: string, ms: number) {
    return this.key(name, ms);
  }

  /** Window-client position of a widget's centre, from UWidget::GetCachedGeometry (a read-only getter). */
  async widgetCenter(widget: number) {
    const { size, scale, abs } = await this.geometry(widget);
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

  /** Click at window-client coordinates: move the real cursor, button down, hold, button up. */
  async clickAt(x: number, y: number, button = "left", holdMs = 60) {
    const b = MOUSE[button.toLowerCase()];
    if (!b) throw new Error(`unknown mouse button ${button}; use ${Object.keys(MOUSE).join(", ")}`);
    const lp = ((y & 0xffff) << 16) | (x & 0xffff);
    if (this.bridge.game.setCursor) await this.bridge.game.setCursor(x, y); // older DLLs lack it
    if (await this.input([{ type: "mouse", flags: b.inDown, data: b.x }])) {
      await new Promise((r) => setTimeout(r, holdMs));
      await this.input([{ type: "mouse", flags: b.inUp, data: b.x }]);
      return { x, y, button, via: "SendInput" };
    }
    await this.msg(0x200, 0, lp); // WM_MOUSEMOVE
    await new Promise((r) => setTimeout(r, 50));
    await this.msg(b.down, b.mk | (b.x << 16), lp);
    await new Promise((r) => setTimeout(r, holdMs));
    await this.msg(b.up, b.x << 16, lp);
    return { x, y, button, via: "PostMessage" };
  }

  /** Press a mouse button where the cursor is (in game: the crosshair), e.g. right = the user's interact key. */
  async press(button = "left", holdMs = 60) {
    const b = MOUSE[button.toLowerCase()];
    if (!b) throw new Error(`unknown mouse button ${button}; use ${Object.keys(MOUSE).join(", ")}`);
    if (!(await this.input([{ type: "mouse", flags: b.inDown, data: b.x }]))) throw new Error("needs game.sendInput (DLL v0.2.33+)");
    await new Promise((r) => setTimeout(r, holdMs));
    await this.input([{ type: "mouse", flags: b.inUp, data: b.x }]);
    return { button, via: "SendInput" };
  }

  /** Mouse wheel at window-client coordinates; notches > 0 scroll up/away. */
  async wheel(x: number, y: number, notches: number) {
    if (this.bridge.game.setCursor) await this.bridge.game.setCursor(x, y);
    const win = await this.bridge.game.getWindow();
    const left = "error" in win ? 0 : win.left,
      top = "error" in win ? 0 : win.top;
    const lp = (((y + top) & 0xffff) << 16) | ((x + left) & 0xffff); // WM_MOUSEWHEEL takes screen coordinates
    await this.msg(0x20a, ((Math.round(notches * 120) & 0xffff) << 16) >>> 0, lp);
    return { x, y, notches };
  }

  /** Click the visible widget whose name (or path suffix) matches; hints click their mimic button. */
  async click(name: string, mouseButton = "left") {
    const { items } = await this.state();
    const hit =
      items.find((i) => i.name === name || i.path.endsWith(`/${name}`)) ??
      items.find((i) => i.name.toLowerCase().includes(name.toLowerCase()));
    if (!hit) throw new Error(`no visible widget named ${name}`);
    const button = items.find((i) => i.path.startsWith(hit.path + "/") && i.class === "Button") ?? hit;
    const c = await this.widgetCenter(Number(button.addr));
    return { clicked: button.path, geometry: { size: c.size, scale: c.scale, abs: c.abs }, window: c.window, ...(await this.clickAt(c.x, c.y, mouseButton)) };
  }

  private hooked = false;
  private async ensureHook() {
    if (this.hooked) return;
    const hook = await this.bridge.game.installProcessEventHook((await getBuildAddrs(this.bridge)).processEvent);
    if ("error" in hook) throw new Error(`installProcessEventHook: ${hook.error}`);
    this.hooked = true;
  }
}

const MODIFIERS: { vk: number; scan: number; ext?: boolean; alt?: boolean }[] = [
  { vk: 0x12, scan: 0x38, alt: true },
  { vk: 0xa4, scan: 0x38, alt: true },
  { vk: 0xa5, scan: 0x38, ext: true, alt: true },
  { vk: 0x11, scan: 0x1d },
  { vk: 0xa2, scan: 0x1d },
  { vk: 0xa3, scan: 0x1d, ext: true },
  { vk: 0x10, scan: 0x2a },
  { vk: 0xa0, scan: 0x2a },
  { vk: 0xa1, scan: 0x36 },
];
const MODIFIER_VKS = MODIFIERS.map((m) => m.vk);

// Mouse buttons: WM_*BUTTONDOWN/UP, MK_* flag for wParam, XBUTTON number in the high word.
// inDown/inUp: MOUSEEVENTF_* flags for SendInput.
const MOUSE: Record<string, { down: number; up: number; mk: number; x: number; inDown: number; inUp: number }> = {
  left: { down: 0x201, up: 0x202, mk: 0x01, x: 0, inDown: 0x2, inUp: 0x4 },
  right: { down: 0x204, up: 0x205, mk: 0x02, x: 0, inDown: 0x8, inUp: 0x10 },
  middle: { down: 0x207, up: 0x208, mk: 0x10, x: 0, inDown: 0x20, inUp: 0x40 },
  x1: { down: 0x20b, up: 0x20c, mk: 0x20, x: 1, inDown: 0x80, inUp: 0x100 },
  x2: { down: 0x20b, up: 0x20c, mk: 0x40, x: 2, inDown: 0x80, inUp: 0x100 },
};

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
  insert: { vk: 0x2d, scan: 0x52, ext: true },
  home: { vk: 0x24, scan: 0x47, ext: true },
  end: { vk: 0x23, scan: 0x4f, ext: true },
  pageup: { vk: 0x21, scan: 0x49, ext: true },
  pagedown: { vk: 0x22, scan: 0x51, ext: true },
  shift: { vk: 0x10, scan: 0x2a },
  lshift: { vk: 0xa0, scan: 0x2a },
  rshift: { vk: 0xa1, scan: 0x36 },
  ctrl: { vk: 0x11, scan: 0x1d },
  lctrl: { vk: 0xa2, scan: 0x1d },
  rctrl: { vk: 0xa3, scan: 0x1d, ext: true },
  alt: { vk: 0x12, scan: 0x38 },
  lalt: { vk: 0xa4, scan: 0x38 },
  ralt: { vk: 0xa5, scan: 0x38, ext: true },
  capslock: { vk: 0x14, scan: 0x3a },
  pause: { vk: 0x13, scan: 0x45 },
  printscreen: { vk: 0x2c, scan: 0x37, ext: true },
  minus: { vk: 0xbd, scan: 0x0c, char: 0x2d },
  equals: { vk: 0xbb, scan: 0x0d, char: 0x3d },
  lbracket: { vk: 0xdb, scan: 0x1a, char: 0x5b },
  rbracket: { vk: 0xdd, scan: 0x1b, char: 0x5d },
  semicolon: { vk: 0xba, scan: 0x27, char: 0x3b },
  quote: { vk: 0xde, scan: 0x28, char: 0x27 },
  backquote: { vk: 0xc0, scan: 0x29, char: 0x60 },
  tilde: { vk: 0xc0, scan: 0x29, char: 0x60 },
  backslash: { vk: 0xdc, scan: 0x2b, char: 0x5c },
  comma: { vk: 0xbc, scan: 0x33, char: 0x2c },
  period: { vk: 0xbe, scan: 0x34, char: 0x2e },
  slash: { vk: 0xbf, scan: 0x35, char: 0x2f },
};
const NUMPAD_SCAN = [0x52, 0x4f, 0x50, 0x51, 0x4b, 0x4c, 0x4d, 0x47, 0x48, 0x49];
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
  if (/^f(1[3-9]|2[0-4])$/.test(n)) return { vk: 0x6f + Number(n.slice(1)), scan: 0x64 + Number(n.slice(1)) - 13 };
  if (/^num[0-9]$/.test(n)) return { vk: 0x60 + Number(n[3]), scan: NUMPAD_SCAN[Number(n[3])], char: 0x30 + Number(n[3]) };
  // Any other key by Windows virtual-key code: vk:0x41 or vk:65 (scan code from the US layout when known, else 0).
  const m = n.match(/^vk:(0x[0-9a-f]+|\d+)$/);
  if (m) {
    const vk = Number(m[1]);
    if (!(vk > 0 && vk < 0xff)) return null;
    const known = Object.values(NAMED).find((k) => k.vk === vk);
    return known ?? { vk, scan: 0 };
  }
  return null;
}
