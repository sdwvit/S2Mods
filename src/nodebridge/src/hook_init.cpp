#include "hook_init.h"

#include <windows.h>

#include <MinHook.h>

#include "logging.h"
#include "ue_reflection.h"

namespace nb::hook {

namespace {
bool g_minhook_ready = false;
}

bool install() {
  if (MH_Initialize() != MH_OK) {
    nb::log::error("hook", "MH_Initialize failed");
    return false;
  }
  g_minhook_ready = true;

  // Try the AOB-based resolution once, opportunistically. If the main exe
  // isn't loaded/ready yet (extremely unlikely by this point — DllMain has
  // returned), we'll just log and move on; bindings that need reflection
  // will surface "unresolved" with an explicit reason.
  if (!nb::ue::initialize()) {
    nb::log::warn("hook", "UE reflection not yet available; game.* read bindings degraded");
  }
  return true;
}

void uninstall() {
  if (!g_minhook_ready) return;
  MH_DisableHook(MH_ALL_HOOKS);
  MH_Uninitialize();
  g_minhook_ready = false;
}

}  // namespace nb::hook
