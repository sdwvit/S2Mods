#pragma once
#include <functional>

namespace nb::gt {

// Thread-safe queue for marshaling work onto the UE game thread.
// Call schedule() from any thread; drain() runs pending tasks.
// drain() must be called from the game thread via the tick hook installed
// by hook_init.cpp. For MVP (read-only access) the queue is used to gate
// reads through a known-good moment in the engine frame.
void schedule(std::function<void()> task);
void drain();

}  // namespace nb::gt
