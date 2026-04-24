#pragma once

namespace nb::hook {

// Installs MinHook and (eventually) Stalker 2's engine-init / tick hooks.
//
// MVP state: MinHook is initialized so bindings can install hooks on demand,
// but no engine-specific hooks are installed yet. AOB patterns for Stalker 2's
// shipping build are not public, so the v2 mutation API will either
// (a) port UE4SS's Lua-scripted-signature approach, letting users drop AOBs
//     into a sidecar file, or
// (b) pull the relevant AOBs from a community source (Nexus mod 560 /
//     PRZ mod) once a stable set exists.
//
// See the UE4SS-settings.ini preset shipped with the mod zip for the
// hook-flag combination the Stalker 2 community has found stable.
bool install();
void uninstall();

}  // namespace nb::hook
