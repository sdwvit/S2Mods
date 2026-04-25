/**
 * NodeBridge runtime API.
 *
 * A `bridge` instance is handed to every mod's `default` or `init` export.
 * Every method returns a Promise that resolves once the DLL has responded
 * over IPC. Stubbed methods resolve to `{ unresolved: true, reason }` until
 * the underlying engine-reflection capability lands.
 */
export {};
