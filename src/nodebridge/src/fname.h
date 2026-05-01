#pragma once
#include <cstdint>
#include <string>

#include "ue_reflection.h"  // FName

namespace nb::ue {

// UE FString is TArray<TCHAR>. On MSVC x64 with UE 5.1 large-world coords
// TCHAR is WIDECHAR (wchar_t). 16 bytes total.
struct FString {
  wchar_t* data;
  int32_t num;
  int32_t max;
};
static_assert(sizeof(FString) == 16);

// Phase 1: scan all AOB candidates, collect resolved addresses. Does not
// install any as the active FName::ToString — just logs matches. Called at
// DLL attach (before FNamePool may be fully populated).
bool scan_fname_to_string_candidates();

// Phase 2: call each collected candidate with a REAL UObject's FName
// (guaranteed to be in the pool). First one producing non-empty, printable
// output wins. Call only after ue::is_ready() is true.
bool verify_and_install_fname_to_string(const FName& sample);

// Back-compat: calls phase 1 only. Kept so older call sites still compile.
bool resolve_fname_to_string();

// Is FName::ToString resolved and callable?
bool fname_resolver_ready();

// Scan and resolve FName::FName(const wchar_t*, EFindName). Lazy — safe to
// call multiple times; installs on first successful hit.
bool scan_and_install_fname_ctor();

// Bypass AOB: install a caller-supplied address directly (e.g. mainExeBase+RVA).
void install_fname_ctor_at(uint64_t addr);

// Is FName::FName constructor resolved and callable?
bool fname_ctor_ready();

// Register a string in the FName pool (FNAME_Add). Returns {0,0} on failure.
FName fname_from_string(const std::string& utf8);

// Decode an FName to a plain UTF-8 string. Safe to call from any thread
// that won't be blocked by UE's internal locking. Returns "" on failure.
//
// Caveat: UE allocates a wide buffer inside the FString we pass; we read it
// and do NOT free it — we'd need to resolve FMemory::Free (another AOB) to
// do that correctly. A typical FName is < 100 chars, so the leak is modest
// in practice. Cache the result per FName::Value if you call it in hot paths.
std::string fname_to_string(const FName& name);

// Shortcut: get the name of a UObject (pulls its FName at +0x18).
std::string get_object_name(const UObjectBase* obj);

// Shortcut: walk to obj->class_private (UClass*) and return its name.
std::string get_object_class_name(const UObjectBase* obj);

// Full path: "Outer.Outer.Name", walking outer_private chain. Limited to a
// small depth so a cycle (shouldn't happen but be safe) can't hang us.
std::string get_object_full_path(const UObjectBase* obj);

}  // namespace nb::ue
