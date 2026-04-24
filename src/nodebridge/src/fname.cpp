#include "fname.h"

#include <windows.h>

#include <algorithm>
#include <atomic>
#include <codecvt>
#include <locale>
#include <mutex>
#include <string>
#include <vector>

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
// Two kinds of patterns:
//  - "callsite": pattern ends in the E8 of a CALL to FName::ToString; we
//    read disp32 after the E8 and compute the target.
//  - "entry": pattern is the function's own prologue; the match address IS
//    the function. No disp arithmetic.
//
// Entry patterns are less precise but avoid the CALL-site question of
// "which register was this in at THIS particular caller". Only downside:
// the prologue must be unique enough not to match every function in the
// module.
enum class AobKind { Callsite, Entry };
struct AobCandidate {
  const char* name;
  const char* pattern;
  AobKind kind;
  // For Callsite: byte offset of the E8 inside the match.
  int call_offset;
  // Trusted patterns get auto-accepted on hit. Untrusted ones are logged
  // only — we'd rather miss FName resolution entirely than blindly call
  // an unrelated function (which tends to crash the game).
  bool trusted;
};

constexpr AobCandidate kFNameToStringCandidates[] = {
    // Callsite patterns: match a CALL whose target is FName::ToString. The
    // zero-RAX + LEA RDX,[RSP+X] + MOV RCX,this + MOV [RSP+X],RAX × 2 + E8
    // sequence is very specific — trusted.
    {"cs.zero-RDI-0x20",  "C3 33 C0 48 8D 54 24 20 48 8B CF 48 89 44 24 20 48 89 44 24 28 E8", AobKind::Callsite, 21, true},
    {"cs.zero-any-0x20",  "C3 33 C0 48 8D 54 24 20 48 8B ?? 48 89 44 24 20 48 89 44 24 28 E8", AobKind::Callsite, 21, true},
    {"cs.zero-any-Rsp?",  "C3 33 C0 48 8D 54 24 ?? 48 8B ?? 48 89 44 24 ?? 48 89 44 24 ?? E8", AobKind::Callsite, 21, true},
    {"cs.zero-R8-15",     "C3 33 C0 48 8D 54 24 ?? 49 8B ?? 48 89 44 24 ?? 48 89 44 24 ?? E8", AobKind::Callsite, 21, true},
    // No-zero variant: a few more matches, some false positives — trust it
    // only if nothing else hits.
    {"cs.no-zero-any",    "48 8D 54 24 ?? 48 8B ?? 48 89 44 24 ?? 48 89 44 24 ?? E8", AobKind::Callsite, 19, false},

    // Function-entry prologues with distinctive FName body. The 8B 41 04
    // (read [RCX+4] = FName.Number) right after the prologue is basically a
    // fingerprint for FName methods — trusted.
    {"entry.save-rbx-rdi-read4",     "48 89 5C 24 ?? 57 48 83 EC ?? 8B 41 04",              AobKind::Entry, 0, true},
    {"entry.save-rbx-rsi-rdi-read4", "48 89 5C 24 ?? 48 89 74 24 ?? 57 48 83 EC ?? 8B 41 04", AobKind::Entry, 0, true},
    // Generic prologues — too common. Log only; don't accept.
    {"entry.push-rbp-rsi-rdi", "40 55 56 57 48 81 EC ?? ?? ?? ??",                        AobKind::Entry, 0, false},
    {"entry.push-rbp-many",    "40 53 55 56 57 41 54 41 56 41 57 48 83 EC",               AobKind::Entry, 0, false},
};

// Typed fn ptr. MSVC x64 passes `this` in RCX, &out in RDX — plain function
// pointer works for a member fn at the ABI level.
using FNameToString_Fn = void (*)(const FName*, FString*);
std::atomic<FNameToString_Fn> g_fname_to_string{nullptr};
std::atomic<bool> g_resolver_tried{false};

// Collected resolved addresses from phase 1, kept for phase 2 verification
// once FNamePool is populated.
struct ResolvedCandidate { const char* name; const uint8_t* target; bool trusted; };
std::vector<ResolvedCandidate> g_pending_candidates;
std::atomic<bool> g_phase1_done{false};

// Run fn(&test, &out) inside SEH guard. Returns true iff the call didn't
// crash AND produced a plausible UTF-16 string (first char printable ASCII).
// Compiled as extern "C" + no local C++ objects so __try works under /EHsc.
extern "C" {
static int nb_try_fname_tostring(void* fn_raw, void* name_raw, void* out_raw) {
  auto fn = reinterpret_cast<void (*)(const void*, void*)>(fn_raw);
  __try {
    fn(name_raw, out_raw);
    return 1;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return 0;
  }
}
}

bool verify_fname_to_string(FNameToString_Fn fn) {
  if (!fn) return false;
  FName test{0, 0};  // FName 0 = "None" in every UE build
  FString out{};
  int ok = nb_try_fname_tostring(reinterpret_cast<void*>(fn), &test, &out);
  if (!ok) return false;
  if (!out.data || out.num < 2) return false;
  wchar_t c = out.data[0];
  return c >= L' ' && c <= L'~';  // leaks out.data on success; accepted.
}

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

bool scan_fname_to_string_candidates() {
  if (g_phase1_done.exchange(true)) return !g_pending_candidates.empty();

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
    const uint8_t* target = nullptr;
    if (cand.kind == AobKind::Callsite) {
      const uint8_t* call_instr = hit + cand.call_offset;
      const uint8_t* next_instr = call_instr + 5;
      int32_t disp = *reinterpret_cast<const int32_t*>(call_instr + 1);
      target = next_instr + disp;
    } else {
      target = hit;
    }
    nb::log::info("fname", "candidate '{}' (trusted={}) hit={} → ToString={}",
                  cand.name, cand.trusted ? "yes" : "no",
                  static_cast<const void*>(hit), static_cast<const void*>(target));
    g_pending_candidates.push_back({cand.name, target, cand.trusted});
  }

  // Stable sort: trusted first.
  std::stable_sort(g_pending_candidates.begin(), g_pending_candidates.end(),
                   [](const ResolvedCandidate& a, const ResolvedCandidate& b) {
                     return a.trusted && !b.trusted;
                   });
  return !g_pending_candidates.empty();
}

bool verify_and_install_fname_to_string(const FName& sample) {
  if (g_fname_to_string.load()) return true;  // already installed
  for (const auto& r : g_pending_candidates) {
    auto fn = reinterpret_cast<FNameToString_Fn>(const_cast<uint8_t*>(r.target));
    FString out{};
    int ok = nb_try_fname_tostring(reinterpret_cast<void*>(fn),
                                   const_cast<FName*>(&sample), &out);
    bool looks_good = ok && out.data && out.num >= 2 && out.num < 256 &&
                      out.data[0] >= L' ' && out.data[0] <= L'~';
    nb::log::info(
        "fname",
        "verify '{}' ({}): ok={} num={} data={} first=U+{:04x}",
        r.name, r.trusted ? "trusted" : "untrusted",
        ok ? 1 : 0, out.num,
        static_cast<const void*>(out.data),
        out.data ? static_cast<uint32_t>(out.data[0]) : 0);
    if (looks_good) {
      g_fname_to_string.store(fn);
      nb::log::info("fname", "accepted '{}' as FName::ToString", r.name);
      return true;
    }
  }
  nb::log::warn("fname", "no candidate passed verification against sample FName");
  return false;
}

bool resolve_fname_to_string() { return scan_fname_to_string_candidates(); }

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
