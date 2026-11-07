## STA-36 Chimera vs Rhiemann hydroshock

Goal: a Chimera dies to 14-18 body shots of A045E (.45 ACP HP) from the "Vector" (= Integral-A, `GunIntegral_PP`,
converted to .45 by `GunIntegral_Upgrade_Body_3`) on Hard/Stalker. Load stack: vanilla + Better Ballistics Core
(BB, Workshop 3626682452) + NoAPForMobs + MasterMod.

### Findings (cfgs only)

BB values that change the result (all target vanilla keys, no new SIDs for the Integral/A045E path):

| What | Vanilla | BB | BB file / merge |
|---|---|---|---|
| `GunIntegral_PP_Player.BaseDamage` | 13.0 | **31.5** | PlayerWeaponSettingsPrototypes_BB: same key, no bpatch -> **replaces the whole node** (`refurl=@BaseGame/...;refkey=TemplateSMG`) |
| `GunIntegral_PP_Player.ArmorPiercing` | 2.8 | **1.3125** | same |
| `GunIntegral_PP_Player.EffectiveFireDistanceMin/Max` | 2500 | 3000 | same (full damage to 30 m) |
| `A045E.DamageMod` | 1.9 | **1.5** | AmmoPrototypes_BB, bpatch |
| `A045E.ArmorPiercingMod` | -0.7 | **-0.35** | same |
| `Weapon_BaseDamage` Hard / Stalker | 0.75 | **1.0** | DifficultyPrototypes_patch_BB, bpatch (Medium stays 1.0) |
| `GunIntegral_Upgrade_Barrel_3_2` effect [0] | ArmorPiercingPos10Effect | **ArmorPiercingPos15Effect** | UpgradePrototypes_BB, bpatch |

BB values checked that don't change the result:
- `GunIntegral_Upgrade_Body_3` keeps `DamagePos20Effect` (+20%, vanilla definition; BB doesn't redefine it);
  BB swaps recoil to `RecoilNeg5Effect` and adds `Integral045MagCapacityEffect` (-25% mag). Body_1/2_x carry no
  damage/AP effects (Body_2_2 aim time 5%).
- ProjectilePrototypes_BB `P045`: speed/penetration-trace only, no damage fields. WeaponGeneralSetup_BB
  `GunIntegral_PP`: caliber/attachments only. WeaponPrototypes_BB `GunIntegral_PP`: still points at
  `GunIntegral_PP_Player`.
- BB touches no ObjPrototypes, `ArmorDifferenceCoef*`, `ArmorDeflect*`, or `PlayerWeapon_HeadshotMultiplier`.
  `CoreVariables.cfg_patch_BB` (root folder, not a `.cfg` in `CoreVariables/`) only sets
  `PlayerBulletDropLengthMultiplier`; likely not even loaded as a patch, irrelevant here.

Conflicts / load order:
- **None with NoAPForMobs**: BB never touches mutant prototypes. Chimera stays MaxHP 1400, Strike 0.0001,
  coef 1.5, bones Head 2.0 / Body 1.0 / Limbs 1.0.
- MasterMod vs BB: both bpatch Hard/Stalker difficulty, different fields. Both bpatch Integral upgrade
  `BlockingUpgradePrototypeSIDs[0]` (MasterMod -> `empty`, BB restates vanilla); whichever applies last wins.
  Only decides whether Barrel_3_1 and 3_2 can both be installed; doesn't change the per-shot numbers.
- Aside (not STA-36): MasterMod's generated `DifficultyPrototypes_patch_MasterMod.cfg` puts `Repair_Cost`,
  `Upgrade_Cost`, `Effect_Satiety` at the struct root; vanilla nests them in `EconomyDifficulty` /
  `EnvironmentDifficulty`, so these are likely no-ops. Worth a separate check.

### Current shots-to-kill (BB + NoAPForMobs + MasterMod, MaxHP 1400, Body_3 installed)

Inferred (DamageFormula.md marks it not traced): upgrade % multiplies the base stat;
`dmg = BaseDamage x DamageMod`, `pen = ArmorPiercing + ArmorPiercingMod`. Within 30 m.

```
dmg  = 31.5 x 1.2 (Body_3) x 1.5 (A045E)        = 56.7
pen  = 1.3125 - 0.35                             = 0.9625   (Barrel_3_2: 1.3125 x 1.15 - 0.35 = 1.159)
coef = 1.5 ^ 0.9625 = 1.477                                 (Barrel_3_2: 1.5 ^ 1.159 = 1.600)
body = 56.7 x 1.477 = 83.76 x Weapon_BaseDamage (1.0 on all of Medium/Hard/Stalker)   (Barrel_3_2: 90.72)
```

| Build | Difficulty | Body dmg | Body shots | Head dmg (x2.0) | Head shots |
|---|---|---|---|---|---|
| Body_3 | Medium | 83.76 | 1400/83.76 = 16.7 -> **17** | 167.5 | 8.4 -> **9** |
| Body_3 | Hard | 83.76 | **17** | 167.5 | **9** |
| Body_3 | Stalker | 83.76 | **17** | 167.5 (335.1 if x2 headshot mult applies) | **9** (5) |
| + Barrel_3_2 | Medium | 90.72 | 1400/90.72 = 15.4 -> **16** | 181.4 | 7.7 -> **8** |
| + Barrel_3_2 | Hard | 90.72 | **16** | 181.4 | **8** |
| + Barrel_3_2 | Stalker | 90.72 | **16** | 181.4 (362.9) | **8** (4) |

With the 7% x1.5 deflect roll averaged in: ~16.2 (Body_3) and ~14.9 (Barrel_3_2) body shots.
Without NoAPForMobs (Strike 4.0): body dmg 16.5 / 17.9 -> 85 / 79 body shots.

### Recommendation

**Keep Chimera MaxHP at 1400; no MasterMod change needed** with BB installed. Both builds already land in 14-18
on every difficulty (BB sets Weapon_BaseDamage to 1.0 everywhere, so Medium = Hard = Stalker).
- MaxHP window keeping both builds in 14-18: (1179, 1507]. 1400 is inside it.
- If a centered target is wanted: 1350 gives 17 / 15 (avg 15.6 / 14.4).
- Caveat: the result depends on BB. Without BB (vanilla stats), the same setup takes 21 (Medium) / 27 (Hard)
  body shots and MaxHP 850 would be needed; a MasterMod MaxHP cut would then make BB users' Chimeras
  die in ~10-11 shots. So MasterMod shouldn't encode a BB-specific number.

### Checklist

- [ ] Confirm with the user: BB is part of the target setup, so STA-36 is met with vanilla Chimera HP.
- [ ] In-game check (Hard, BB + NoAPForMobs + MasterMod, Integral-A with Body_3 and no Barrel_3_2, A045E,
      under 30 m): count body shots to kill a Chimera; one test, one number. Expect ~16-17.
- [ ] Only if the count is outside 14-18: rescale MaxHP by observed/expected and add a Chimera
      `VitalParams.MaxHP` bpatch (new `Mods/MasterMod/transformObjPrototypes.mts`, `files = ["/Chimera.cfg"]`,
      registered in `meta.mts`, description line + changenote replaced).
- [ ] Separate follow-up: check whether MasterMod's root-level `Repair_Cost`/`Upgrade_Cost`/`Effect_Satiety`
      in DifficultyPrototypes take effect.
