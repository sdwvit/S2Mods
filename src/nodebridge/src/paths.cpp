#include "paths.h"

#include <windows.h>

#include <chrono>
#include <format>

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

// Per-launch log filename so each game session has its own file —
// avoids the previous behavior of every launch appending to one
// ever-growing bridge.log. Resolved once on first call and cached
// so the rest of the DLL keeps writing to the same file.
fs::path log_file() {
  static std::wstring cached;
  if (cached.empty()) {
    auto now = std::chrono::floor<std::chrono::seconds>(std::chrono::system_clock::now());
    cached = std::format(L"{:%Y-%m-%d_%H-%M-%S}-bridge.log", now);
  }
  return root() / L"logs" / cached;
}

std::wstring pipe_name() {
  wchar_t buf[64];
  swprintf(buf, 64, L"\\\\.\\pipe\\NodeBridge-%lu", GetCurrentProcessId());
  return buf;
}

}  // namespace nb::paths
