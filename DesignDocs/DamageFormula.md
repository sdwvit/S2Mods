# STALKER 2 damage resolution (retail 1.7-era binary, RE'd)

Source: `Stalker2-Win64-Shipping.exe` (retail, `Binaries/Win64/`, 174,730,288 bytes, mtime 2026-08-28).
All addresses are default-image-base VAs. Constants labelled **[bin]** were read from the
binary, **[cfg]** from `GameLite/GameData`, **[inferred]** where noted.

## The functions

| VA | Role |
|---|---|
| `0x140cb0446` | main hit/damage resolution (~9.5 KB) |
| `0x140cb358f` | pre-scale: friendly-fire scaler x **BoneDamageCoefficients** x headshot difficulty mult |
| `0x140cb2ce6` | picks `ArmorDifferenceCoefProjectiles` / `...MeleeAttacks` off the ObjPrototype by `EDamageSource` |
| `0x140cb3da3` | strike protection getter (effect param id `0x46`) |
| `0x140749799` | protection getter for every other `EDamageType` |
| `0x140cb2d75` | **armor core** — applies the exponential term, calls the two helpers below |
| `0x140cb303e` | deflect/penetration roll |
| `0x140cb3a44` | per-damage-type / per-source armor term |
| `0x1434a856b` | thin wrapper used by 3 other call sites (same core) |

## Pseudocode

```c
// 0x140cb0446 (main), for one hit
float dmg = ctx.Damage;                       // ctx+0x00
float pen = ctx.ArmorPiercing;                // ctx+0x08
uint32 inst = ctx.InstigatorObjIndex;         // ctx+0x20  (0xFFFFFFFF = none)
EDamageType   type = ctx.DamageType;          // ctx+0x78
EDamageSource src  = ctx.DamageSource;        // ctx+0x79

// 1. bone + friendly-fire + headshot  (0x140cb358f)
dmg *= FriendlyFireScaler;                              // 1.0 for hostiles
if (type == Strike && src not in {Explosion, Knife, WeaponButt})
    dmg *= ObjPrototype.BoneDamageCoefficients[boneIdx];  // proto+0x3E0
if (player shooter) dmg *= PlayerWeapon_HeadshotMultiplier;  // difficulty
dmg = max(dmg, 0);

// 2. target protection for this damage type
float prot = (type == Strike) ? GetStrikeProtection(target)   // 0x140cb3da3
                             : GetProtection(target, type);   // 0x140749799
// = armor's Protection.<Type>  +  artifact/effect contributions
//   +  difficulty Armor_Strike_Add / NPC_Armor_Strike_Add,
//   clamped to ObjEffectMaxParamsPrototypes MaxValue, then run through the
//   effect-modifier pass. ProtectionStrike cap = 4.5           [cfg]

// 3. the coefficient base, chosen by damage source   (0x140cb2ce6)
float coef;                                   // half-float fields on ObjPrototype
if (src in {Bullet, BulletHeavy, Buckshot, StrikeVfEOneshot})
    coef = proto[+0x58A];   // ArmorDifferenceCoefProjectiles
else if (src in {ShockWave, BiteSmall, BiteLarge, CutSmall, CutLarge,
                 RamSmall, RamLarge, Knife, WeaponButt})
    coef = proto[+0x58C];   // ArmorDifferenceCoefMeleeAttacks
else coef = 1.0f;           // includes Explosion

// 4. armor core  (0x140cb2d75)
if (ctx.bIgnoreArmor) return dmg;             // ctx+0x18  (ShouldIgnoreArmor)

float expTerm = 1.0f;
if (pen != 0 && type == Strike)
    expTerm = powf(coef, pen - prot);         // <-- THE formula

bool deflected = DeflectRoll(ctx, prot);      // 0x140cb303e
dmg = ArmorTerm(ctx, dmg, prot, deflected, bIsHuman);   // 0x140cb3a44
dmg *= expTerm;
```

```c
// DeflectRoll  0x140cb303e
if (src == Explosion) return false;
if (inst > 0x07FFFFFF) return false;                  // tagged / invalid instigator
float chance = pen - prot + 1.0f;
chance = clamp(chance, ArmorDeflectMinChance, ArmorDeflectMaxChance);
return SRand01() > chance;
```

```c
// ArmorTerm  0x140cb3a44
if (type != Strike) {
    if (type in {Burn, Shock, ChemicalBurn, PSY, Fall, SteamBurn})
        dmg *= (100.0f - prot) * 0.01f;               // percentage resistances
    return dmg;                                        // Radiation etc.: untouched here
}
// type == Strike
if (inst >= 0xFFFFFFF0 && inst != 0xFFFFFFFE) return dmg;   // no armor pass at all
float k;
if ((inst & 0xF8000000) == 0x08000000) k = StrikeAnomalyArmorDifferenceCoef;
else if (src == Explosion)             k = ExplosionArmorDifferenceCoef;
else if (src == Knife || src == WeaponButt) k = PlayerMeleeArmorDifferenceCoef;
else {  // plain bullets land here
    if (deflected) dmg *= bIsHuman ? ArmorDeflectDamageCoefHuman
                                   : ArmorDeflectDamageCoefMutant;
    return dmg;
}
dmg *= max(0.0f, 1.0f - k * min(prot / 5.0f, 1.0f));   // 5.0 is a CoreVariable
return dmg;
```

