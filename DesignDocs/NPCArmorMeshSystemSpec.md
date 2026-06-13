# NPC Armor Mesh System

How the game swaps an NPC's visual mesh when they wear a helmet or armor item,
using `Light_Duty_Helmet` (Aurora Gas Mask) as a concrete example.

## Overview

The system is **purely data-driven**: no code callback fires when an item is
equipped. Instead, body mesh entries in `AttachMeshPrototypes.cfg` carry an
optional `ItemPrototypeSID` field that **gates** their eligibility inside the
weighted slot-roll performed by the NPC's MeshGenerator.

---

## The five config files involved

| File | Role |
|---|---|
| `ObjPrototypes/GeneralNPCObjPrototypes.cfg` | NPC → MeshGenerator binding |
| `MeshGeneratorPrototypes.cfg` | Slot-based weighted mesh assembly |
| `BodyMeshPrototypes/AttachMeshPrototypes.cfg` | Body mesh assets + item gate |
| `ItemPrototypes/ArmorPrototypes.cfg` | Armor item → MeshPrototype binding |
| `MeshPrototypes.cfg` | Inventory/dropped-item static mesh |

---

## Step-by-step data chain

### 1. NPC ObjPrototype → MeshGenerator

`ObjPrototypes/GeneralNPCObjPrototypes.cfg` (and faction-specific overrides) set
`MeshGeneratorPrototypeSID` on each NPC template:

```
NPCBase : struct.begin
    MeshGeneratorPrototypeSID = STA_03_a_MeshGenerator
    ...
```

A specific NPC may override this; the armor system does not care which generator
is used, only that the generator's slot list includes the right candidates.

### 2. MeshGenerator → slot-based assembly

`MeshGeneratorPrototypes.cfg` defines each `*_MeshGenerator` as a set of named
**attachment slots** (`BodyArmor`, `Face`, `Head`, `Mas`, `Bpa`, `Hea`, …).

Each slot holds a weighted list of `BodyMeshSID` candidates. The engine rolls a
random compatible combination across all slots, eliminating candidates via
`BlockingSlots` and `BlockingBodyMeshes` constraints.

Example (Face slot of `STA_01_a_MeshGenerator`, abbreviated):

```
Face : struct.begin
    SlotName = Face
    Attaches : struct.begin
        [0] : struct.begin
            BodyMeshSID = Fac_30_02          ← plain face, no item gate
            Weight = 1.0
            BlockingBodyMeshes : struct.begin
                [0] = Mas_sta_01_a_fac_30_04_with_Hea     ← blocked if mask chosen
                [1] = Mas_sta_01_a_fac_30_04_without_Hea
                ...
            struct.end
        struct.end
        ...
        [6] : struct.begin
            BodyMeshSID = Fac_30_08_mas_01_a_with_Bpa_sta_03_b_sta_01_with_Hea_sta_01_a
            Weight = 1.0                     ← eligible ONLY if Light_Duty_Helmet equipped
            BlockingSlots : struct.begin
                [0] = Head
                [1] = Bpa
                [2] = Fbe
                [3] = Hea
            struct.end
        struct.end
    struct.end
struct.end
```

### 3. AttachMeshPrototype → item gate (THE KEY)

`BodyMeshPrototypes/AttachMeshPrototypes.cfg` defines what each `BodyMeshSID`
actually is. The optional `ItemPrototypeSID` field is the gate:

```
Fac_30_08_mas_01_a_with_Bpa_sta_03_b_sta_01_with_Hea_sta_01_a : struct.begin
    SID = Fac_30_08_mas_01_a_with_Bpa_sta_03_b_sta_01_with_Hea_sta_01_a
    MeshPath = SkeletalMesh'/Game/_STALKER2/SkeletalMeshes/characters/_fac/mas/
               SM_fac_30_08_mas_01/.../SM_fac_30_08_mas_01_a...'
    BodyMeshType = EBodyMeshType::Head
    ItemPrototypeSID = Light_Duty_Helmet     ← entry is invisible unless item equipped
    bShouldUseParentBound = true
    AdditionalMesh : struct.begin
        [0] : struct.begin
            BodyMeshSID = Bpa_sta_03_b       ← backpack mesh
        struct.end
        [1] : struct.begin
            BodyMeshSID = Fac_20_00_mas_01_c ← chin-strap piece
        struct.end
        ...
    struct.end
    Materials : struct.begin
        [0] : struct.begin
            MaterialGroup = "Face"
            Variations : struct.begin          ← randomised face skin material
                [0] : struct.begin
                    MaterialPath = MI_fac_20_00_a
                    Weight = 1.0
                struct.end
                ...
            struct.end
        struct.end
    struct.end
    SkeletonPath = Skeleton'.../SK_stalker_Skeleton'
struct.end
```

