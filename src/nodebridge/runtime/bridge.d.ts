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
