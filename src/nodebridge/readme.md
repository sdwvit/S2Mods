# NodeBridge (native DLL)

Windows proxy DLL that loads into the Stalker 2 process (takes the `dwmapi.dll` slot), spawns a bundled `node.exe` as a child, and routes RPC between the game and per-mod JS entry points over a named pipe.

This directory holds the native side. The JS runtime bundle, mod scaffolding, and install scripts live in the wider repo (`src/pull-node-runtime.mts`, `src/inject-nodebridge.mts`, `Mods/NodeBridge/`).

## Layout

- `CMakeLists.txt`, `CMakePresets.json` — MSVC / VS 2022 x64 release build.
- `src/` — DLL source (C++20).
  - `dllmain.cpp` — entry point, boots the runtime on a worker thread.
  - `paths.{h,cpp}` — resolves install-relative paths (`NodeBridge/...`).
  - `logging.{h,cpp}` — rolling file logger at `NodeBridge/logs/bridge.log`.
  - `ipc_server.{h,cpp}` — named pipe server, length-prefixed byte framing.
  - `rpc.{h,cpp}` — clean `call / emit / handle / on` API over IPC.
  - `bindings.{h,cpp}` — MVP read-only game methods.
  - `node_host.{h,cpp}` — child `node.exe` supervisor.
  - `mod_loader.{h,cpp}` — enumerates installed mods, writes `enabled.json`.
  - `hook_init.{h,cpp}` — MinHook setup; UE engine/tick hooks (stubbed).
  - `game_thread_queue.{h,cpp}` — marshals work onto the UE game thread.
  - `dwmapi_exports.cpp` — `#pragma comment(linker, "/EXPORT:X=dwmapi_orig.X")` for all 31 dwmapi functions. DllMain copies `%SystemRoot%\System32\dwmapi.dll` → `dwmapi_orig.dll` next to us on first load so the forwarders resolve.

## Build

Local Windows build:

```
cmake --preset windows-release
cmake --build --preset windows-release
```

CI: `.github/workflows/build-nodebridge.yml` produces `dwmapi.dll` + `.pdb`
as release artifacts. `src/pull-nodebridge.mts` fetches them into `dist/`.

## Not yet implemented

- Real engine init / tick hooks (AOBs for Stalker 2 shipping build).
- UE5 reflection (UObject / UFunction access) — needed for the v2 mutation API.
- Any game binding that isn't "return placeholder" today.
