# Quest JS Generation Cleanup Plan

## Goals
- Improve readability of generated `*.cfg.js` quest debug scripts.
- Improve simulator usefulness (especially inventory-driven conditions).
- Reduce noisy / misleading generated expressions and logs.

## Current Status (2026-02-24)
- Improved node function formatting in generated output.
- Added inventory simulation runtime helpers (`__questAddItem`, `__questRemoveItem`, `__questIsItemInInventory`).
- Added path resolution support for absolute paths and SDK `GameLite`-relative paths.
- Added tests for runtime source and path/stub generation helpers.

## Next Improvements (Prioritized)
1. Simplify boolean condition expressions (`... >= true`, `... < true`, etc.). ✅
2. Emit multi-line readable helper stubs (`ItemAdd`, `ItemRemove`, `isItemInInventory`, generic stubs). ✅
3. Add debug log gating (`DEBUG_QUEST_JS`) to reduce noise for large scripts. ✅ (foundation added via `__questLog`)
4. Include caller/pin in logs consistently (or behind debug level). ✅
5. Normalize generated quote style across boilerplate/runtime/content.
6. Emit `const` for immutable generated SID globals instead of `let`. ✅
7. Add simulator convenience helpers (`__questSetItemCount`, `__questDumpInventory`).
8. Improve actor-aware inventory condition simulation where target actor is known.
9. Trim formatting artifacts in generated condition/action expressions. ✅
10. Add section headers in generated files for scanability.
11. Improve log readability:
  - compact action stub argument formatting
  - configurable `compact` vs `full` log levels

## Test Strategy
- Keep pure helper logic in side-effect-free modules for fast Vitest coverage.
- Add unit tests for:
  - path resolution
  - global stub rendering
  - runtime source content
  - boolean comparison simplification helper
- Add focused codegen formatting tests (small synthetic IR fixtures) after helper-level coverage is stable.

## In Progress
- [x] Boolean condition simplification helper + integration in `src/quest/codegen.mts`
- [x] Multi-line helper stub formatting in `src/quest/js-gen-utils.mts`
- [x] Tests for both changes
- [x] `DEBUG_QUEST_JS` / `__questLog` runtime+stub wiring (initial)
- [x] Flip generated SID globals from `let` to `const` in output
- [x] Expand `__questLog` usage to generated helper snippets
- [x] Abstract node init/complete boilerplate into runtime helpers
- [x] Remove `const f = ...` aliases from generated node functions
- [x] Omit unused `QuestStartCaller` / `spawnedActors` from generated preamble
- [ ] Log readability phase: compact args + log levels (`compact`/`full`)

## Next Session Plan (RSQ01 Follow-up)
1. Unify co-dependent node logging with normal node logging.
  - Replace generated `.then(...)` logs like `__questLog('// Node(', callerName, ',', name, ');')`.
  - Add a runtime helper (for example `__questLogNode(f, callerName, name)`) that respects `DEBUG_QUEST_JS_NODE_LOGS` and depth indentation.
2. Refactor co-dependent node codegen in `src/quest/codegen.mts`.
  - Route deferred node-entry logging through the new helper.
  - Remove duplicated string-concatenation logging snippets from `.then(...)` blocks.
3. Add/adjust tests before further cleanup.
  - `src/quest/codegen.test.ts`: assert co-dependent paths use the helper and old log pattern is absent.
  - `src/quest/runtime.test.ts`: assert helper exists and is gated by `DEBUG_QUEST_JS_NODE_LOGS`.
4. Regenerate and verify on `RSQ01.cfg` + `RSQ01_C01..C06.cfg`.
  - Confirm consistent node log formatting in co-dependent flows.
  - Confirm indentation and node-log gating behavior are consistent.
5. Optional follow-up if time remains.
  - Add `DEBUG_QUEST_JS_REGISTRATION` to gate startup registration spam.
  - Add section headers in generated JS files for scanability.
