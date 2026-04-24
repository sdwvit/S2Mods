# Plan: NodeBridge — in-process DLL + `node.exe` subprocess for Stalker 2

Goal: ship a Windows DLL that loads into the Stalker 2 process, spawns a bundled
portable `node.exe` as a child, and lets per-mod JS run with full Node + npm
access. DLL ↔ Node over a named pipe. No Lua, no UE4SS. DLL source lives in
`src/`. Each publishable mod bundles the DLL + portable Node + its JS payload.

## Locked decisions

- Runtime: official portable Node.js Windows x64, **latest release** at bundle time, pulled from `https://nodejs.org/dist/latest/`.
- Architecture: in-process DLL (proxy slot) + `node.exe` subprocess. IPC over named pipe, wrapped behind a clean C++ API so day-to-day DLL code never touches pipe framing.
- MVP access: **Node runs with full stdlib, but `bridge.game.*` returns `{unresolved: true}`** — engine reflection hooks are deferred to v2. JS mods can still do logging, filesystem, HTTP, etc.
- Not a UE4SS consumer. We considered forking UE4SS or loading it as a dep; UE4SS's own submodule URLs (`Re-UE4SS/UEPseudo`) are dead upstream as of today, so shipping our own proxy is the pragmatic path. We borrow UE4SS's smart bits (loader-lock-safe init via `QueueUserAPC`, Lua-scripted-AOB pattern for v2) without taking the dependency.
- Proxy DLL slot: `dwmapi.dll`. Incompatible with UE4SS (same slot).
- IPC transport: named pipe (`\\.\pipe\NodeBridge-<pid>`).
- Wire protocol: length-prefixed JSON for MVP (swap to msgpack later if perf dictates).
- DLL build: GitHub Actions Windows runner, attached to a GitHub release, pulled locally via helper script.
- Bridge mod name: `NodeBridge`.

## Research notes (see DesignDocs/NodeBridge.md for detail)

- UE4SS's DllMain flow uses `QueueUserAPC` (not `CreateThread`) to escape loader lock. We copied that pattern into our `dllmain.cpp`.
- UE4SS signatures live per-function in `UE4SS_Signatures/*.lua` — each script returns a resolved address. Nice pattern; candidate for v2 when we add our own AOB scanning.
- Stalker 2 is **not** in UE4SS's upstream `CustomGameConfigs/`. Community-maintained signatures live on Nexus mod 560 / PRZ mod; not redistributable from here.
- For Stalker 2 UE4SS users (not us — context only), the stable hook block is in DesignDocs/NodeBridge.md (HookProcessInternal=1, HookProcessLocalScriptFunction=1, everything else off).

---

## 1. Native DLL project (`src/nodebridge/`)

- [ ] Create `src/nodebridge/` as a CMake project, C++20, Windows x64, shared lib.
  - [ ] `CMakeLists.txt` + a Windows preset.
  - [ ] `src/dllmain.cpp` — `DllMain`. On attach: load real proxied DLL, forward exports, spawn worker thread (never block loader lock).
  - [ ] `src/proxy_exports.{h,cpp}` — export-forwarding stubs for the proxied system DLL.
  - [ ] `src/hook_init.{h,cpp}` — MinHook. Hook `FEngineLoop::Init` (or first-tick equivalent) so runtime setup waits until the engine is alive. AOB scanner for Stalker 2's shipping build.
  - [ ] `src/node_host.{h,cpp}` — spawns `NodeBridge\node\node.exe NodeBridge\runtime\bootstrap.mjs --pipe=...` as child process. Captures stdout/stderr to log. Restarts on crash (with backoff + max retries).
  - [ ] `src/ipc_server.{h,cpp}` — named pipe server. Length-prefixed JSON frames. One outstanding request per method call; async callbacks for events pushed DLL→Node.
  - [ ] `src/rpc.{h,cpp}` — **clean API over IPC**. Exposes `rpc::call<T>("method", args)` and `rpc::emit("event", payload)`; pipe framing lives entirely inside this file. Nothing else in the DLL mentions pipes.
  - [ ] `src/bindings.{h,cpp}` — the C++ side of the RPC methods: `log`, `getEngineVersion`, `getPlayerLocation`, `getObjectByName` (read-only lookups). Written against `rpc::` only. Keep the surface tiny for MVP.
  - [ ] `src/mod_loader.{h,cpp}` — enumerates `NodeBridge\mods\*\main.mjs`, passes the list to the Node bootstrap over IPC, each mod loaded in its own Node worker/context.
  - [ ] `src/game_thread_queue.{h,cpp}` — SPSC queue + tick hook. MVP only drains read requests; mutation hook lands in v2.
  - [ ] `src/logging.{h,cpp}` — rolling file log at `NodeBridge\logs\bridge.log`. No console (shipping build has none).

- [ ] Vendor `src/nodebridge/third_party/`:
  - [ ] MinHook (source).
  - [ ] `nlohmann/json.hpp` (single header) for JSON framing.
  - [ ] License notices.

