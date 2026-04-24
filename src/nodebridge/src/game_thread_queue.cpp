#include "game_thread_queue.h"

#include <deque>
#include <mutex>

namespace nb::gt {

namespace {
std::mutex g_mu;
std::deque<std::function<void()>> g_queue;
}  // namespace

void schedule(std::function<void()> task) {
  std::lock_guard lk(g_mu);
  g_queue.emplace_back(std::move(task));
}

void drain() {
  std::deque<std::function<void()>> local;
  {
    std::lock_guard lk(g_mu);
    local.swap(g_queue);
  }
  for (auto& t : local) {
    try {
      t();
    } catch (...) {
      // Swallow — crashing the game thread here is a very bad day.
    }
  }
}

}  // namespace nb::gt
