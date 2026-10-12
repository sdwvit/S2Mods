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

## Verified GSC UE 5.1 offsets
Live in the `GSC` constant block at the top of `Mods/NodeBridge/nodebridge/main.mts`,
confirmed by an in-game JS probe 2026-04-24:

- `UStruct.PropertyLink` @ +0x70 (stock UE 5.1: +0x60)
- `UStruct.PropertiesSize` @ +0x58 (stock: +0x48)
- `UStruct.SuperStruct` @ +0x40 (assumed +0x10 shift, not directly verified)
- `FField.NamePrivate` @ +0x28 (stock)
- `FProperty.property_link_next` @ +0x58 (stock)
- `FProperty.offset_internal` @ +0x4C (stock)
- `UObjectBase.class_ptr` @ +0x10 (stock)

FField/FProperty are pure stock; only UStruct's own members shift by +0x10.

`BP_Stalker2Character_C`: `RootComponent` +0x1A0, `Mesh` +0x320,
`CharacterMovement` +0x328, `CapsuleComponent` +0x330.

`USceneComponent`: `RelativeLocation` +0x130 (FVector3d, 24B). `ComponentToWorld` is **not**
a UProperty in the GSC fork — the cached FTransform's Translation slot is at
SceneComponent+0x260. Locate it by reading 0x400 bytes after RelativeLocation and finding
the second 24-byte run matching the live RelativeLocation.

Visual teleport needs both writes (RelativeLocation **and** +0x260); zero
`CharacterMovement.Velocity` each tick or the movement component re-integrates and snaps the
pawn back.

If a game patch drifts these, re-run `probeUStructLayout` (also in `main.mts`) — it sweeps
candidate offsets and scores against expected pawn class names.