- [ ] `src/nodebridge/.gitignore` for `build/`, `*.exp`, `*.ilk`, `*.pdb`.

## 2. Bundled Node.js runtime (`src/nodebridge/runtime/`)

- [ ] Add `src/pull-node-runtime.mts`: resolves the latest Node.js release via `https://nodejs.org/dist/index.json`, downloads `node-vX.Y.Z-win-x64.zip`, verifies SHASUMS256 against the signed file, extracts into `src/nodebridge/dist/node/` (just `node.exe` + required dlls + npm stdlib).
  - [ ] Writes the resolved version to `src/nodebridge/dist/node/VERSION.txt` for debugging.
  - [ ] Skippable via an env flag to pin a specific version if "latest" breaks something.
- [ ] Author `src/nodebridge/runtime/bootstrap.mjs` — Node-side entry. Connects to the named pipe, registers RPC handlers, `import()`s every mod entry the DLL tells it to, forwards errors back.
- [ ] Author `src/nodebridge/runtime/bridge.mjs` — tiny helper library mods import: `bridge.log()`, `bridge.on(event, cb)`, `bridge.call(method, args)`, `bridge.game.*` (read-only accessors for MVP). Symmetric to the C++ `rpc::` layer.
- [ ] Optional: publish `@s2mods/nodebridge-api` types eventually so mod authors get TS completion.

## 3. DLL build pipeline (GitHub Actions)

- [ ] Add `.github/workflows/build-nodebridge.yml`:
  - [ ] Triggers: `workflow_dispatch` + on tag `nodebridge-v*`.
  - [ ] Windows runner, VS 2022, Windows SDK.
  - [ ] Steps: `cmake --preset windows-release`, `cmake --build build --config Release`.
  - [ ] Artifacts: `dwmapi.dll`, `dwmapi.pdb`.
  - [ ] On tag: create a GitHub release with those binaries attached.
- [ ] Add `src/pull-nodebridge.mts`: fetches the pinned release from GitHub, unpacks into `src/nodebridge/dist/`. Checksum-pinned. This is how dev machines (incl. this Linux box) get the DLL without running MSVC locally.
- [ ] Add `npm run build-nodebridge` that just composes `pull-nodebridge` + `pull-node-runtime` into a ready-to-ship `src/nodebridge/dist/` tree.
- [ ] Keep `src/nodebridge/dist/` git-ignored. The artifacts live in GitHub releases, not in the repo.

## 4. Mod-side layout

- [ ] Convention: `Mods/<ModName>/nodebridge/`
  - [ ] `main.mjs` — required entry point.
  - [ ] Optional `package.json` + `node_modules/` for npm deps (bundled into zip).
  - [ ] Deps run under the bundled `node.exe`; assume Node 22 LTS stdlib.
- [ ] Rename `Mods/LuaNodeBridge/` → `Mods/NodeBridge/`. Update `package.json`, `meta.mts`, and any imports.
- [ ] Write a smoke-test `Mods/NodeBridge/nodebridge/main.mjs` that calls `bridge.log('hello from node')` and polls `bridge.game.getPlayerLocation()` once a second. Confirms RO read path works.

## 5. `src/` lifecycle integration

- [ ] Add `src/inject-nodebridge.mts` (parallels `src/inject-ue4ss.mts`):
  - [ ] Skip if `<mod>/nodebridge/main.mjs` missing.
  - [ ] Copy `src/nodebridge/dist/dwmapi.dll` → `<game>/Stalker2/Binaries/Win64/dwmapi.dll` (hash-skip).
  - [ ] Copy `src/nodebridge/dist/node/**` → `<game>/Stalker2/Binaries/Win64/NodeBridge/node/` (hash-skip; `node.exe` changes rarely).
  - [ ] Copy `src/nodebridge/dist/runtime/**` → `<game>/Stalker2/Binaries/Win64/NodeBridge/runtime/`.
  - [ ] Copy `<mod>/nodebridge/**` → `<game>/Stalker2/Binaries/Win64/NodeBridge/mods/<modName>/`.
  - [ ] Maintain `<game>/...Win64/NodeBridge/enabled.json` with the list of installed mods.
- [ ] Extend `src/prepare-configs.mts`: after struct transformers, detect `<mod>/nodebridge/` and chain into `inject-nodebridge` for dev workflow (opt-in flag to avoid copying the full runtime on every run — something like `S2_NB_SKIP=1`).
- [ ] Add `inject-nodebridge` script to each mod's `package.json` template in `src/mod-meta-paths.mts` (stub writer).
- [ ] `MetaType` in `src/meta-type.mts`: optional `nodebridge?: { entry?: string; skipBundle?: boolean }`. Don't block MVP on this — add only if needed.

## 6. Publish / zip integration

- [ ] Extend `src/publish/zip.mts` so every mod zip contains:
  - [ ] The pak (if any cfg changes).
  - [ ] `Stalker2/Binaries/Win64/dwmapi.dll` (from `src/nodebridge/dist/`).
  - [ ] `Stalker2/Binaries/Win64/NodeBridge/node/**` (portable Node).
  - [ ] `Stalker2/Binaries/Win64/NodeBridge/runtime/**` (bootstrap + bridge API).
  - [ ] `Stalker2/Binaries/Win64/NodeBridge/mods/<ModName>/**`.
