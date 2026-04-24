#pragma once
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "ue_reflection.h"

namespace nb::ue {

// Partial UE 5.1 FField / FProperty layouts. Comments cite the public UE
// source (Runtime/CoreUObject/Public/UObject/Field.h and PropertyBaseObject.h).
// If S2's GSC fork changed these, the resolver will log unexpected values and
// return nullopt — we prefer "return nothing" over "write to a bogus offset".

struct FField {
  void* vtable;                 // +0x00
  void* class_private;          // +0x08  FFieldClass*
  void* owner_ptr;              // +0x10  FFieldVariant is ptr + flag;
  uint64_t owner_flags;         // +0x18  pack as two uint64 here.
  FField* next;                 // +0x20
  FName name_private;           // +0x28
  uint32_t flags;               // +0x30
  uint32_t _pad34;              // +0x34
};  // +0x38

struct FProperty {
  FField hdr;                   // +0x00..0x38
  int32_t array_dim;            // +0x38
  int32_t element_size;         // +0x3C
  uint64_t property_flags;      // +0x40
  uint16_t rep_index;           // +0x48
  uint8_t bp_rep_cond;          // +0x4A
  uint8_t _pad4B;               // +0x4B
  int32_t offset_internal;      // +0x4C   ← the one we care about
  FName rep_notify_func;        // +0x50
  FProperty* property_link_next;// +0x58
  FProperty* next_ref;          // +0x60
  FProperty* destructor_link;   // +0x68
  FProperty* post_construct;    // +0x70
};  // +0x78

// Offset of `PropertyLink` within UStruct. UStruct layout from UE 5.1:
//   UObjectBase (0x28) + UField::Next (0x08) = UField ends @ 0x30
//   +0x30 SuperStruct        +0x38 Children            +0x40 ChildProperties
//   +0x48 PropertiesSize    +0x4C MinAlignment        +0x50 Script (TArray 16B)
//   +0x60 PropertyLink      +0x68 RefLink             +0x70 DestructorLink
constexpr size_t kUStructPropertyLinkOffset = 0x60;
constexpr size_t kUStructSuperStructOffset = 0x30;

// Treat `obj` as having `obj->ClassPrivate` = a UClass (inherits UStruct).
// Walk its PropertyLink chain (which in UE already includes inherited fields)
// to find a property whose FName decodes to exactly `name`. Returns the
// byte offset within the object, or nullopt on miss.
std::optional<int32_t> find_property_offset(const UObjectBase* obj, std::string_view name);

// Walk every property on the object's class hierarchy, returning {name,
// offset_internal} pairs. Used for diagnostics when a specific property
// can't be found.
struct PropertyEntry { std::string name; int32_t offset; std::string class_name; };
std::vector<PropertyEntry> list_properties(const UObjectBase* obj, int32_t max);

// Simpler: given any struct pointer (UObject or FField), read an FName at
// `name_offset` and decode to UTF-8.
std::string name_at(const void* base, size_t offset);

// Typed reads/writes. Offset-checked against nothing — trust your resolver
// and don't pass a bogus offset. Callers should always source the offset
// from find_property_offset or a logged-verified constant.
void* read_ptr(const void* base, size_t offset);
void write_ptr(void* base, size_t offset, void* value);

// FVector (UE5 large-world coords, 3 × double = 24 bytes).
struct FVector3d {
  double x, y, z;
};
FVector3d read_vector3d(const void* base, size_t offset);
void write_vector3d(void* base, size_t offset, FVector3d v);

}  // namespace nb::ue
