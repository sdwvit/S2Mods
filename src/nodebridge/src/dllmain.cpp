// NodeBridge proxy DLL entry.
//
// Takes the dwmapi.dll slot in <game>/Stalker2/Binaries/Win64/. Windows loads us
// before the real system DLL; dwmapi.def forwards every export to a sibling
// file named dwmapi_orig.dll so the game proceeds as if we weren't there.
// On first load we copy %SystemRoot%\System32\dwmapi.dll → dwmapi_orig.dll
// next to ourselves (guarded by existence check) so the forwarders resolve.
// CopyFileW does not take the loader lock, so doing this in DllMain is safe.
//
// We adopt UE4SS's loader-lock-safe init pattern (main_ue4ss_rewritten.cpp):
// DllMain must return quickly. Instead of CreateThread (which is technically
// undefined from inside the loader lock), queue an APC on the current thread.
// The APC body fires the first time the thread enters an alertable wait after
// DllMain returns — at that point the loader lock is long gone, so it's safe
// to load other DLLs, open named pipes, and spawn child processes.
//
// Engine hooks (MinHook + AOBs) are not installed at MVP. Any bridge.game.*
// call that would need reflection returns {unresolved: true} — see bindings.cpp.
// See hook_init.cpp for where the real hooks will plug in for v2 (mutation API).

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

// Ensure dwmapi_orig.dll exists next to us so forwarders in dwmapi.def
// resolve. Safe to call from DllMain: only file-I/O APIs, no LoadLibrary.
void ensure_dwmapi_orig(HMODULE self) {
  wchar_t self_path[MAX_PATH]{};
  if (!GetModuleFileNameW(self, self_path, MAX_PATH)) return;
  wchar_t* last_slash = wcsrchr(self_path, L'\\');
  if (!last_slash) return;
  *(last_slash + 1) = L'\0';
  wchar_t orig_path[MAX_PATH]{};
  swprintf_s(orig_path, L"%s%s", self_path, L"dwmapi_orig.dll");
  DWORD attrs = GetFileAttributesW(orig_path);
  if (attrs != INVALID_FILE_ATTRIBUTES) return;  // already present
  wchar_t sys_path[MAX_PATH]{};
  UINT got = GetSystemDirectoryW(sys_path, MAX_PATH);
  if (!got || got >= MAX_PATH) return;
  wchar_t src[MAX_PATH]{};
  swprintf_s(src, L"%s\\%s", sys_path, L"dwmapi.dll");
  CopyFileW(src, orig_path, TRUE /* fail if exists */);
  // If this fails the game will fail to start because forwarders won't
  // resolve — but there's nothing else we can do from here; log once
  // the runtime is up (bootstrap() below).
}

struct Runtime {
  nb::ipc::PipeServer pipe;
  std::unique_ptr<nb::rpc::Router> router;
  nb::host::NodeHost host;
};

std::unique_ptr<Runtime> g_runtime;
HMODULE g_self = nullptr;

void bootstrap() {
  nb::log::init();
  nb::log::info("dll", "NodeBridge attaching (pid={})", GetCurrentProcessId());

  // MinHook init is cheap; actual engine hooks stay stubbed for MVP.
  nb::hook::install();

  auto rt = std::make_unique<Runtime>();
  rt->router = std::make_unique<nb::rpc::Router>(rt->pipe);
  nb::bindings::install(*rt->router);

  auto pipe_name = nb::paths::pipe_name();
  if (!rt->pipe.start(pipe_name)) {
    nb::log::error("dll", "pipe start failed, aborting runtime bootstrap");
    return;
  }

  auto enabled = nb::mods::enumerate();
  nb::mods::write_enabled_json(enabled);

  if (!rt->host.start(pipe_name)) {
    nb::log::error("dll", "node host start failed");
    return;
  }

  g_runtime = std::move(rt);
  nb::log::info("dll", "runtime up");
}

// APC body — runs on the thread that queued it, but only once that thread
// enters an alertable wait. By then the loader lock is released.
void CALLBACK apc_bootstrap(ULONG_PTR) { bootstrap(); }

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
      DisableThreadLibraryCalls(module);
      // MUST happen before DllMain returns: Windows resolves our forwarders
      // (→ dwmapi_orig.dll) immediately after this function exits and aborts
      // the game's startup if that file is missing.
      ensure_dwmapi_orig(module);
      // If we're on the main thread (typical proxy-load path), queue an APC so
      // init runs after loader lock is released. Otherwise we were injected
      // from a worker thread and can bootstrap directly on a new thread —
      // still off the loader lock.
      QueueUserAPC(apc_bootstrap, GetCurrentThread(), 0);
      break;
    }
    case DLL_PROCESS_DETACH:
      shutdown_runtime();
      break;
  }
  return TRUE;
}
