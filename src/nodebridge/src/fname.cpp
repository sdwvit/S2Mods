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

// Multiple candidate AOBs for FName::ToString in UE 5.x games. The common
// shape is a callsite just after a RET, where the caller zeros a stack
// FString, loads `this` into RCX from wherever it lives (RDI / RBX / RSI /
// R14 / R15), loads &FString into RDX from [RSP+X], and CALLs ToString.
// We match whichever register holds `this` by accepting any 3rd byte on
// the `48 8B ??` MOV (or `49 8B ??` for R8-R15).
//
// All of these use the same post-processing: the E8 byte sits at
// (match_addr + AOBSize - 1), and the CALL target = NextInstr + disp32.
struct AobCandidate {
  const char* name;
  const char* pattern;
  // Byte offset of the E8 inside the match (the CALL opcode).
  int call_offset;
};

constexpr AobCandidate kFNameToStringCandidates[] = {
    {"zero-RDI-0x20", "C3 33 C0 48 8D 54 24 20 48 8B CF 48 89 44 24 20 48 89 44 24 28 E8", 21},
    {"zero-any-0x20", "C3 33 C0 48 8D 54 24 20 48 8B ?? 48 89 44 24 20 48 89 44 24 28 E8", 21},
    {"zero-any-Rsp?", "C3 33 C0 48 8D 54 24 ?? 48 8B ?? 48 89 44 24 ?? 48 89 44 24 ?? E8", 21},
    {"zero-R8-15",    "C3 33 C0 48 8D 54 24 ?? 49 8B ?? 48 89 44 24 ?? 48 89 44 24 ?? E8", 21},
    // No-zero variant: caller already has FString pre-zeroed, so only the
    // MOV RDX,[...]+MOV RCX,this+CALL remain. More matches but also more
    // false positives — we log the resolved address for every hit.
    {"no-zero-any",   "48 8D 54 24 ?? 48 8B ?? 48 89 44 24 ?? 48 89 44 24 ?? E8", 19},
};

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

  for (const auto& cand : kFNameToStringCandidates) {
    auto pattern = nb::aob::parse(cand.pattern);
    if (!pattern.valid()) {
      nb::log::error("fname", "pattern '{}' failed to parse", cand.name);
      continue;
    }
    const uint8_t* hit = nb::aob::scan_main_exe(pattern);
    if (!hit) {
      nb::log::info("fname", "candidate '{}' no match", cand.name);
      continue;
    }
    const uint8_t* call_instr = hit + cand.call_offset;
    const uint8_t* next_instr = call_instr + 5;
    int32_t disp = *reinterpret_cast<const int32_t*>(call_instr + 1);
    const uint8_t* target = next_instr + disp;
    nb::log::info("fname", "candidate '{}' hit={} → ToString={}",
                  cand.name, static_cast<const void*>(hit),
                  static_cast<const void*>(target));
    if (g_fname_to_string.load() == nullptr) {
      g_fname_to_string.store(reinterpret_cast<FNameToString_Fn>(const_cast<uint8_t*>(target)));
      nb::log::info("fname", "accepting '{}' as FName::ToString", cand.name);
    }
  }

  if (g_fname_to_string.load() == nullptr) {
    nb::log::warn("fname", "all FName::ToString candidates missed; names will be empty");
    return false;
  }
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
