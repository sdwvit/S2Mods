# Verified offsets — Stalker 2 / UE 5.1 build

## EWeather UEnum  (UObject index 7621, base addr changes each launch)

```
UEnum layout (relative to object base):
  +0x28  UField::Next (ptr)
  +0x30  FString CppType  { ptr=0x058d4780 num=9 max=16 }  → "EWeather\0"
  +0x40  TArray<TPair<FName,int64>> Names  { ptr num max }  ← patch target
```

**Names TArray header at UEnum+0x40**
- +0x00 (8 B): data ptr
- +0x08 (4 B): num  (i32)
- +0x0C (4 B): max  (i32)

Each entry = 16 B: `comp:u32 | numF:u32 | value:i64`

### Entries (as of 2026-05-01, num=12 max=12)

| idx | value | FName string                 | comp     |
|-----|-------|------------------------------|----------|
|  0  |   0   | EWeather::Clearly            | 16184395 |
|  1  |   1   | EWeather::Cloudy             | 16184405 |
|  2  |   2   | EWeather::Fogy               | 16184414 |
|  3  |   3   | EWeather::Stormy             | 16184422 |
|  4  |   4   | EWeather::LightRainy         | 16184431 |
|  5  |   5   | EWeather::Rainy              | 16184442 |
|  6  |   6   | EWeather::Thundery           | 16184451 |
|  7  |   7   | EWeather::Emission           | 16184461 |
|  8  |   8   | EWeather::CalmBeforeEmission | 16184471 |
|  9  |   9   | EWeather::Underground        | 16184486 |
| 10  |  10   | EWeather::Count              | 16184498 |
| 11  |  11   | EWeather::EWeather_MAX       | 16184515 |

All `numF` = 0.

### New entries (values 12–21)

Original 12 entries (0–9 weathers + Count=10 + MAX=11) are preserved verbatim so
the game's own `for i < EWeather::Count (==10)` loops never reach the new variants.
New entries are appended at array positions 12–21 with values 12–21.

| idx | value | FName string              |
|-----|-------|---------------------------|
| 12  |  12   | EWeather::HeavyRain       |
| 13  |  13   | EWeather::Blizzard        |
| 14  |  14   | EWeather::Sandstorm       |
| 15  |  15   | EWeather::Hail            |
| 16  |  16   | EWeather::Overcast        |
| 17  |  17   | EWeather::Mist            |
| 18  |  18   | EWeather::Drizzle         |
| 19  |  19   | EWeather::Windy           |
| 20  |  20   | EWeather::Freezing        |
| 21  |  21   | EWeather::Toxic           |

Extension: virtualAlloc(22*16), copy all 12 original entries, append above, patch TArray header at enumBase+0x40.

## FName functions  (verified by patternsleuth offline scan, 2026-05-01)

All addresses are absolute (imageBase = 0x140000000).
AOB primary pattern misses this build — use installFnameCtorAddr(base + RVA).

| Function        | RVA        |
|-----------------|------------|
| FName::FName    | 0xd26be8   |
| FName::ToString | 0xb73bc4   |