- [ ] Size impact: portable Node is ~30–40 MB extracted. Every NodeBridge mod zip gets that. Acceptable? If not: publish `NodeBridge` itself as the carrier mod, other mods depend on it and ship only `mods/<ModName>/`. (MVP: ship everything, revisit.)
- [ ] Verify publish platforms handle non-pak payloads:
  - [ ] Steam Workshop — does Stalker 2's Steam Workshop installer extract arbitrary files to game dirs? If it's pak-only, the DLL + Node runtime have to go via a manual installer / separate mod.io listing.
  - [ ] mod.io — test with a throwaway upload.
  - [ ] Xbox — almost certainly pak-only; NodeBridge mods are PC-only by nature. Add a skip guard to `zip-for-xbox.mts`.
- [ ] Version gate: constant in `src/nodebridge/dist/version.txt`. Publish refuses if mod references an API level newer than the bundled DLL.

## 7. Smoke-test loop

- [ ] Build DLL + bundle runtime on the Windows box, commit `src/nodebridge/dist/`.
- [ ] `cd Mods/NodeBridge && npm run inject-nodebridge`.
- [ ] Launch Stalker 2, confirm:
  - [ ] `NodeBridge\logs\bridge.log` has "attached", "engine init hooked", "node spawned", "pipe connected".
  - [ ] Smoke-test mod prints player location every second.
- [ ] Force a JS throw in `main.mjs`; bridge log should capture stack, game should keep running.
- [ ] Kill `node.exe` externally; DLL should respawn and reconnect.
- [ ] Crash Stalker 2 mid-run; next launch boots clean (no locked files).

## 8. Status (2026-04-24)

**Shipped:**
- [x] Proxy DLL builds in CI, attached to GitHub releases on tag.
- [x] `nodebridge-v0.1.2` is the current release — loop-accept IPC fix.
- [x] Portable Node puller, pre-inject hash-skipped copy, `inject-nodebridge --watch`.
- [x] Folder-presence = enabled (no `enabled.json`).
- [x] End-to-end verified in-game on Proton. See `DesignDocs/NodeBridge.md` for the `WINEDLLOVERRIDES` requirement.
- [x] **Hot reload**: edit `Mods/<mod>/nodebridge/main.mjs`, watcher syncs to game dir, bootstrap exits, DLL supervisor respawns `node.exe`. ~300 ms feedback loop.
- [x] S2 AOB catalog (UE version, GUObjectArray signature, hook/settings block) captured in `DesignDocs/NodeBridge.md`.

## 9. Near-term roadmap

Ordered by effort/value. Pick any.

### DX wins (~30 min each)

- [ ] **TypeScript mod authoring.** Node 25 strips types natively. Have `bootstrap.mjs` accept `main.ts` alongside `main.mjs`; ship a `bridge.d.ts` from the runtime so IDEs give completion. No bundler, no toolchain.
- [ ] **Stderr surfacing.** `node.exe` stderr is currently lost (`INVALID_HANDLE_VALUE` in `node_host.cpp`). Pipe it back, log it in `bridge.log` so JS crashes are visible without a custom handler.
- [ ] **Reload trigger via log line.** `inject-nodebridge:watch` prints "reload pending" immediately on edit; right now the only feedback is the downstream bridge.log line.

### Non-reflection bindings (~half day)

`bridge.game.*` is stubbed on engine reflection, but Node can already do useful things from the subprocess:

- [ ] `bridge.log.tailGame()` — read Stalker 2's own log at `Saved/Logs/Stalker2.log`, stream new lines to a JS callback.
- [ ] `bridge.saves.on(event, cb)` — watch `Saved/SaveGames/`, emit `save`/`delete` events.
- [ ] `bridge.cfg.read(path)` — load a `.cfg` out of the raw pak dirs or SDK path, parsed via `s2cfgtojson`.

### Engine reflection — v2 (~multi-session)

- [ ] MinHook-based AOB pattern scanner in the DLL.
- [ ] Port GUObjectArray AOB from the S2 UE4SS build (see `DesignDocs/NodeBridge.md`), resolve the struct pointer.
- [ ] Expose `bridge.game.listObjects({ filter })` and `bridge.game.getObjectByName(name)` via game-thread queue.
- [ ] Once UObject enumeration works: `bridge.game.callFunction` (UFunction invocation via `UObject::ProcessEvent`).
- [ ] Ship `nodebridge-v0.2.0` when the above works end-to-end.

### Bigger bets (later)

- [ ] Publish pipeline for `NodeBridge` and dependent mods to Steam Workshop / mod.io. Decide carrier-mod vs bundled-per-mod tradeoff.
- [ ] ImGui overlay for in-game dev console.
- [ ] Automated test harness: run inject against a sandbox game folder, spin up a fake pipe, verify handshake.
- [ ] Support multiple mods running concurrently without interfering (already loads them all; need real use-case testing).