## What this means

**Bullets (the common case)**

```
final = BaseDamage
      * BoneDamageCoefficients[bone]
      * ArmorDifferenceCoefProjectiles ^ (ArmorPiercing - ProtectionStrike)
      * (7% of the time: ArmorDeflectDamageCoef)
```

With `ArmorDifferenceCoefProjectiles = 2.0` [cfg, human NPCs] every point of strike
protection above the bullet's piercing **halves** damage, and every point of piercing above
protection **doubles** it. Mutants use 1.3-1.5 [cfg], so armor matters much less to them.

### Worked example

Player AK-74 into a human NPC in a Zorya suit, body shot. Every input below is a real
authored value [cfg]:

| Input | Value | Where it is authored |
|---|---|---|
| `BaseDamage` | 23.0 | `GunAK74_ST_Player`, `WeaponData/CharacterWeaponSettingsPrototypes/PlayerWeaponSettingsPrototypes.cfg` |
| `ArmorPiercing` | 1.0 | same |
| `Protection.Strike` | 2.0 | `Zorya_Neutral_Armor`, `ItemPrototypes/ArmorPrototypes.cfg` |
| `BoneDamageCoefficients[Body]` | 1.0 | `ObjPrototypes/GeneralNPCObjPrototypes.cfg` (Head 6.0, Limbs 0.7) |
| `ArmorDifferenceCoefProjectiles` | 2.0 | same (mutant prototypes use 1.3-1.5) |

```
23.0  x  1.0   x  2.0 ^ (1.0 - 2.0)   =  23 x 0.5  =  11.5
         bone       pen - prot = -1
```

11.5 off the NPC's 200 HP -> ~18 shots to kill.

Same shot, other cases:

| Change | Multiplier | Damage |
|---|---|---|
| Headshot (bone 6.0) | 6 x 0.5 | 69.0 |
| Unarmored target (prot 0) | 2^1 = 2.0 | 46.0 |
| Best armor (prot 4.5, the cap) | 2^-3.5 = 0.088 | 2.0 |
| AP ammo, *if* `ArmorPiercingMod 0.5` adds -> pen 1.5 | 2^-0.5 = 0.707 | 16.3 |
| 7% deflect roll fires | x 1.5 | 17.3 |

The exponent dominates everything else: going from `Protection.Strike` 2.0 to 4.5 against
this rifle is a 5.7x survivability swing, larger than any single number in the weapon files.

The AP-ammo row is **[inferred]** - the `2.0^(pen - prot) x boneCoef` core is verified in the
disassembly, but how the ammo `ArmorPiercingMod` / `DamageMod` fields fold into `pen` and
`BaseDamage` was not traced; additivity is assumed from the field name.

**Explosions** get `coef = 1.0`, so the exponential term is inert; they use only the linear
term `1 - 0.5 * min(prot/5, 1)` — max 40% reduction at prot >= 5. They can never deflect.

**Knife / weapon-butt** get *both* terms: `ArmorDifferenceCoefMeleeAttacks ^ (pen - prot)`
and `1 - 0.6 * min(prot/5, 1)`.

**Non-strike damage** (Burn, Shock, ChemicalBurn, PSY, Fall, SteamBurn) is a flat
percentage: `dmg * (100 - prot)/100`, with protections capped at 90 [cfg].

**Health** is just the pool the result is subtracted from — `MaxHP = 100` for the player,
`200` for the human NPC base [cfg], scaled by difficulty `NPC_HP`. `HPThresholdToKill = 0.1`
[cfg]. Nothing in the armor chain reads HP.

## Caveats / not traced

- `ArmorDeflectMinChance = ArmorDeflectMaxChance = 0.93` [cfg], so the clamp in `DeflectRoll`
  **discards** the `pen - prot + 1` computation entirely: the roll is a flat 7% regardless of
  armor, and the effect is a **1.5x damage multiplier** (`ArmorDeflectDamageCoefHuman` /
  `...Mutant`, both 1.5 [cfg]) — not a reduction, despite the name. Verified in the
  disassembly (`minss` then `maxss` against two equal globals; `mulss` on the damage).
  How the returned bool drives VFX/SFX was not traced.
- The `.data` defaults compiled into the binary for these CoreVariables (0.9 / 0.1 / 0.1 /
  0.2 / 1.0) are overwritten by `CoreVariables.cfg` at load; the cfg values are authoritative.
- `ctx+0x20` is an object-pool index (the `idx < 0x400`, stride `0x700` pool walk at
  `0x140cb361d` confirms it). The `(x & 0xF8000000) == 0x08000000` test that selects the
  anomaly coefficient is a tag on that handle; the tagging scheme itself was not traced.
- `ArmorDifferenceCoefProjectiles/MeleeAttacks` are stored as **FP16 half-floats** on the
  ObjPrototype (`proto+0x58A`, `+0x58C`) — the cfg parser at `0x140c0b2c5` converts on load.
  They are wide-string-only field names, i.e. hand-parsed, no UPROPERTY, no validation.
- The difficulty multipliers (`NPC_Weapon_BaseDamage`, `Weapon_BaseDamage`,
  `NPCToPlayerDamageScaler`, `Mutant_BaseDamage`) are applied *before* this chain, upstream of
  `ctx.Damage`; that upstream path was not traced.
