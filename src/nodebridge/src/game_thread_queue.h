#pragma once
#include <cstdint>
#include <functional>

namespace nb::gt {

// Thread-safe queue for marshaling work onto the UE game thread.
// Call schedule() from any thread; drain() runs pending tasks.
// drain() is called from the UObject::ProcessEvent detour (see
// install_process_event_hook) whenever it fires on the game thread.
void schedule(std::function<void()> task);
void drain();

// The game thread is the process's main thread, which is the one that runs
// our DllMain (dwmapi is a static import of the exe). dllmain.cpp records it.
void set_game_thread_id(uint32_t tid);
bool on_game_thread();

// Detour UObject::ProcessEvent at `addr` (resolved by JS: mainExeBase + RVA)
// so drain() runs on the game thread. Returns false if MinHook refuses.
bool install_process_event_hook(uintptr_t addr);
bool process_event_hooked();

// The original ProcessEvent (trampoline once hooked), for calls we make
// ourselves so they don't re-enter the detour.
using ProcessEventFn = void (*)(void*, void*, void*);
ProcessEventFn original_process_event();

}  // namespace nb::gt
