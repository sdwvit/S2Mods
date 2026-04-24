#pragma once
#include <functional>
#include <memory>
#include <string>
#include <string_view>

namespace nb::ipc {

using FrameHandler = std::function<void(std::string_view)>;
using ReadyHandler = std::function<void()>;
using CloseHandler = std::function<void()>;

class PipeServer {
 public:
  PipeServer();
  ~PipeServer();

  // Starts listening on the named pipe in a background thread.
  // Only one client is ever accepted (the node.exe bootstrap).
  bool start(const std::wstring& pipe_name);
  void stop();

  void on_frame(FrameHandler h) { frame_handler_ = std::move(h); }
  void on_ready(ReadyHandler h) { ready_handler_ = std::move(h); }
  void on_close(CloseHandler h) { close_handler_ = std::move(h); }

  // Writes a single length-prefixed frame. Thread-safe.
  bool send_frame(std::string_view payload);

 private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
  FrameHandler frame_handler_;
  ReadyHandler ready_handler_;
  CloseHandler close_handler_;
};

}  // namespace nb::ipc
