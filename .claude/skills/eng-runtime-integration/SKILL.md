---
name: eng-runtime-integration
description: Work on this repository's JavaScript and C++ runtime integration, memory primitives, reflection layouts, and edit/deploy/log iteration loop. Use for NodeBridge, bindings.cpp, or runtime memory-layout work in this repository.
---

# Runtime integration

## Primitives in C++, logic in JS
When debugging engine internals (UStruct layout, property offsets, vtable hunts), iterate in
**JS** over the existing memory primitives — `dumpObjectMemory`, `dumpClassMemory`,
`readMemory`, `scanAOB`, `mainExeBase`, `fnameToString` — instead of adding high-level
handlers to `bindings.cpp`.

Every new C++ binding forces a Windows-only rebuild cycle (tag → workflow →
pull-nodebridge → inject → restart game) for what could be a one-line JS change.
Before proposing a new `game.X` handler, ask: can this be done with `readMemory` + JS
parsing? The only legitimate new bindings are *primitives* — one engine call wrapped, no
business logic (e.g. `fnameToString`, `writeMemory`). Walker, list and `find_*` operations
belong in `Mods/NodeBridge/nodebridge/main.mts`.

The fallback C++ walker in `src/nodebridge/src/uproperty.{h,cpp}` is deprecated — fix the JS
constants instead, never patch those offsets.

## Iteration loop — skip typecheck
1. Edit `Mods/NodeBridge/nodebridge/main.mts`
2. `npm run inject-nodebridge` (hot-reload is wired)
3. Read the last ~50–100 lines of
   `$STALKER2_FOLDER/Stalker2/Binaries/Win64/NodeBridge/logs/bridge.log`

Skip `tsc --noEmit`, `node --check`, manual syntax verification — errors surface in the
bridge log and cost one extra iteration; pre-checking just slows the loop.

## Verified GSC UE 5.1 offsets (2026-09-29 game build)
Live in `GSC` and `BUILD_RVA` at the top of `src/nodebridge/runtime/s2lib.mts`, confirmed by
in-game JS probes 2026-10-19/20. A game update can move any of them; re-probe before trusting.

- `UStruct.PropertyLink` @ +0x70, `PropertiesSize` @ +0x58, `SuperStruct` @ +0x40, `Children` @ +0x48
- `FField.NamePrivate` @ +0x20 (stock +0x28: FFieldVariant Owner is 8 bytes in this build)
- `FProperty.offset_internal` @ +0x44, `PropertyLinkNext` @ +0x48 (+0x50 is the RefLink chain)
- `UObjectBase.class_ptr` @ +0x10, `NamePrivate` @ +0x18
- RVAs: GUObjectArray 0xa0e68c0, FNamePool 0x9ff0c80, UObject::ProcessEvent 0x216a728 (vtable slot 79)
- C++ FName::ToString has no trusted candidate in this build; `decodeFName` falls back to
  reading FNamePool in JS.

Look properties up by name (`findPropertyOffset` up the SuperStruct chain), not by fixed
offsets: `RootComponent` moved 0x1A0 → 0x1C0 with the update.

Console commands: `runConsoleCommand` calls `KismetSystemLibrary.ExecuteConsoleCommand`
(params: WorldContextObject @0, FString Command @8, SpecificPlayer @0x18) through ProcessEvent,
which the DLL runs on the game thread via its ProcessEvent detour. `APlayerController::ConsoleCommand`
is not a UFunction. The player controller class is `BP_Stalker2PlayerContoller_C` (GSC spelling).

During play, use the HTTP API in `Mods/NodeBridge/nodebridge/main.mts` (127.0.0.1:47811:
`/cmd?c=`, `/pos`, `/squad?faction=&size=`). The console session finds the PlayerController
through GameEngine.GameInstance → LocalPlayers[0] → PlayerController on every command (level
loads recreate it). The GameEngine and `Default__KismetSystemLibrary` object indices are cached
per game build in `<Win64>/NodeBridge/cache/<PE timestamp>-<SizeOfImage>.json` and checked by name.
Only a new build (or a mismatch) rescans GUObjectArray (~30 s). Every inject restarts node.exe,
so don't edit bridge files mid-session.

`USceneComponent`: `RelativeLocation` +0x130 (FVector3d, 24B). `ComponentToWorld` is **not**
a UProperty in the GSC fork — the cached FTransform's Translation slot is at
SceneComponent+0x260. Locate it by reading 0x400 bytes after RelativeLocation and finding
the second 24-byte run matching the live RelativeLocation.

Visual teleport needs both writes (RelativeLocation **and** +0x260); zero
`CharacterMovement.Velocity` each tick or the movement component re-integrates and snaps the
pawn back.

If a game patch drifts these, re-run `probeUStructLayout` (also in `main.mts`) — it sweeps
candidate offsets and scores against expected pawn class names.
