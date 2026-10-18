#include "game_thread_queue.h"

#include <windows.h>

#include <MinHook.h>

#include <atomic>
#include <deque>
#include <mutex>

#include "logging.h"

namespace nb::gt {

namespace {
std::mutex g_mu;
std::deque<std::function<void()>> g_queue;
std::atomic<uint32_t> g_game_tid{0};
std::atomic<ProcessEventFn> g_original_pe{nullptr};
std::atomic<bool> g_hooked{false};
// drain() runs tasks that call ProcessEvent themselves; don't recurse.
thread_local bool t_draining = false;

void process_event_detour(void* self, void* func, void* params) {
  if (!t_draining && on_game_thread()) drain();
  g_original_pe.load()(self, func, params);
}
}  // namespace

void schedule(std::function<void()> task) {
  std::lock_guard lk(g_mu);
  g_queue.emplace_back(std::move(task));
}

void drain() {
  std::deque<std::function<void()>> local;
  {
    std::lock_guard lk(g_mu);
    if (g_queue.empty()) return;
    local.swap(g_queue);
  }
  t_draining = true;
  for (auto& t : local) {
    try {
      t();
    } catch (...) {
      // Swallow — crashing the game thread here is a very bad day.
    }
  }
  t_draining = false;
}

void set_game_thread_id(uint32_t tid) { g_game_tid = tid; }

bool on_game_thread() { return g_game_tid != 0 && GetCurrentThreadId() == g_game_tid; }

bool install_process_event_hook(uintptr_t addr) {
  if (g_hooked) return true;
  void* original = nullptr;
  MH_STATUS st = MH_CreateHook(reinterpret_cast<void*>(addr),
                               reinterpret_cast<void*>(&process_event_detour), &original);
  if (st != MH_OK) {
    nb::log::error("gt", "MH_CreateHook(ProcessEvent @ 0x{:x}) failed: {}", addr, static_cast<int>(st));
    return false;
  }
  g_original_pe = reinterpret_cast<ProcessEventFn>(original);
  st = MH_EnableHook(reinterpret_cast<void*>(addr));
  if (st != MH_OK) {
    nb::log::error("gt", "MH_EnableHook(ProcessEvent) failed: {}", static_cast<int>(st));
    return false;
  }
  g_hooked = true;
  nb::log::info("gt", "ProcessEvent hooked at 0x{:x}; game thread tid={}", addr, g_game_tid.load());
  return true;
}

bool process_event_hooked() { return g_hooked; }

ProcessEventFn original_process_event() { return g_original_pe; }

}  // namespace nb::gt
