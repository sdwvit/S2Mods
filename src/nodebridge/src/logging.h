#pragma once
#include <format>
#include <string>
#include <string_view>

namespace nb::log {

enum class Level { Debug, Info, Warn, Error };

void init();
void shutdown();
void write(Level level, std::string_view source, std::string_view msg);

// Writes a blank line and a horizontal separator directly to the log,
// without timestamp/level/source prefix. Use at session boundaries
// (DLL attach) to make consecutive launches easy to eyeball.
void banner();

template <typename... Args>
inline void info(std::string_view source, std::format_string<Args...> fmt, Args&&... args) {
  write(Level::Info, source, std::format(fmt, std::forward<Args>(args)...));
}
template <typename... Args>
inline void warn(std::string_view source, std::format_string<Args...> fmt, Args&&... args) {
  write(Level::Warn, source, std::format(fmt, std::forward<Args>(args)...));
}
template <typename... Args>
inline void error(std::string_view source, std::format_string<Args...> fmt, Args&&... args) {
  write(Level::Error, source, std::format(fmt, std::forward<Args>(args)...));
}
template <typename... Args>
inline void debug(std::string_view source, std::format_string<Args...> fmt, Args&&... args) {
  write(Level::Debug, source, std::format(fmt, std::forward<Args>(args)...));
}

}  // namespace nb::log
