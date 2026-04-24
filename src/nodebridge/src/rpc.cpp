#include "rpc.h"

#include <atomic>
#include <mutex>
#include <unordered_map>

#include "ipc_server.h"
#include "logging.h"

namespace nb::rpc {

struct Router::Impl {
  nb::ipc::PipeServer& pipe;
  std::atomic<uint64_t> next_id{1};
  std::mutex mu;
  std::unordered_map<uint64_t, std::promise<json>> pending;
  std::unordered_map<std::string, std::function<json(const json&)>> handlers;
  std::unordered_map<std::string, std::vector<std::function<void(const json&)>>> listeners;

  explicit Impl(nb::ipc::PipeServer& p) : pipe(p) {}

  void send(const json& msg) {
    auto s = msg.dump();
    pipe.send_frame(s);
  }
};

Router::Router(nb::ipc::PipeServer& pipe) : impl_(std::make_unique<Impl>(pipe)) {
  pipe.on_frame([this](std::string_view f) { ingest(f); });
  pipe.on_ready([this]() { on_pipe_ready(); });
  pipe.on_close([this]() { on_pipe_closed(); });
}
Router::~Router() = default;

std::future<json> Router::call(std::string_view method, json params) {
  uint64_t id = impl_->next_id.fetch_add(1);
  std::promise<json> p;
  auto fut = p.get_future();
  {
    std::lock_guard lk(impl_->mu);
    impl_->pending.emplace(id, std::move(p));
  }
  impl_->send({
      {"type", "request"},
      {"id", id},
      {"method", std::string(method)},
      {"params", std::move(params)},
  });
  return fut;
}

void Router::emit(std::string_view name, json payload) {
  impl_->send({
      {"type", "event"},
      {"name", std::string(name)},
      {"payload", std::move(payload)},
  });
}

void Router::handle(std::string method, std::function<json(const json&)> fn) {
  std::lock_guard lk(impl_->mu);
  impl_->handlers[std::move(method)] = std::move(fn);
}

void Router::on(std::string name, std::function<void(const json&)> fn) {
  std::lock_guard lk(impl_->mu);
  impl_->listeners[std::move(name)].push_back(std::move(fn));
}

void Router::ingest(std::string_view frame) {
  json msg;
  try {
    msg = json::parse(frame);
  } catch (const std::exception& e) {
    nb::log::warn("rpc", "bad json frame: {}", e.what());
    return;
  }

  auto type = msg.value("type", std::string{});
  if (type == "response") {
    uint64_t id = msg.value("id", 0ULL);
    std::promise<json> promise;
    {
      std::lock_guard lk(impl_->mu);
      auto it = impl_->pending.find(id);
      if (it == impl_->pending.end()) return;
      promise = std::move(it->second);
      impl_->pending.erase(it);
    }
    if (msg.contains("error") && !msg["error"].is_null()) {
      try {
        throw std::runtime_error(msg["error"].get<std::string>());
      } catch (...) {
        promise.set_exception(std::current_exception());
      }
    } else {
      promise.set_value(msg.value("result", json(nullptr)));
    }
    return;
  }

  if (type == "request") {
    auto method = msg.value("method", std::string{});
    uint64_t id = msg.value("id", 0ULL);
    std::function<json(const json&)> fn;
    {
      std::lock_guard lk(impl_->mu);
      auto it = impl_->handlers.find(method);
      if (it != impl_->handlers.end()) fn = it->second;
    }
    json response = {{"type", "response"}, {"id", id}};
    if (!fn) {
      response["error"] = "no handler: " + method;
    } else {
      try {
        response["result"] = fn(msg.value("params", json(nullptr)));
      } catch (const std::exception& e) {
        response["error"] = e.what();
      }
    }
    impl_->send(response);
    return;
  }

  if (type == "event") {
    auto name = msg.value("name", std::string{});
    std::vector<std::function<void(const json&)>> copy;
    {
      std::lock_guard lk(impl_->mu);
      auto it = impl_->listeners.find(name);
      if (it != impl_->listeners.end()) copy = it->second;
    }
    const auto& payload = msg.value("payload", json(nullptr));
    for (auto& cb : copy) {
      try {
        cb(payload);
      } catch (const std::exception& e) {
        nb::log::warn("rpc", "listener for {} threw: {}", name, e.what());
      }
    }
  }
}

void Router::on_pipe_ready() { nb::log::info("rpc", "pipe ready"); }

void Router::on_pipe_closed() {
  std::lock_guard lk(impl_->mu);
  for (auto& [id, promise] : impl_->pending) {
    try {
      throw std::runtime_error("pipe closed");
    } catch (...) {
      promise.set_exception(std::current_exception());
    }
  }
  impl_->pending.clear();
}

}  // namespace nb::rpc
