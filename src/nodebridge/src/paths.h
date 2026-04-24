#pragma once
#include <filesystem>
#include <string>

namespace nb::paths {
// Directory containing the loaded DLL (game's Binaries/Win64 in shipping; build dir during dev).
std::filesystem::path dll_dir();
// <dll_dir>/NodeBridge/
std::filesystem::path root();
// <dll_dir>/NodeBridge/node/node.exe
std::filesystem::path node_exe();
// <dll_dir>/NodeBridge/runtime/bootstrap.mjs
std::filesystem::path bootstrap_mjs();
// <dll_dir>/NodeBridge/mods/
std::filesystem::path mods_dir();
// <dll_dir>/NodeBridge/logs/bridge.log
std::filesystem::path log_file();
// Named pipe full path; unique per PID to avoid cross-launch collisions.
std::wstring pipe_name();
}  // namespace nb::paths
