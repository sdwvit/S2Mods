#include "ipc_server.h"

#include <windows.h>

#include <atomic>
#include <mutex>
#include <thread>
#include <vector>

#include "logging.h"

namespace nb::ipc {

namespace {
constexpr DWORD kBufferSize = 64 * 1024;
constexpr size_t kHeaderBytes = 4;

inline uint32_t read_be32(const uint8_t* p) {
  return (uint32_t(p[0]) << 24) | (uint32_t(p[1]) << 16) | (uint32_t(p[2]) << 8) | uint32_t(p[3]);
}
inline void write_be32(uint8_t* p, uint32_t v) {
  p[0] = uint8_t(v >> 24);
  p[1] = uint8_t(v >> 16);
  p[2] = uint8_t(v >> 8);
  p[3] = uint8_t(v);
}
}  // namespace

struct PipeServer::Impl {
  std::wstring name;
  HANDLE pipe = INVALID_HANDLE_VALUE;
  std::thread worker;
  std::atomic<bool> running{false};
  std::mutex write_mutex;
};

PipeServer::PipeServer() : impl_(std::make_unique<Impl>()) {}
PipeServer::~PipeServer() { stop(); }

bool PipeServer::start(const std::wstring& pipe_name) {
  if (impl_->running.exchange(true)) return false;
  impl_->name = pipe_name;

  impl_->pipe = CreateNamedPipeW(
      pipe_name.c_str(),
      PIPE_ACCESS_DUPLEX,
      PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
      1,
      kBufferSize,
      kBufferSize,
      0,
      nullptr);
  if (impl_->pipe == INVALID_HANDLE_VALUE) {
    nb::log::error("ipc", "CreateNamedPipeW failed: {}", GetLastError());
    impl_->running = false;
    return false;
  }

  impl_->worker = std::thread([this]() {
    nb::log::info("ipc", "waiting for client on pipe");
    BOOL ok = ConnectNamedPipe(impl_->pipe, nullptr);
    if (!ok && GetLastError() != ERROR_PIPE_CONNECTED) {
      nb::log::error("ipc", "ConnectNamedPipe failed: {}", GetLastError());
      impl_->running = false;
      return;
    }
    nb::log::info("ipc", "client connected");
    if (ready_handler_) ready_handler_();

    std::vector<uint8_t> buf;
    buf.reserve(kBufferSize);
    uint8_t chunk[kBufferSize];
    while (impl_->running.load()) {
      DWORD got = 0;
      BOOL rok = ReadFile(impl_->pipe, chunk, kBufferSize, &got, nullptr);
      if (!rok || got == 0) {
        nb::log::info("ipc", "pipe closed (err={})", GetLastError());
        break;
      }
      buf.insert(buf.end(), chunk, chunk + got);
      while (buf.size() >= kHeaderBytes) {
        uint32_t len = read_be32(buf.data());
        if (buf.size() < kHeaderBytes + len) break;
        std::string payload(reinterpret_cast<const char*>(buf.data() + kHeaderBytes), len);
        buf.erase(buf.begin(), buf.begin() + kHeaderBytes + len);
        if (frame_handler_) frame_handler_(payload);
      }
    }

    impl_->running = false;
    if (close_handler_) close_handler_();
  });

  return true;
}

void PipeServer::stop() {
  if (!impl_->running.exchange(false)) {
    if (impl_->worker.joinable()) impl_->worker.join();
    return;
  }
  if (impl_->pipe != INVALID_HANDLE_VALUE) {
    DisconnectNamedPipe(impl_->pipe);
    CloseHandle(impl_->pipe);
    impl_->pipe = INVALID_HANDLE_VALUE;
  }
  if (impl_->worker.joinable()) impl_->worker.join();
}

bool PipeServer::send_frame(std::string_view payload) {
  if (!impl_->running.load()) return false;
  if (impl_->pipe == INVALID_HANDLE_VALUE) return false;
  std::lock_guard lk(impl_->write_mutex);
  uint8_t header[kHeaderBytes];
  write_be32(header, static_cast<uint32_t>(payload.size()));
  DWORD written = 0;
  if (!WriteFile(impl_->pipe, header, kHeaderBytes, &written, nullptr) || written != kHeaderBytes) {
    nb::log::error("ipc", "WriteFile header failed: {}", GetLastError());
    return false;
  }
  if (!payload.empty()) {
    if (!WriteFile(impl_->pipe, payload.data(), static_cast<DWORD>(payload.size()), &written, nullptr)
        || written != payload.size()) {
      nb::log::error("ipc", "WriteFile payload failed: {}", GetLastError());
      return false;
    }
  }
  return true;
}

}  // namespace nb::ipc
