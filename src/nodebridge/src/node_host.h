#pragma once
#include <atomic>
#include <string>
#include <thread>

namespace nb::host {

// Spawns the bundled node.exe with the bootstrap.mjs entry and the pipe name.
// Monitors the child; on clean/dirty exit, logs and (optionally) respawns.
class NodeHost {
 public:
  NodeHost();
  ~NodeHost();

  bool start(const std::wstring& pipe_name);
  void stop();

 private:
  void run_supervised(std::wstring pipe_name);

  std::thread supervisor_;
  std::atomic<bool> running_{false};
  void* child_process_ = nullptr;  // HANDLE
};

}  // namespace nb::host
