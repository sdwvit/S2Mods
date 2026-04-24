#include "logging.h"

#include <windows.h>

#include <chrono>
#include <filesystem>
#include <format>
#include <fstream>
#include <mutex>

#include "paths.h"

namespace nb::log {

namespace {
std::mutex g_mutex;
std::ofstream g_stream;
bool g_ready = false;

const char* level_name(Level l) {
  switch (l) {
    case Level::Debug: return "DEBUG";
    case Level::Info:  return "INFO ";
    case Level::Warn:  return "WARN ";
    case Level::Error: return "ERROR";
  }
  return "?";
}
}  // namespace

void init() {
  std::lock_guard lk(g_mutex);
  if (g_ready) return;
  try {
    auto path = nb::paths::log_file();
    std::filesystem::create_directories(path.parent_path());
    g_stream.open(path, std::ios::app);
    g_ready = g_stream.is_open();
  } catch (...) {
    g_ready = false;
  }
}

void shutdown() {
  std::lock_guard lk(g_mutex);
  if (g_stream.is_open()) g_stream.close();
  g_ready = false;
}

void write(Level level, std::string_view source, std::string_view msg) {
  std::lock_guard lk(g_mutex);
  if (!g_ready) return;
  auto now = std::chrono::system_clock::now();
  auto line = std::format("{:%F %T} [{}] [{}] {}\n", now, level_name(level), source, msg);
  g_stream << line;
  g_stream.flush();
}

void banner() {
  std::lock_guard lk(g_mutex);
  if (!g_ready) return;
  g_stream << "\n"
           << "================================================================================\n";
  g_stream.flush();
}

}  // namespace nb::log
