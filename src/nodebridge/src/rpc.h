#pragma once
#include <functional>
#include <future>
#include <memory>
#include <string>
#include <string_view>

#include <nlohmann/json.hpp>

namespace nb::ipc { class PipeServer; }

namespace nb::rpc {

using json = nlohmann::json;

// Clean API over the named-pipe IPC layer. Call sites use call/emit/handle/on
// and never see framing. The wire format is length-prefixed JSON; that detail
// lives entirely in this file + ipc_server.
class Router {
 public:
  explicit Router(nb::ipc::PipeServer& pipe);
  ~Router();

  // Request → Node, await response.
  std::future<json> call(std::string_view method, json params = nullptr);

  // Fire-and-forget event → Node.
  void emit(std::string_view name, json payload = nullptr);

  // Register handler for a method the Node side can call.
  void handle(std::string method, std::function<json(const json&)> fn);

  // Register listener for an event name coming from Node.
  void on(std::string name, std::function<void(const json&)> fn);

  // Called by pipe layer whenever a full frame arrives.
  void ingest(std::string_view frame);

  // Call when the pipe is ready / closed.
  void on_pipe_ready();
  void on_pipe_closed();

 private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};

}  // namespace nb::rpc
