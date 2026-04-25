# NodeBridge (native DLL)

Windows proxy DLL that loads into the Stalker 2 process (takes the
`dwmapi.dll` slot), spawns a bundled `node.exe` as a child, and routes
RPC between the game and per-mod JS entry points over a named pipe.

This directory holds the native DLL plus the Node-side runtime that
mods import from. Other entry points live in the wider repo:
- `src/pull-node-runtime.mts` — fetches portable Node for shipping
- `src/pull-nodebridge.mts` — downloads tagged release DLL
- `src/inject-nodebridge.mts` — hash-skipped copy into the live game folder
- `Mods/NodeBridge/` — the smoke-test mod (one-shot teleport)

### Layout in this directory

- `src/` — C++ DLL source.
- `runtime/` — JS files shipped into `<game>/.../Win64/NodeBridge/runtime/`:
  - `bootstrap.mjs` — supervisor entry. Discovers and loads mods,
    sets up fs.watch on `mods/<each>` + `runtime/` for hot reload.
  - `bridge.mjs` + `bridge.d.ts` — the `bridge` value passed to mod
    `init`: log, RPC call/emit/handle, `bridge.game.*` API.
  - `rpc.mjs` — length-prefixed JSON RPC over the named pipe.
  - **`s2lib.mts`** — Stalker 2 specifics for mods: GSC offsets,
    FProperty walker, FName decoder, vector helpers, `s2.readU32/F32/…`
    accessors, `getPlayerSession` / `teleportPlayer`. Mods import
    from `../../runtime/s2lib.mts`.
- `dist/` — built DLL artifacts pulled by `npm run pull-nodebridge`.

## Architecture

```
Stalker2-Win64-Shipping.exe
  └─ loads  dwmapi.dll  (this proxy)
       │
       │ DllMain → CreateThread(bootstrap)
       │                      │
       │                      └─ spawns node.exe (child process)
       │                            │
       │ named pipe ←─ IPC ─→       │  runs runtime/bootstrap.mjs
       │                            │  loads Mods/*/main.{ts,mts,...}
       │                            │  exposes bridge.log + bridge.game.*
       │
       └─ forwards every Dwm* export to C:\Windows\System32\dwmapi.*
          (#pragma comment linker /EXPORT:X=dwmapi_orig.X)
```

