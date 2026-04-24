# NodeBridge design + research notes

Companion doc to `plan.md`. Capture of upstream research done before committing,
so it survives the conversation that produced it.

## Architecture

```
Stalker2-Win64-Shipping.exe
  └─ loads  dwmapi.dll  (our proxy)             ← src/nodebridge/ builds this
       │
       │ DllMain → QueueUserAPC(bootstrap)
       │                      │
       │                      └─ spawns node.exe (child process)
       │                            │
       │ named pipe ←─ IPC ─→       │  runs runtime/bootstrap.mjs
       │                            │  loads Mods/*/main.mjs
       │                            │  exposes `bridge.log`, `bridge.game.*`
       │
       └─ forwards every Dwm* export to C:\Windows\System32\dwmapi.*
          (dwmapi.def)
```

All bridge.game.* calls are RPC-routed into the DLL's C++ bindings. For MVP
those bindings return `{unresolved: true}` — the engine-reflection path hasn't
been written yet. Everything else (log, fs, HTTP, npm) works because it
executes inside real `node.exe`.

## What we borrowed from UE4SS without depending on it

Researched `UE4SS-RE/RE-UE4SS` main branch before committing. Notes:

### Loader-lock-safe DllMain
UE4SS's `main_ue4ss_rewritten.cpp` uses `QueueUserAPC` from `DLL_PROCESS_ATTACH`
instead of `CreateThread`. That's important: creating a thread from inside the
loader lock is technically undefined and can deadlock against DLLs that haven't
finished initializing. The APC runs the first time the thread next enters an
alertable wait, which for a game main thread is quickly after startup.

Applied to `src/nodebridge/src/dllmain.cpp` — we use the same pattern.

### Per-function signature scripts
UE4SS ships `assets/UE4SS_Signatures/*.lua` — one file per hooked symbol
(`GUObjectArray`, `FName_ToString`, `FName_Constructor`, `GMalloc`,
`StaticConstructObject`, `ProcessLocalScriptFunction`, `GameEngineTick`).
Each script returns a resolved address, doing its own AOB scan and pointer
arithmetic in Lua. Config, not code.

For v2 (mutation API) we'll want the same shape. Options:
- Embed a tiny JS AOB scanner inside bootstrap.mjs, have it call back into the
  DLL to do memory reads — keeps "scripts" in JS.
- Or ship plain JSON signature files next to the DLL.

Either way the C++ side stays dumb; the signature logic is data.

### Scan timeout + thread pool
`Unreal::UnrealInitializer::Initialize(config)` takes `SecondsToScanBeforeGivingUp`
and `NumScanThreads`. When we add AOB scanning, copy both knobs.

## Why we didn't take UE4SS as a dep

Tried. Here's what broke:
1. UE4SS at `main` and at tag `v3.0.1` both declare submodules with SSH URLs:
   `git@github.com:Re-UE4SS/UEPseudo.git` and `git@github.com:trumank/patternsleuth.git`.
2. `Re-UE4SS/UEPseudo` returns 404 on GitHub API (as of 2026-04-24). The org
   appears to have been renamed/moved. `trumank/patternsleuth` exists.
3. Without UEPseudo, UE4SS can't be built from source.
4. The DEV release zip (`zDEV-UE4SS_v3.0.1.zip`) ships only runtime binaries
   and docs — no headers, no import lib. Can't link a CppMod against it
   directly without extracting the import lib from the DLL or stubbing the
   header with an ABI-matching shim.

Both workarounds (fork UEPseudo OR stub CppUserModBase) are ongoing maintenance
burdens. For MVP — which doesn't need engine reflection — neither is worth it.
We ship our own proxy DLL and revisit if/when v2 makes the tradeoff compelling.

## Stalker 2 specifics

**UE version**: 5.1 (confirmed via a working community UE4SS build's
`[EngineVersionOverride] MajorVersion=5, MinorVersion=1`).

**Working community AOBs** (from a Stalker 2 UE4SS build distributed as
"UE4SS updated-1910-1-8-1-1767217803", 2025-12-30, on a local-disk install;
likely sourced from Nexus mod 560 / PRZ mod):

`UE4SS_Signatures/GUObjectArray.lua`:
```lua
function Register()
  return "48 8D 0D ? ? ? ? E8 ? ? ? ? E8 ? ? ? ? E8 ? ? ? ? C6 05 ? ? ? ? 01"
end
function OnMatchFound(MatchAddress)
  local LeaInstr = MatchAddress
  local NextInstr = LeaInstr + 0x7
  local Offset = LeaInstr + 0x3
  return NextInstr + DerefToInt32(Offset) - 0x10
end
```
Decoded pattern: `lea rcx, [rip+disp32]` + three `call rel32` + `mov byte [addr], 01`. The LEA loads a pointer near GUObjectArray; subtracting 0x10 lands on the struct start. This is the only symbol that needed a custom signature; `FName_ToString`/`StaticConstructObject`/etc. use UE4SS's built-in AOBs.

**Stable hook + setting block** (full-hooks variant from the working community build — differs from the Nexus 560 minimal subset; evidently newer S2 patches tolerate the full set):
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

For our v2 work, the plan is:
1. Port the GUObjectArray AOB above into our own signature runner (start
   simple — a JSON file + a C++ scanner, not a Lua interpreter).
2. Use `FExecVTableOffsetInLocalPlayer = 0x28` verbatim when we eventually
   implement console-exec hooking.
3. Disable `bUseUObjectArrayCache`-equivalent behavior (or skip it entirely
   for MVP — we don't need a cache yet).
4. Defer hooks to the subset we actually need; unlike UE4SS we don't have
   to support the full Lua mod API surface.

For cross-reference when Stalker 2 patches break the AOB above, UE4SS issue
#1198 posts UE-5.7.x AOBs from Bladesong (different game, similar engine
area):
- `GUObjectArray`: `48 8B 05 ?? ?? ?? ?? 48 8B 0C C1 48 8D 04 D1`
- `FName_Constructor`: `48 8B 05 ?? ?? ?? ?? 41 8B 07 F0 0F C1 47 04`
- `FText_Constructor`: `48 8B ?? 48 85 ?? 0F 84 ?? ?? ?? ?? E8 ?? ?? ?? ?? 48 8B ?? 48 89 ??`

## Build + ship pipeline

- `src/pull-node-runtime.mts` — resolves + fetches latest Node Windows x64,
  verifies SHASUMS256, extracts into `src/nodebridge/dist/node/`.
- `.github/workflows/build-nodebridge.yml` — MSVC / CMake on `windows-latest`,
  uploads `dwmapi.dll` as release artifact on `nodebridge-v*` tags.
- `src/pull-nodebridge.mts` — downloads release binary into `dist/`.
- `src/inject-nodebridge.mts` — hash-skipped copy of DLL + runtime + JS payload
  into the live game folder. Analogous to `src/inject-ue4ss.mts` for UE4SS-Lua
  mods already in this repo.

## Open items

- Steam Workshop / mod.io support for non-pak files. If Stalker 2's Workshop
  installer is pak-only, NodeBridge mods need a separate install path. Confirm
  with a throwaway upload before shipping to end users.
- Signature framework for v2 mutation API (probably JSON-per-symbol).
- Figure out the UE version Stalker 2 reports — relevant for signature reuse
  from sibling UE 5.x games.
