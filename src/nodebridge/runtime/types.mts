/**
 * NodeBridge runtime API.
 *
 * A `bridge` instance is handed to every mod's `default` or `init` export.
 * Every method returns a Promise that resolves once the DLL has responded
 * over IPC. Stubbed methods resolve to `{ unresolved: true, reason }` until
 * the underlying engine-reflection capability lands.
 */

export interface EngineVersion {
  major: number;
  minor: number;
  patch: number;
  custom: string;
}

export interface Unresolved {
  unresolved: true;
  reason: string;
}

export interface ObjectRef {
  /** Stable handle within a single game launch; UObject->InternalIndex. */
  index: number;
  /** UE bit flags on the FUObjectItem slot. */
  flags: number;
  /** FName-decoded name of the object itself. */
  name: string;
  /** FName-decoded name of obj->ClassPrivate (the UClass's own name). */
  className: string;
  /** "Outer.Outer.Name" path, walking OuterPrivate up to depth 8. */
  fullPath: string;
}

export interface ListObjectsResult {
  total: number;
  returned: number;
  offset: number;
  items: ObjectRef[];
}

export interface ListObjectsOptions {
  offset?: number;
  limit?: number;
  /** Substring match against name or className. */
  filter?: string;
  /** Exact className equality. */
  className?: string;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface BridgeLog {
  (...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface GameApi {
  /** True once AOB-based reflection has resolved GUObjectArray. */
  isReady(): Promise<{ ready: boolean }>;
  getEngineVersion(): Promise<EngineVersion>;

  // --- Read ---
  getObjectCount(): Promise<{ count: number } | Unresolved>;
  listObjects(opts?: ListObjectsOptions): Promise<ListObjectsResult | Unresolved>;
  getObjectByIndex(index: number): Promise<ObjectRef | { found: false; index: number } | Unresolved>;
  getObjectByName(name: string): Promise<ObjectRef | { found: false; name: string } | Unresolved>;
  getPlayerPawn(): Promise<{ found: true; index: number; name: string; className: string; fullPath: string } | { found: false; reason: string } | Unresolved>;
  getPlayerLocation(): Promise<Vector3 & { rootOffset: number; locOffset: number } | Unresolved>;
  setPlayerLocation(value: Vector3): Promise<{ ok: boolean; reason?: string; rootOffset: number; locOffset: number; x: number; y: number; z: number } | Unresolved>;
  getProperty(target: number | string, prop: string): Promise<{ ok: true; offset: number } | { ok: false; reason: string } | Unresolved>;
  listProperties(target: number, max?: number): Promise<{ target: number; count: number; properties: Array<{ name: string; offset: number; class: string }> } | { found: false; target: number } | Unresolved>;
  dumpClassMemory(target: number, offset: number, count?: number): Promise<{ target: number; offset: number; count: number; classPtr: number; hex: string } | { fault: true; target: number; offset: number } | { found: false; reason?: string } | Unresolved>;
  /** Read raw bytes at obj+offset (instance memory, not class memory). */
  dumpObjectMemory(target: number, offset: number, count?: number): Promise<{ target: number; offset: number; count: number; objPtr: number; hex: string } | { fault: true; target: number; offset: number } | { found: false } | Unresolved>;
  /** Read N bytes from any address. count capped at 4096. */
  readMemory(addr: number, count?: number): Promise<{ addr: number; count: number; hex: string } | { addr: number; fault: true } | { error: string } | Unresolved>;
  /** Write hex bytes to any address (whitespace-separated or packed). Capped at 4096 bytes. */
  writeMemory(addr: number, hex: string): Promise<{ addr: number; count: number } | { addr: number; fault: true } | { error: string } | Unresolved>;
  /** Allocate `size` bytes of process-private memory (MEM_COMMIT|MEM_RESERVE).
   *  `protect` is a Windows PAGE_* constant; defaults to PAGE_READWRITE (0x04).
   *  Common values: 0x04 RW, 0x40 RWX, 0x20 RX, 0x02 R.
   *  Returned `addr` is directly usable as a pointer from any other primitive. */
  virtualAlloc(size: number, opts?: { protect?: number }): Promise<{ addr: number; size: number; protect: number } | { error: string; lastError?: number }>;
  /** Release memory previously returned by virtualAlloc. */
  virtualFree(addr: number): Promise<{ ok: true; addr: number } | { ok: false; lastError: number } | { error: string }>;
  /** Change page protection on a previously allocated region. */
  virtualProtect(addr: number, size: number, protect: number): Promise<{ ok: true; addr: number; size: number; protect: number; oldProtect: number } | { ok: false; lastError: number } | { error: string }>;
  /** AOB scan over the main exe. Returns hit address or 0. */
  scanAOB(pattern: string): Promise<{ pattern: string; hit: number } | { error: string }>;
  /** Image base of Stalker2-Win64-Shipping.exe — useful for relative-offset math. */
  mainExeBase(): Promise<{ base: number }>;
  /** Decode an FName (comparison_index, number) to a UTF-8 string via FName::ToString. */
  fnameToString(comp: number, num?: number): Promise<{ comp: number; num: number; name: string } | Unresolved>;
  /** Register a UTF-8 string in the FName pool via FName::FName(wchar_t*, FNAME_Add).
   *  AOB-resolves the constructor on first call. */
  fnameFromString(str: string): Promise<{ comp: number; num: number } | { error: string } | Unresolved>;
  /** Bypass AOB: install FName::FName at a caller-supplied address (e.g. mainExeBase + RVA).
   *  Call before fnameFromString when AOB scan misses. */
  installFnameCtorAddr(addr: number): Promise<{ ok: true; addr: number } | { error: string }>;
  /** Invoke UObject::ProcessEvent on `target` for UFunction at `func`. paramsHex
   *  is the raw bytes of the function's parameter struct (caller knows the
   *  layout). On success the returned paramsHex contains the buffer
   *  post-call so out-by-ref and return-value slots are readable.
   *  vtableIdx defaults to 67 (UE 5.1 typical); override if a build differs. */
  processEvent(
    target: number,
    func: number,
    paramsHex?: string,
    opts?: { fnAddr?: number; vtableIdx?: number },
  ): Promise<{ ok: true; paramsHex: string; fnAddr: number } | { ok: false; reason: string }>;

  // --- Write (v3, setProperty/callFunction stubbed today) ---
  setProperty(target: number | string, prop: string, value: unknown): Promise<boolean | Unresolved>;
  callFunction(target: number | string, func: string, args?: unknown[]): Promise<unknown | Unresolved>;
}

export interface Bridge {
  /** The mod's folder name, e.g. "NodeBridge". */
  readonly modName: string;
  /** Prefix string "[ModName]" suitable for console output. */
  readonly prefix: string;
  log: BridgeLog;
  /** Raw RPC escape hatch — prefer typed `game` methods. */
  call<T = unknown>(method: string, args?: unknown): Promise<T>;
  /** Subscribe to an event namespaced to this mod. */
  on(event: string, cb: (payload: unknown) => void): void;
  game: GameApi;
}

export type ModInit = (bridge: Bridge) => void | Promise<void>;
