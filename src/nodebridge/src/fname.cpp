#include "fname.h"

#include <atomic>
#include <codecvt>
#include <locale>
#include <mutex>
#include <string>

#include "aob_scanner.h"
#include "logging.h"

namespace nb::ue {

namespace {

// UE4SS's default FName_ToString signature (from FName_ToString.lua.example
// shipped with the downloaded S2 UE4SS build). A common MSVC x64 prologue:
//   C3              RET                 (end of prior fn)
//   33 C0           XOR EAX, EAX
//   48 8D 54 24 20  LEA RDX, [RSP+0x20]  (out FString)
//   48 8B CF        MOV RCX, RDI         (this FName*)
//   48 89 44 24 20  MOV [RSP+0x20], RAX
//   48 89 44 24 28  MOV [RSP+0x28], RAX
//   E8 ?? ?? ?? ??  CALL FName::ToString(FString&)
constexpr std::string_view kFNameToStringPattern =
    "C3 33 C0 48 8D 54 24 20 48 8B CF 48 89 44 24 20 48 89 44 24 28 E8";

// Typed fn ptr. MSVC x64 passes `this` in RCX, &out in RDX — plain function
// pointer works for a member fn at the ABI level.
using FNameToString_Fn = void (*)(const FName*, FString*);
std::atomic<FNameToString_Fn> g_fname_to_string{nullptr};
std::atomic<bool> g_resolver_tried{false};

std::string wide_to_utf8(const wchar_t* ws, size_t len) {
  if (!ws || len == 0) return {};
  // std::wstring_convert is deprecated but still works — good enough for our
  // use case. If it becomes a problem, swap for WideCharToMultiByte directly.
  std::wstring_convert<std::codecvt_utf8_utf16<wchar_t>, wchar_t> conv;
  try {
    return conv.to_bytes(ws, ws + len);
  } catch (...) {
    return {};
  }
}

}  // namespace

bool resolve_fname_to_string() {
  if (g_resolver_tried.exchange(true)) {
    return g_fname_to_string.load() != nullptr;
  }

  auto pattern = nb::aob::parse(kFNameToStringPattern);
  if (!pattern.valid()) {
    nb::log::error("fname", "kFNameToStringPattern failed to parse");
    return false;
  }
  const uint8_t* hit = nb::aob::scan_main_exe(pattern);
  if (!hit) {
    nb::log::warn("fname", "FName::ToString AOB not found in main exe");
    return false;
  }
  nb::log::info("fname", "FName::ToString AOB hit at {}", static_cast<const void*>(hit));

  // Post-processing mirrors UE4SS's Lua: the E8 byte is at offset (AOBSize-1) = 21.
  const uint8_t* call_instr = hit + 21;  // points at E8
  const uint8_t* next_instr = call_instr + 5;
  int32_t disp = *reinterpret_cast<const int32_t*>(call_instr + 1);
  const uint8_t* target = next_instr + disp;
  nb::log::info("fname", "FName::ToString resolved at {}", static_cast<const void*>(target));

  g_fname_to_string.store(reinterpret_cast<FNameToString_Fn>(const_cast<uint8_t*>(target)));
  return true;
}

bool fname_resolver_ready() { return g_fname_to_string.load() != nullptr; }

std::string fname_to_string(const FName& name) {
  FNameToString_Fn fn = g_fname_to_string.load();
  if (!fn) return {};
  FString out{};
  try {
    fn(&name, &out);
  } catch (...) {
    return {};
  }
  if (!out.data || out.num <= 0) return {};
  // num includes the trailing L'\0'; skip it.
  size_t len = static_cast<size_t>(out.num - 1);
  return wide_to_utf8(out.data, len);
  // NOTE: leaks out.data. See fname.h comment.
}

std::string get_object_name(const UObjectBase* obj) {
  if (!obj) return {};
  return fname_to_string(obj->name_private);
}

std::string get_object_class_name(const UObjectBase* obj) {
  if (!obj || !obj->class_ptr) return {};
  const auto* cls = reinterpret_cast<const UObjectBase*>(obj->class_ptr);
  return fname_to_string(cls->name_private);
}

std::string get_object_full_path(const UObjectBase* obj) {
  if (!obj) return {};
  // Walk outer chain, cap at 8 to defensively stop loops.
  std::string parts[8]{};
  int depth = 0;
  const UObjectBase* cur = obj;
  while (cur && depth < 8) {
    parts[depth++] = fname_to_string(cur->name_private);
    cur = reinterpret_cast<const UObjectBase*>(cur->outer_private);
  }
  std::string full;
  for (int i = depth - 1; i >= 0; --i) {
    if (!full.empty()) full += '.';
    full += parts[i];
  }
  return full;
}

}  // namespace nb::ue
