#include "node_host.h"

#include <windows.h>

#include <chrono>
#include <filesystem>
#include <format>

#include "logging.h"
#include "paths.h"

namespace nb::host {

namespace {
constexpr int kMaxConsecutiveFailures = 5;
constexpr auto kRetryDelay = std::chrono::seconds(2);
}  // namespace

NodeHost::NodeHost() = default;
NodeHost::~NodeHost() { stop(); }

bool NodeHost::start(const std::wstring& pipe_name) {
  if (running_.exchange(true)) return false;
  supervisor_ = std::thread(&NodeHost::run_supervised, this, pipe_name);
  return true;
}

void NodeHost::stop() {
  if (!running_.exchange(false)) {
    if (supervisor_.joinable()) supervisor_.join();
    return;
  }
  if (child_process_) {
    TerminateProcess(static_cast<HANDLE>(child_process_), 0);
  }
  if (supervisor_.joinable()) supervisor_.join();
}

void NodeHost::run_supervised(std::wstring pipe_name) {
  int failures = 0;
  while (running_.load()) {
    auto node = nb::paths::node_exe();
    auto boot = nb::paths::bootstrap_mjs();
    auto mods = nb::paths::mods_dir();
    if (!std::filesystem::exists(node)) {
      nb::log::error("host", "node.exe missing at {}", node.string());
      return;
    }
    if (!std::filesystem::exists(boot)) {
      nb::log::error("host", "bootstrap.mjs missing at {}", boot.string());
      return;
    }

    std::wstring cmd = std::format(
        L"\"{}\" \"{}\" --pipe={} --mods-root=\"{}\"",
        node.wstring(), boot.wstring(), pipe_name, mods.wstring());

    STARTUPINFOW si{};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = INVALID_HANDLE_VALUE;
    si.hStdOutput = INVALID_HANDLE_VALUE;
    si.hStdError = INVALID_HANDLE_VALUE;
    PROCESS_INFORMATION pi{};

    std::vector<wchar_t> mutable_cmd(cmd.begin(), cmd.end());
    mutable_cmd.push_back(L'\0');

    BOOL ok = CreateProcessW(
        nullptr, mutable_cmd.data(), nullptr, nullptr, FALSE,
        CREATE_NO_WINDOW, nullptr, node.parent_path().wstring().c_str(), &si, &pi);

    if (!ok) {
      nb::log::error("host", "CreateProcessW failed: {}", GetLastError());
      if (++failures >= kMaxConsecutiveFailures) return;
      std::this_thread::sleep_for(kRetryDelay);
      continue;
    }

    child_process_ = pi.hProcess;
    CloseHandle(pi.hThread);
    nb::log::info("host", "spawned node.exe pid={}", pi.dwProcessId);

    WaitForSingleObject(pi.hProcess, INFINITE);
    DWORD code = 0;
    GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hProcess);
    child_process_ = nullptr;
    nb::log::warn("host", "node.exe exited code={}", code);

    if (!running_.load()) break;

    if (code == 0) {
      failures = 0;
    } else if (++failures >= kMaxConsecutiveFailures) {
      nb::log::error("host", "giving up after {} failures", failures);
      return;
    }
    std::this_thread::sleep_for(kRetryDelay);
  }
}

}  // namespace nb::host