DllMain copies `%SystemRoot%\System32\dwmapi.dll` → `dwmapi_orig.dll`
next to itself on first load so the `/EXPORT:X=dwmapi_orig.X` forwarders
resolve. This is friendlier than `.def`-based forwarding (which MSVC
doesn't support DLL-to-DLL).

On Proton, ship-or-die requirement: `WINEDLLOVERRIDES="dwmapi=n,b"
%command%`. Without it the system DLL wins and we never load.

## DLL source layout (`src/`)

- `CMakeLists.txt`, `CMakePresets.json` — MSVC / VS 2022 x64 release.
  FetchContents minhook v1.3.4 + nlohmann/json v3.11.3.
- C++20 sources:
  - `dllmain.cpp` — `DLL_PROCESS_ATTACH` → log banner, copy
    `dwmapi_orig`, `CreateThread` bootstrap. We tried `QueueUserAPC`
    (per UE4SS) but the UE main thread doesn't reliably hit alertable
    waits, so APC delivery was flaky.
  - `dwmapi_exports.cpp` — 31 `#pragma /EXPORT:X=dwmapi_orig.X` lines.
  - `paths.{h,cpp}` — DLL-relative path resolution.
  - `logging.{h,cpp}` — file logger at `NodeBridge/logs/bridge.log`;
    banner between sessions for grep-friendly boundaries.
  - `ipc_server.{h,cpp}` — named-pipe server, length-prefixed framing,
    re-accept on client disconnect (so JS hot-reload works).
  - `rpc.{h,cpp}` — `Router::handle / call / emit / on`.
  - `bindings.{h,cpp}` — every `game.*` RPC handler (read this first
    when adding new functionality, but read the *primitives principle*
    below first).
  - `node_host.{h,cpp}` — child `node.exe` spawn + supervise.
  - `mod_loader.{h,cpp}` — enumerates `Win64/NodeBridge/mods/*/main.*`.
  - `hook_init.{h,cpp}` — MinHook init + `nb::ue::initialize()`. Engine
    tick hooks still stubbed.
  - `game_thread_queue.{h,cpp}` — SPSC queue for game-thread marshaling
    (unused so far).
  - `aob_scanner.{h,cpp}` — IDA-style pattern parser + executable
    section scanner.
  - `ue_reflection.{h,cpp}` — GUObjectArray resolution, `FUObjectItem`
    walk, `find_player_pawn`.
  - `fname.{h,cpp}` — FName::ToString AOB candidates + SEH-guarded call
    wrapper. Verifies a candidate against `obj[0].name_private` before
    accepting, after FNamePool is populated.
  - `uproperty.{h,cpp}` — UStruct/FProperty walker. See *known issues*.

## RPC surface

Categories of `bridge.game.*` exposed today:

- **Engine bootstrap**: `isReady`, `getEngineVersion`, `getObjectCount`,
  `listObjects`, `getObjectByIndex`, `getObjectByName`,
  `getPlayerPawn`, `getPlayerLocation`, `setPlayerLocation`.
- **Memory primitives**: `readMemory`, `dumpObjectMemory`,
  `dumpClassMemory`. Each is one engine call wrapped in SEH so a stale
  pointer logs `fault reading…` rather than crashing the game.
- **Address tooling**: `scanAOB`, `mainExeBase`.
- **Decoders**: `fnameToString` (FName{comp,num} → UTF-8).

Stubs (return `{unresolved: true}`):
- `getProperty`, `setProperty`, `callFunction` — these were going to
  use the C++ FProperty walker; superseded by JS-side walking via
  primitives.

## Architectural principle: DLL = primitives, lib = JS

Three concentric layers; never put logic in the inner one if it can
live in the outer:

1. **DLL** (`src/*.cpp`). Minimum thunks over engine calls. One
   syscall, one decode, one read/write per binding. Adding a new
   binding here costs a tag → CI → pull → inject → game restart cycle,
   so the bar is high. Today: memory primitives, AOB, FName decoder,
   GUObjectArray walk, player-pawn discovery.
2. **Runtime lib** (`runtime/s2lib.mts`). Stable JS helpers built on
   the primitives. GSC layout offsets, FProperty walker, vector
   helpers, player-session helpers, teleport. Hot-reloadable — edit
   and the supervisor respawns node.exe in ~1s. Anything that's
   "Stalker 2-specific but not mod-specific" lives here.
3. **Mods** (`Mods/<name>/nodebridge/main.mts`). Just the recipe —
   what to do with the helpers. Should be tiny.

Why `find_property_offset` / `list_properties` are deprecated in
`uproperty.cpp`: both reimplemented in `s2lib.mts` using
`dumpObjectMemory` (read class_ptr) + `readMemory` (walk
PropertyLink) + `fnameToString` (decode FField name). Iterating the
walker without a DLL rebuild has paid for itself many times over.

## Stalker 2 specifics

**Engine**: UE 5.1, GSC custom fork. Confirmed via a working community
UE4SS build's `[EngineVersionOverride] MajorVersion=5, MinorVersion=1`.

**Confirmed values**:

| Thing | Value | Source |
| --- | --- | --- |
| Steam app ID | `1643320` | `src/launch-stalker2.mts` |
| Game world UObject | `WorldMap_WP` (className `World`) | live log |
| Player pawn class | substring `Stalker2Character` matches `BP_Stalker2Character_C` | live log |
| GUObjectArray AOB | `48 8D 0D ? ? ? ? E8 ? ? ? ? E8 ? ? ? ? E8 ? ? ? ? C6 05 ? ? ? ? 01` | community UE4SS |
| GUObjectArray post-process | `result = (match+7) + DerefToInt32(match+3) - 0x10` | same |
| FName::ToString AOB | `48 8B 48 ?? 48 89 4C 24 ?? 48 8D 4C 24 ?? E8` (callsite, E8 at +14) | patternsleuth |

The community UE4SS build for Stalker 2 also documents this hook +
setting block, useful as cross-reference when porting other features:

```ini
[General]
bUseUObjectArrayCache = false   ; else startup crash
SecondsToScanBeforeGivingUp = 30

[EngineVersionOverride]
MajorVersion = 5
MinorVersion = 1

[Hooks]
HookProcessInternal = 1
HookProcessLocalScriptFunction = 1
HookInitGameState = 1
HookLoadMap = 1
HookCallFunctionByNameWithArguments = 1
HookBeginPlay = 1
HookEndPlay = 1
HookLocalPlayerExec = 1
HookAActorTick = 1
HookEngineTick = 1
HookGameViewportClientTick = 1
HookUObjectProcessEvent = 1
HookProcessConsoleExec = 1
HookUStructLink = 1
FExecVTableOffsetInLocalPlayer = 0x28
```

If the GUObjectArray AOB ever drifts on a game patch, UE4SS issue #1198
posts UE-5.7.x AOBs from Bladesong as a similar-engine fallback:
- `GUObjectArray`: `48 8B 05 ?? ?? ?? ?? 48 8B 0C C1 48 8D 04 D1`
- `FName_Constructor`: `48 8B 05 ?? ?? ?? ?? 41 8B 07 F0 0F C1 47 04`
- `FText_Constructor`: `48 8B ?? 48 85 ?? 0F 84 ?? ?? ?? ?? E8 ?? ?? ?? ?? 48 8B ?? 48 89 ??`

## Build

Local Windows build:

```sh
cmake --preset windows-release
cmake --build --preset windows-release
```

CI: `.github/workflows/build-nodebridge.yml` builds on `windows-latest`
and attaches `dwmapi.dll` + `.pdb` as release artifacts when a
`nodebridge-v*` tag is pushed. `src/pull-nodebridge.mts` fetches the
latest release into `dist/`.

Cut a release:

```sh
git tag nodebridge-vX.Y.Z && git push origin nodebridge-vX.Y.Z
gh run watch "$(gh run list --workflow=build-nodebridge.yml --limit 1 --json databaseId -q '.[0].databaseId')"
```

## Hardened paths

- All game-memory reads go through SEH-guarded primitives
  (`nb_try_dump`, `nb_try_read_ptr_u`, `nb_try_read_fname_u`,
  `nb_try_read_i32_u`, `nb_try_memcpy`). A wrong offset or stale
  pointer logs `fault reading…` and returns empty/zero — game keeps
  running.
- Pipe server re-accepts after client disconnect, so JS hot-reload
  works (supervisor respawns `node.exe`, C++ accepts the new client).
- DllMain uses `CreateThread` (UE main thread doesn't reliably hit
  alertable waits — `QueueUserAPC` was unreliable here).
- FName::ToString candidates are verified against
  `obj[0].name_private` *after* FNamePool is populated, not at attach
  time. Untrusted candidates are scanned but never invoked.

## Known issues

- `find_property_offset / list_properties / getProperty / setProperty
  / callFunction / getPlayerLocation / setPlayerLocation` in C++ are
  superseded by the JS lib. Kept in tree for now; safe to delete
  whenever someone wants to do the cleanup pass.

## Distribution

**Steam Workshop and mod.io DO NOT work for NodeBridge mods.**
Confirmed by a throwaway upload — the official channels only ingest
`.pak` content, but NodeBridge needs a DLL at
`Stalker2/Binaries/Win64/dwmapi.dll` plus a Node runtime tree at
`Win64/NodeBridge/`. Neither installer puts files there.

End-user distribution will need a separate install path (zipped
release with an installer that copies into `Win64/`, or a similar
out-of-band route). Don't ship NodeBridge mods through Workshop /
mod.io expecting them to load.

## Open items

- A `writeMemory` primitive landed already; the lib uses it.
- Signature framework — `bindings.cpp` has the GUObjectArray + FName
  AOBs hard-coded. Move to a JSON-per-symbol file once we add a
  second hook target.
- End-user installer for the out-of-Workshop ship path.