Multiple entries share the same `ItemPrototypeSID = Light_Duty_Helmet` — they
are the per-NPC-archetype variants (different body types / backpack combinations).
The MeshGenerator decides which variant to use via the slot roll.

### 4. Interlocking block system

- **Plain faces block masked variants** by listing them in `BlockingBodyMeshes`.
  Once a masked face wins the roll, the plain faces cannot also be placed.
- **Masked variants block secondary slots** via `BlockingSlots: Head, Hea, Bpa, Fbe`
  so no separate head-slot accessory stacks on top of a pre-baked mask mesh.

Together these ensure:
- Item equipped → masked face variants become eligible; plain faces are excluded
  by the constraint that at most one Face entry is chosen and masked variants
  carry `BlockingBodyMeshes` references that suppress the alternatives.
- Item not equipped → masked entries are gated out; only plain faces are chosen.

### 5. Inventory/dropped-item mesh (separate concern)

`ArmorPrototypes.cfg` sets `MeshPrototypeSID = Light_Duty_Helmet` on the item.
`MeshPrototypes.cfg` resolves this to a **StaticMesh** (the folded mask model):

```
Light_Duty_Helmet : struct.begin
    ID = 319
    SID = Light_Duty_Helmet
    MeshPath = StaticMesh'.../SM_fol_fac_20_00_mas_01_a...'
struct.end
```

This is **only** the dropped / inventory representation. It has no effect on
the worn NPC mesh.

---

## Full chain at a glance

```
NPC ObjPrototype
  └─ MeshGeneratorPrototypeSID = STA_01_a_MeshGenerator

MeshGeneratorPrototypes : STA_01_a_MeshGenerator
  └─ Face slot → weighted BodyMeshSID list
       ├─ Fac_30_02          (no ItemPrototypeSID — always eligible)
       ├─ Fac_30_08          (no ItemPrototypeSID — always eligible)
       └─ Fac_30_08_mas_01_a_with_Bpa_sta_03_b_sta_01_with_Hea_sta_01_a
            └─ ItemPrototypeSID = Light_Duty_Helmet  ← gated

AttachMeshPrototypes : Fac_30_08_mas_01_a_with_Bpa_sta_03_b_...
  ├─ MeshPath = SK_fac_30_08_mas_01_a  (gas-mask face skeletal mesh)
  ├─ BodyMeshType = EBodyMeshType::Head
  ├─ ItemPrototypeSID = Light_Duty_Helmet
  └─ AdditionalMesh: [Bpa_sta_03_b, Fac_20_00_mas_01_c, ...]

ArmorPrototypes : Light_Duty_Helmet
  └─ MeshPrototypeSID = Light_Duty_Helmet

MeshPrototypes : Light_Duty_Helmet
  └─ MeshPath = SM_fol_fac_20_00_mas_01_a  (inventory static mesh only)
```

---

## Implications for modding

- To add a **new helmet** that visually changes NPCs, you must:
  1. Add an `ArmorPrototypes` entry with a new `SID` and `MeshPrototypeSID`.
  2. Add a `MeshPrototypes` entry for the dropped-item mesh.
  3. Add one or more `AttachMeshPrototypes` entries with `ItemPrototypeSID = <your SID>`
     and `BodyMeshType = EBodyMeshType::Head` pointing to the worn skeletal mesh.
  4. Add those `BodyMeshSID`s to the relevant `*_MeshGenerator`'s slot list with
     appropriate `BlockingSlots` / `BlockingBodyMeshes` constraints.

- A helmet item with **no corresponding AttachMeshPrototype** entry will equip
  fine in inventory but NPCs wearing it will show no visual change.

- The `ItemPrototypeSID` gate applies regardless of whether the item is pre-placed
  in the NPC's loadout or picked up at runtime; the mesh system evaluates
  equipped items when compositing the character.
