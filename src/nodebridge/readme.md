# NodeBridge (native DLL)

Windows proxy DLL that loads into the Stalker 2 process (takes the
`dwmapi.dll` slot), spawns a bundled `node.exe` as a child, and routes
RPC between the game and per-mod JS entry points over a named pipe.

This directory holds the native side. The JS runtime, mod scaffolding,
and install scripts live elsewhere in the repo:
- `src/pull-node-runtime.mts` — fetches portable Node for shipping
- `src/pull-nodebridge.mts` — downloads tagged release DLL
- `src/inject-nodebridge.mts` — hash-skipped copy into the live game folder
- `Mods/NodeBridge/` — the smoke-test mod

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

## Layout

- `CMakeLists.txt`, `CMakePresets.json` — MSVC / VS 2022 x64 release.
  FetchContents minhook v1.3.4 + nlohmann/json v3.11.3.
- `src/` — DLL source (C++20).
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

## Architectural principle: DLL = primitives, logic = JS

When you reach for a new C++ binding, stop and ask whether
`readMemory` + a JS helper covers it. The DLL CI loop is
expensive — tag a release, wait on Windows GHA, pull, inject, restart
the game — so every primitive added to `bindings.cpp` should be the
*minimum* thunk over an engine call (one syscall, one decode, one
read/write). Walkers, listers, finders, schedulers belong in mods.

This is why `find_property_offset` and `list_properties` are deprecated
in `uproperty.cpp` — both are reimplementable in TypeScript using
`dumpObjectMemory` (read class_ptr) + `readMemory` (walk
PropertyLink) + `fnameToString` (decode each FField name). See
`Mods/NodeBridge/nodebridge/main.mts` for the JS-side walker.

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

## Why no UE4SS dependency

We tried. UE4SS at both `main` and tag `v3.0.1` declares submodules with
SSH URLs `git@github.com:Re-UE4SS/UEPseudo.git` and
`git@github.com:trumank/patternsleuth.git`. `Re-UE4SS/UEPseudo`
returns 404 — the org appears renamed or moved — so UE4SS can't be
built from source. The DEV release zip ships only runtime binaries +
docs, no headers, no import lib, so a CppMod can't link against it
without forking UEPseudo or stubbing `CppUserModBase` against an
extracted ABI.

Either workaround is ongoing maintenance burden. For our use — JS
mods, no engine reflection requirement at MVP — we ship our own proxy
DLL and borrow UE4SS's *patterns* (loader-lock-safe DllMain,
per-symbol AOB scripts as data not code, `SecondsToScanBeforeGivingUp`
+ `NumScanThreads` knobs) without taking the dep.

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

- **GSC UStruct layout drift**: `uproperty.{h,cpp}` assumes stock UE 5.1
  field offsets (`PropertyLink` at +0x60, `FField.NamePrivate` at
  +0x28). Stalker 2's GSC fork shifts some of these. The live
  resolution is moving to a JS-side probe that sweeps candidate
  offsets and scores against expected pawn-class names — see the
  smoke test mod's `probeUStructLayout`. Once stable, the C++ walker
  will be deleted.
- `getProperty / setProperty / callFunction` C++ stubs depend on the
  same broken walker. Replace via JS once the offsets are pinned.

## Open items

- Steam Workshop / mod.io support for non-pak files. NodeBridge mods
  need a separate install path; confirm with a throwaway upload
  before shipping to end users.
- A `writeMemory` primitive (symmetric with `readMemory`) so the JS
  walker can drive teleports without a C++ helper.
- Signature framework — `bindings.cpp` has the GUObjectArray + FName
  AOBs hard-coded. Move to a JSON-per-symbol file once we add a
  second hook target.
