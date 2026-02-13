## Spreadsheet Guide

This spreadsheet is a full armor balancing workbook. It starts from raw armor records, applies balancing rules, and ends with ready to compare final values.
Source spreadsheet: [GAMMA Armor Rework](https://docs.google.com/spreadsheets/d/1FmRZTwhCTGSNaFHi7I9vgO9fXBiU4PeApEzvIwsBsUM/edit).
Use together with [DefaultArmorsTable.md](DefaultArmorsTable.md).

### What The Tabs Are For

- Main armor list (gid `0`): full armor catalog with very high raw stat values and totals. This looks like a source or intermediate sheet used before normalization.
- Faction modifiers armor sheet (gid `1028733983`): armor list in a normalized scale, with faction adjusted stats and easier to compare percentages (for example values around `1.0`, `0.8`, `1.2`).
- Final armor sheet (gid `1614929629`): the final balancing view. It keeps old and new cost side by side and shows the final resistance totals.
- Armor LTX values (gid `416445596`): game style output values, including detailed protection numbers, movement, carry weight, and repair category.
- Ballistic res sections (gid `1501881447`): body zone protection layout (torso, limbs, hands, feet, etc.), used to shape how damage is distributed across body parts.
- LTX multipliers (gid `2091566483`): one row of global conversion multipliers that scales each protection dimension into game facing numbers.
- Faction multipliers (gid `252632958`): per faction adjustment rules. This is where faction identity is expressed (for example stronger ballistic vs weaker anomaly defense patterns).
- Armor types list base values (miro import) (gid `360792445`): a long reference list of base armor type data imported from an external source.
- LTX mult tests (gid `987028631`): a small test tab used to compare expected vs actual conversion outcomes.
- Ballistic damage model tab (gid `1048161069`): damage simulation style table showing how ammo power, armor class, ballistic percentage, and mitigation combine into final damage taken.

### Important Reading Order

1. Start with the normalized armor list (gid `1028733983`) to understand each armor in comparable terms.
2. Check faction and global multipliers (gids `252632958` and `2091566483`) to understand why stats move up or down.
3. Read the final sheet (gid `1614929629`) to see the finished outcome for cost and total resistance.
4. Use the ballistic damage model tab (gid `1048161069`) to understand real combat effect, not just stat labels.
