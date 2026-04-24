#include "hook_init.h"

#include <windows.h>

#include <MinHook.h>

#include "logging.h"

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
  nb::log::warn("hook", "engine-init + tick hooks not yet installed; bindings return unresolved");
  return true;
}

void uninstall() {
  if (!g_minhook_ready) return;
  MH_DisableHook(MH_ALL_HOOKS);
  MH_Uninitialize();
  g_minhook_ready = false;
}

}  // namespace nb::hook
