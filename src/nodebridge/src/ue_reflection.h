#pragma once
#include <cstdint>
#include <string>

namespace nb::ue {

// Struct layouts we assume for Stalker 2 (UE 5.1, GSC custom fork).
// These match stock UE 5.1 — if a game patch changes them we'll see
// nonsensical counts and back off. Everything here is read-only for v2.

struct FName {
  uint32_t comparison_index;
  uint32_t number;
};

// Opaque; we only ever hold pointers to these and read specific offsets.
struct UObjectBase {
  void* vtable;            // +0x00
  int32_t object_flags;    // +0x08
  int32_t internal_index;  // +0x0C
  void* class_ptr;         // +0x10  UClass*
  FName name_private;      // +0x18
  void* outer_private;     // +0x20  UObject*
};
static_assert(sizeof(FName) == 8);

// FUObjectItem: per-slot metadata in the array.
struct FUObjectItem {
  UObjectBase* object;       // +0x00
  int32_t flags;             // +0x08
  int32_t cluster_root_index;// +0x0C
  int32_t serial_number;     // +0x10
  int32_t _pad;              // +0x14
};
static_assert(sizeof(FUObjectItem) == 24);

// UE 5.1 chunked UObject array — FChunkedFixedUObjectArray.
struct FChunkedFixedUObjectArray {
  FUObjectItem** objects;          // +0x00  array of NumChunks pointers to chunks
  FUObjectItem* pre_alloc_objects; // +0x08
  int32_t max_elements;            // +0x10
  int32_t num_elements;            // +0x14
  int32_t max_chunks;              // +0x18
  int32_t num_chunks;              // +0x1C
};

// FUObjectArray: the global singleton. We resolve a pointer to this via
// the Stalker 2 AOB from the community UE4SS build.
struct FUObjectArray {
  int32_t obj_first_gc_index;              // +0x00
  int32_t obj_last_non_gc_index;           // +0x04
  int32_t max_objects_not_considered_gc;   // +0x08
  uint8_t open_for_disregard_gc;           // +0x0C
  uint8_t _pad[3];
  FChunkedFixedUObjectArray obj_objects;   // +0x10
};

// Items per chunk in UE 5.1's chunked array. Conventionally 64*1024.
constexpr int32_t kElementsPerChunk = 64 * 1024;

// Try to resolve GUObjectArray via the Stalker 2 AOB. Returns true on
// success; sets an internal pointer used by the other functions.
bool initialize();

// Whether initialize() has successfully resolved the pointer.
bool is_ready();

// Diagnostic pointer; read-only, used for logging.
const FUObjectArray* guobject_array();

// Number of live objects (or -1 if not ready).
int32_t num_objects();

// Get the i-th FUObjectItem, or nullptr if out of range / not ready.
const FUObjectItem* get_item(int32_t index);

}  // namespace nb::ue
