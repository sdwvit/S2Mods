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
  /** Class path; empty until FName resolution lands (v2.1). */
  className?: string;
  /** Full path name (Package.Outer.Name); empty until FName resolution. */
  fullPath?: string;
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
  listObjects(opts?: { limit?: number; offset?: number; filter?: string }): Promise<ObjectRef[] | Unresolved>;
  getObjectByIndex(index: number): Promise<ObjectRef | Unresolved>;
  getObjectByName(name: string): Promise<ObjectRef | Unresolved>;
  getPlayerPawn(): Promise<ObjectRef | Unresolved>;
  getPlayerLocation(): Promise<Vector3 | Unresolved>;
  getProperty(target: number | string, prop: string): Promise<unknown | Unresolved>;

  // --- Write (v3, all stubbed today) ---
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
