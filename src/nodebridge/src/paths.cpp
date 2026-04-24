#include "paths.h"

#include <windows.h>

namespace fs = std::filesystem;

namespace nb::paths {

static HMODULE g_self_module = nullptr;

static void ensure_self_module() {
  if (g_self_module) return;
  GetModuleHandleExW(
      GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
      reinterpret_cast<LPCWSTR>(&ensure_self_module),
      &g_self_module);
}

fs::path dll_dir() {
  ensure_self_module();
  wchar_t buf[MAX_PATH] = {};
  GetModuleFileNameW(g_self_module, buf, MAX_PATH);
  return fs::path(buf).parent_path();
}

fs::path root() { return dll_dir() / L"NodeBridge"; }
fs::path node_exe() { return root() / L"node" / L"node.exe"; }
fs::path bootstrap_mjs() { return root() / L"runtime" / L"bootstrap.mjs"; }
fs::path mods_dir() { return root() / L"mods"; }
fs::path log_file() { return root() / L"logs" / L"bridge.log"; }

std::wstring pipe_name() {
  wchar_t buf[64];
  swprintf(buf, 64, L"\\\\.\\pipe\\NodeBridge-%lu", GetCurrentProcessId());
  return buf;
}

}  // namespace nb::paths
