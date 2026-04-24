// NodeBridge proxy DLL entry.
//
// Takes the dwmapi.dll slot in <game>/Stalker2/Binaries/Win64/. Windows loads us
// before the real system DLL; dwmapi.def forwards every export to a sibling
// file named dwmapi_orig.dll so the game proceeds as if we weren't there.
// On first load we copy %SystemRoot%\System32\dwmapi.dll → dwmapi_orig.dll
// next to ourselves (guarded by existence check) so the forwarders resolve.
//
// Startup ordering:
//   1. Open the log file immediately so "DLL was loaded at all" is provable
//      even if everything downstream fails.
//   2. Ensure dwmapi_orig.dll exists before Windows tries to resolve our
//      forwarders after DllMain returns.
//   3. Spawn a worker thread (CreateThread) for the real bootstrap. We
//      previously used QueueUserAPC to play it safe with loader lock, but
//      APCs only fire on the main thread's next alertable wait, and UE
//      games don't reliably hit alertable waits during startup — which
//      means bootstrap never runs. CreateThread from DllMain is technically
//      discouraged, but the worker does not call LoadLibrary directly from
//      its first moments, and this pattern is widely used in proxy DLLs.
//
// Engine hooks (MinHook + AOBs) are not installed at MVP. Any bridge.game.*
// call that would need reflection returns {unresolved: true} — see
// bindings.cpp. See hook_init.cpp for where the real hooks will plug in.

#include <windows.h>

#include <memory>

#include "bindings.h"
#include "hook_init.h"
#include "ipc_server.h"
#include "logging.h"
#include "mod_loader.h"
#include "node_host.h"
#include "paths.h"
#include "rpc.h"

namespace {

// Safe to call from DllMain: only file-I/O APIs, no LoadLibrary.
bool ensure_dwmapi_orig(HMODULE self, wchar_t* out_orig_path, size_t cap) {
  wchar_t self_path[MAX_PATH]{};
  if (!GetModuleFileNameW(self, self_path, MAX_PATH)) return false;
  wchar_t* last_slash = wcsrchr(self_path, L'\\');
  if (!last_slash) return false;
  *(last_slash + 1) = L'\0';
  swprintf_s(out_orig_path, cap, L"%s%s", self_path, L"dwmapi_orig.dll");
  if (GetFileAttributesW(out_orig_path) != INVALID_FILE_ATTRIBUTES) return true;
  wchar_t sys_path[MAX_PATH]{};
  UINT got = GetSystemDirectoryW(sys_path, MAX_PATH);
  if (!got || got >= MAX_PATH) return false;
  wchar_t src[MAX_PATH]{};
  swprintf_s(src, L"%s\\%s", sys_path, L"dwmapi.dll");
  return CopyFileW(src, out_orig_path, TRUE) != 0;
}

struct Runtime {
  nb::ipc::PipeServer pipe;
  std::unique_ptr<nb::rpc::Router> router;
  nb::host::NodeHost host;
};

std::unique_ptr<Runtime> g_runtime;
HMODULE g_self = nullptr;

DWORD WINAPI bootstrap_thread(LPVOID) {
  nb::log::info("dll", "bootstrap thread started (tid={})", GetCurrentThreadId());

  // MinHook init is cheap; actual engine hooks stay stubbed for MVP.
  nb::hook::install();

  auto rt = std::make_unique<Runtime>();
  rt->router = std::make_unique<nb::rpc::Router>(rt->pipe);
  nb::bindings::install(*rt->router);

  auto pipe_name = nb::paths::pipe_name();
  if (!rt->pipe.start(pipe_name)) {
    nb::log::error("dll", "pipe start failed, aborting runtime bootstrap");
    return 1;
  }

  nb::mods::enumerate();  // early log of discovered mods for diagnostics

  if (!rt->host.start(pipe_name)) {
    nb::log::error("dll", "node host start failed");
    return 1;
  }

  g_runtime = std::move(rt);
  nb::log::info("dll", "runtime up");
  return 0;
}

void shutdown_runtime() {
  if (!g_runtime) return;
  nb::log::info("dll", "NodeBridge detaching");
  g_runtime->host.stop();
  g_runtime->pipe.stop();
  g_runtime.reset();
  nb::hook::uninstall();
  nb::log::shutdown();
}

}  // namespace

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID) {
  switch (reason) {
    case DLL_PROCESS_ATTACH: {
      g_self = module;

      // Prove "we got loaded" before anything else. If the log never gets
      // created, the DLL never loaded (Wine/Proton override issue, missing
      // dependency, etc.) — that's a very different failure than
      // "DLL loaded but bootstrap never fired".
      nb::log::init();
      nb::log::info("dll", "NodeBridge attaching (pid={})", GetCurrentProcessId());

      // MUST happen before DllMain returns: Windows resolves our forwarders
      // (→ dwmapi_orig.dll) right after this function exits.
      wchar_t orig_path[MAX_PATH]{};
      if (ensure_dwmapi_orig(module, orig_path, MAX_PATH)) {
        nb::log::info("dll", "dwmapi_orig.dll ready");
      } else {
        nb::log::error("dll", "dwmapi_orig.dll could not be staged — game will likely fail to start");
      }

      // Worker thread does all the hook + IPC + node-host work. DllMain
      // returns immediately after this so the loader lock is released.
      HANDLE h = CreateThread(nullptr, 0, bootstrap_thread, nullptr, 0, nullptr);
      if (!h) {
        nb::log::error("dll", "CreateThread for bootstrap failed: {}", GetLastError());
      } else {
        CloseHandle(h);
      }

      DisableThreadLibraryCalls(module);
      break;
    }
    case DLL_PROCESS_DETACH:
      shutdown_runtime();
      break;
  }
  return TRUE;
}
