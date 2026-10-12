# Detecting another mod from quest logic (POC)

Verified in game on 2026-10-11/12 with WolfArmorFetch reading HeadlessArmors.

## The provider mod

It adds a bool global variable that defaults to true. It only exists while the mod is installed.

`GlobalVariablePrototypes.cfg` patch (`Mods/HeadlessArmors/transformGlobalVariablePrototypes.mts`):

```
HeadlessArmorsInstalled : struct.begin
   SID = HeadlessArmorsInstalled
   Type = EGlobalVariableType::Bool
   DefaultValue = true
struct.end
```

## The consumer mod

The consumer uses one `If` node with a `GlobalVariable` condition on that SID.

Observed behaviour of the If:

| Provider installed | `If (HeadlessArmorsInstalled == X)` fires |
|---|---|
| yes | True when X matches the value, False otherwise |
| no (the variable doesn't exist) | **True, whatever X is** |

So a check for `== true` also passes without the provider. Write the check as **`== false`**:

- **True:** the provider is missing (or reports false). Take the default branch.
- **False:** the provider is installed. Take the provider-specific branch.

```
WolfArmorFetch_If_HeadlessArmors : struct.begin
   NodeType = EQuestNodeType::If
   Conditions : struct.begin
      [0] : struct.begin
         [0] : struct.begin
            ConditionType = EQuestConditionType::GlobalVariable
            ConditionComparance = EConditionComparance::Equal
            GlobalVariablePrototypeSID = HeadlessArmorsInstalled
            ChangeValueMode = EChangeValueMode::Set
            VariableValue = false
         struct.end
      struct.end
   struct.end
struct.end
```

Launch the default action from `Name = True` and the provider action from `Name = False`. See
`Mods/WolfArmorFetch/transformQuestNodes.mts`, step 12. In TypeScript, import the SID from the
provider (`INSTALLED_GLOBAL_VARIABLE_SID`) so the two mods can't drift apart.

## Rules

- **Make each branch a single action.** Don't add the default and then remove or swap it when the
  provider shows up. A swap made while the player watches a container glitched: the old item was
  still shown but couldn't be picked up.
- **Keep provider-only SIDs on the provider branch.** WolfArmorFetch's
  `WolfArmorFetch_StashRewardHeadless` generator names `Exoskeleton_Neutral_Armor_headless`, which
  only exists with HeadlessArmors. That's harmless, because only the False branch uses it.
- **Never let the default path depend on the branch outcome.** Two things that look like fallbacks
  are traps:
  - a `Bridge` check on "did the provider branch run?";
  - the `== true` False pin.

  Without the provider, both take the provider path.
- **Don't let the consumer define the provider's SID as a fallback.** Two mods defining the same
  root SID makes the result depend on load order.

## Unverified

- Whether a game patch changes how a missing variable evaluates. If it starts firing False, the
  provider branch runs for everyone. Retest after major updates.
- Whether the game logs anything for the missing SID. No log was available to check.
