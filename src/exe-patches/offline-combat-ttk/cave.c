/* Offline combat duel, time-to-kill version. Injected into Stalker2-Win64-Shipping.exe by
 * ../offline-combat-ttk.py; build with ./build.sh (gcc -mabi=ms, freestanding, position independent).
 *
 * Vanilla (OfflineCombatSatisfier): each side rolls rand(0..OfflineCombatWeight), higher roll wins,
 * loser dies, winner is untouched. This replaces the two rolls:
 *
 *   effHP   = HP + MEDKIT_HP * medkits
 *   dmg     = BaseDamage * coef_enemy ^ (ArmorPiercing - protection_enemy) * RANK_ACC[rank]
 *             (no weapon: strongest attack ability, baked in attacks.h by gen_attacks.py:
 *              Damage * coef_enemy ^ (ArmorPiercing - protection_enemy);
 *              not in the table: MUTANT_BASE_DMG * (1 - 0.1 * protection_enemy))
 *   dmg    *= OfflineCombatWeight / WEIGHT_REF * rand(0.75 .. 1.25)
 *   burst   = GRENADE_DMG * grenades (* GRENADE_VS_MUTANT against mutants)
 *   TTK     = max(0, effHP_enemy - burst) / dmg          shorter TTK wins
 *   winner HP -= burst_loser + dmg_loser * TTK_winner    (medkits absorb first, HP stays >= 1)
 *
 * Every input is read live from the offline unit model (FUnitModel), so loot and weapon swaps count.
 * Inventory is only read; nothing is consumed.
 * entry.S calls duel(attacker, target); 1 = attacker wins, 0 = target wins.
 */
typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
typedef int i32;
typedef long long i64;

/* game functions and data, reached through jmp/lea stubs in entry.S that the patch script fills in */
void name_addref(void *pool, i32 name);
u8 *proto_lookup(i32 *name);                 /* item prototype by SID name; mirrors IsArtifact */
u8 *weapon_attr(u8 *weapon_proto, u8 *unit); /* NPCWeaponAttributes; null-checks nothing on proto */
u8 *weapon_settings(u8 *attr, u8 *unit);     /* CharacterWeaponSettings for the unit's rank; attr must be non-null */
void set_hp(u8 *unit, float hp);             /* clamps to [0, MaxHP] */
u32 *p_srand_seed(void);
u8 *p_item_pool(void);
u8 *p_name_pool(void);

/* tuning */
#define MEDKIT_HP 50.0f
#define MEDKIT_MAX 5
#define GRENADE_DMG 40.0f
#define GRENADE_MAX 3
#define GRENADE_VS_MUTANT 0.5f /* grenades do less to mutants (no inventory = mutant) */
#define MUTANT_BASE_DMG 16.0f /* per exchange, before the weight multiplier */
#define WEIGHT_REF 10.0f      /* NPCBase weight: plain humans keep their weapon damage */
#define PROT_CAP 4.5f
#define RAND_SPREAD 0.25f
#define NO_KILL 1.0e9f
static const float RANK_ACC[4] = {0.6f, 0.7f, 0.8f, 0.9f};

/* FUnitModel */
#define U_HP 0x148
#define U_RANK 0x1d0
#define U_PROTO 0x658
#define U_INV 0x678
/* ObjPrototype */
#define OP_WEIGHT 0x568
#define OP_COEF_PROJ 0x58a /* half */
/* inventory component */
#define INV_CONTAINER 0x1c0
#define INV_SLOTS 0x1d8
#define SLOT_STRIDE 0x18
#define CONT_DATA 0x110
#define CONT_NUM 0x118
#define CONT_STRIDE 0x10
/* item pool */
#define POOL_CHUNK 0x1000
#define POOL_STRIDE 0x88
/* item object */
#define IT_NAME 0x38
#define IT_COUNT 0x44
/* item prototype */
#define IP_SORTGROUP 0xcf
#define IP_TYPE 0xd0
#define IP_PROT_NPC 0x128
#define TYPE_WEAPON 0
#define TYPE_ARMOR 1
#define TYPE_CONSUMABLE 4
#define TYPE_GRENADE 7
#define SORT_HP 4
#define KEY_STRIKE 0x46
/* weapon settings */
#define WS_BASE_DAMAGE 0xae /* half */
#define WS_ARMOR_PIERCING 0xb8 /* half */

#define MAX_WEAPONS 6
#define MAX_ITEMS 1024

/* FPrototype */
#define P_SID 0xc
/* name pool: chunk pointers, then the header (+8 count); entry = chunk[i >> 10] + (i & 0x3ff) * 0x20 */
#define NP_COUNT 0x20008
#define NE_STR 0x0
#define NE_LEN 0x8

#define RD(T, p, off) (*(T *)((u8 *)(p) + (off)))

typedef union { u32 u; float f; } bits;

#include "attacks.h"


static float half_to_float(u16 h) {
    u32 s = (u32)(h & 0x8000) << 16, e = (h >> 10) & 0x1f, m = h & 0x3ff;
    bits r;
    if (e == 0) {
        r.f = (float)m * (1.0f / 16777216.0f); /* subnormal: m * 2^-24 */
        r.u |= s;
        return r.f;
    }
    if (e == 31) r.u = s | 0x7f800000u | (m << 13);
    else r.u = s | ((e + 112) << 23) | (m << 13);
    return r.f;
}

static float frand(void) { /* FMath::FRand on the game's SRand seed */
    u32 *seed = p_srand_seed();
    *seed = *seed * 0xbb38435u + 0x3619636bu;
    bits r;
    r.u = (*seed >> 9) | 0x3f800000u;
    return r.f - 1.0f;
}

/* 2^x for |x| < ~100 */
static float exp2_(float x) {
    if (x < -100.0f) return 0.0f;
    if (x > 100.0f) x = 100.0f;
    i32 i = (i32)x;
    if ((float)i > x) i--; /* floor */
    float f = x - (float)i, p;
    /* 2^f on [0,1), degree-5 minimax-ish Taylor of e^(f ln2) */
    p = 1.0f + f * (0.6931472f + f * (0.2402265f + f * (0.0555041f + f * (0.0096181f + f * 0.0013334f))));
    bits r;
    r.u = (u32)(i + 127) << 23;
    return p * r.f;
}

/* log2(x) for x > 0 */
static float log2_(float x) {
    bits r;
    r.f = x;
    i32 e = (i32)((r.u >> 23) & 0xff) - 127;
    r.u = (r.u & 0x007fffffu) | 0x3f800000u; /* mantissa in [1,2) */
    float m = r.f;
    if (m > 1.41421356f) { m *= 0.5f; e++; }
    float t = (m - 1.0f) / (m + 1.0f), t2 = t * t; /* ln m = 2 atanh t */
    float ln = 2.0f * t * (1.0f + t2 * (1.0f / 3 + t2 * (1.0f / 5 + t2 * (1.0f / 7))));
    return (float)e + ln * 1.44269504f;
}

static float powf_(float b, float x) { return b <= 0.0f ? 0.0f : exp2_(x * log2_(b)); }

static u8 *item_obj(u32 h) {
    if (h > 0xffffffefu) return 0;
    u32 idx = h & 0x7ffffff;
    u8 *chunk = p_item_pool();
    while (idx >= POOL_CHUNK) {
        chunk = *(u8 **)chunk;
        if (!chunk) return 0;
        idx -= POOL_CHUNK;
    }
    return chunk + 0x10 + (i64)idx * POOL_STRIDE;
}

static u8 *item_proto(u8 *item) {
    if (!item) return 0;
    i32 name = RD(i32, item, IT_NAME);
    if (name <= 0) return 0;
    i32 local = name;
    name_addref(p_name_pool(), name);
    return proto_lookup(&local);
}

/* TMap<int32, float> lookup; a missing key reads as 0 */
static float map_find(u8 *m, i32 key) {
    if (RD(i32, m, 0x8) == RD(i32, m, 0x34)) return 0.0f;
    i32 *buckets = RD(i32 *, m, 0x40);
    if (!buckets) buckets = (i32 *)(m + 0x38);
    i32 size = RD(i32, m, 0x48);
    if (size <= 0) return 0.0f;
    u8 *el = RD(u8 *, m, 0x0);
    i32 i = buckets[key & (size - 1)];
    for (i32 guard = 0; i != -1 && guard < 256; guard++) {
        u8 *e = el + (i64)i * 0x10;
        if (RD(i32, e, 0) == key) return RD(float, e, 4);
        i = RD(i32, e, 8);
    }
    return 0.0f;
}

/* FNV-1a over the lower-cased UTF-16 SID, as in gen_attacks.py; 0 if the name can't be read */
static u32 sid_hash(i32 sid) {
    if (sid <= 0) return 0;
    u8 *pool = p_name_pool();
    if (sid >= RD(i32, pool, NP_COUNT)) return 0;
    u8 *chunk = RD(u8 *, pool, (sid >> 10) * 8);
    if (!chunk) return 0;
    u8 *e = chunk + (sid & 0x3ff) * 0x20;
    u16 *str = RD(u16 *, e, NE_STR);
    i32 len = RD(i32, e, NE_LEN);
    if (!str || len <= 0 || len > 256) return 0;
    u32 h = 0x811c9dc5u;
    for (i32 i = 0; i < len && str[i]; i++) {
        u32 c = str[i];
        if (c >= 'A' && c <= 'Z') c += 32;
        h = (h ^ c) * 0x01000193u;
    }
    return h;
}

static const struct attack *find_attack(u32 h) {
    i32 lo = 0, hi = ATTACK_COUNT - 1;
    while (h && lo <= hi) {
        i32 mid = (lo + hi) >> 1;
        if (ATTACKS[mid].hash == h) return &ATTACKS[mid];
        if (ATTACKS[mid].hash < h) lo = mid + 1;
        else hi = mid - 1;
    }
    return 0;
}

typedef struct {
    u8 *unit;
    float hp, prot, coef, weight, medhp, burst;
    float attack, attack_ap; /* baked strongest ability; attack 0 = not in the table */
    i32 mutant;
    i32 rank, nweap;
    float base[MAX_WEAPONS], ap[MAX_WEAPONS];
} side;

static void add_weapon(side *s, u8 *proto) {
    if (s->nweap >= MAX_WEAPONS) return;
    u8 *attr = weapon_attr(proto, s->unit);
    if (!attr) return;
    u8 *st = weapon_settings(attr, s->unit);
    if (!st) return;
    float base = half_to_float(RD(u16, st, WS_BASE_DAMAGE));
    if (!(base > 0.0f)) return;
    s->base[s->nweap] = base;
    s->ap[s->nweap] = half_to_float(RD(u16, st, WS_ARMOR_PIERCING));
    s->nweap++;
}

static void read_side(side *s, u8 *unit) {
    s->unit = unit;
    s->hp = RD(float, unit, U_HP);
    s->rank = RD(u8, unit, U_RANK);
    if (s->rank > 3) s->rank = 3;
    s->prot = 0.0f;
    s->nweap = 0;
    s->coef = 1.0f;
    s->weight = 0.0f;
    s->attack = 0.0f;
    s->attack_ap = 0.0f;
    u8 *op = RD(u8 *, unit, U_PROTO);
    if (op) {
        s->weight = (float)RD(i32, op, OP_WEIGHT);
        float c = half_to_float(RD(u16, op, OP_COEF_PROJ));
        if (c > 0.0f && c < 100.0f) s->coef = c;
        const struct attack *at = find_attack(sid_hash(RD(i32, op, P_SID)));
        if (at) {
            s->attack = (float)at->dmg;
            s->attack_ap = (float)at->ap16 * (1.0f / 16.0f);
        }
    }
    i32 medkits = 0, grenades = 0;
    u8 *comp = RD(u8 *, unit, U_INV);
    s->mutant = comp == 0;
    if (comp) {
        /* equipped slots: weapons 1..3, head 5, body 6 */
        float armor = 0.0f;
        i32 slots[5] = {1, 2, 3, 5, 6};
        for (i32 k = 0; k < 5; k++) {
            u8 *p = item_proto(item_obj(RD(u32, comp, INV_SLOTS + slots[k] * SLOT_STRIDE)));
            if (!p) continue;
            i32 type = RD(i32, p, IP_TYPE);
            if (type == TYPE_WEAPON) add_weapon(s, p);
            else if (type == TYPE_ARMOR) armor += map_find(p + IP_PROT_NPC, KEY_STRIKE);
        }
        /* backpack: consumables always; weapons/armor only when no slot is filled
         * (units that never went online may have empty slots) */
        i32 need_weap = s->nweap == 0, need_armor = armor == 0.0f;
        float best_armor = 0.0f;
        u8 *cont = RD(u8 *, comp, INV_CONTAINER);
        if (cont) {
            u8 *data = RD(u8 *, cont, CONT_DATA);
            i32 num = RD(i32, cont, CONT_NUM);
            if (num > MAX_ITEMS) num = MAX_ITEMS;
            for (i32 k = 0; data && k < num; k++) {
                u8 *it = item_obj(RD(u32, data, k * CONT_STRIDE));
                u8 *p = item_proto(it);
                if (!p) continue;
                i32 type = RD(i32, p, IP_TYPE), cnt = RD(i32, it, IT_COUNT);
                if (cnt < 1) cnt = 1;
                if (type == TYPE_CONSUMABLE && RD(u8, p, IP_SORTGROUP) == SORT_HP) medkits += cnt;
                else if (type == TYPE_GRENADE) grenades += cnt;
                else if (type == TYPE_WEAPON && need_weap) add_weapon(s, p);
                else if (type == TYPE_ARMOR && need_armor) {
                    float a = map_find(p + IP_PROT_NPC, KEY_STRIKE);
                    if (a > best_armor) best_armor = a;
                }
            }
        }
        s->prot = armor > 0.0f ? armor : best_armor;
        if (s->prot > PROT_CAP) s->prot = PROT_CAP;
        if (s->prot < 0.0f) s->prot = 0.0f;
    }
    if (medkits > MEDKIT_MAX) medkits = MEDKIT_MAX;
    if (grenades > GRENADE_MAX) grenades = GRENADE_MAX;
    s->medhp = MEDKIT_HP * (float)medkits;
    s->burst = GRENADE_DMG * (float)grenades;
}

/* damage per exchange of s against enemy e, before the random spread; weight scales it */
static float damage(side *s, side *e) {
    float best = 0.0f;
    for (i32 k = 0; k < s->nweap; k++) {
        float d = s->base[k] * powf_(e->coef, s->ap[k] - e->prot) * RANK_ACC[s->rank];
        if (d > best) best = d;
    }
    if (best <= 0.0f && s->attack > 0.0f) best = s->attack * powf_(e->coef, s->attack_ap - e->prot);
    if (best <= 0.0f) best = MUTANT_BASE_DMG * (1.0f - 0.1f * e->prot);
    return best * (s->weight > 1.0f ? s->weight : 1.0f) / WEIGHT_REF;
}

static float ttk(side *s, float dmg, side *e) {
    float left = e->hp + e->medhp - s->burst * (e->mutant ? GRENADE_VS_MUTANT : 1.0f);
    if (left <= 0.0f) return 0.0f;
    return dmg > 0.001f ? left / dmg : NO_KILL;
}

static void wound_winner(side *w, side *l, float dmg_l, float ttk_w) {
    float taken = l->burst * (w->mutant ? GRENADE_VS_MUTANT : 1.0f) + dmg_l * ttk_w - w->medhp;
    if (!(taken > 0.0f)) return;
    float hp = w->hp - taken;
    if (hp < 1.0f) hp = 1.0f;
    if (hp < w->hp) set_hp(w->unit, hp);
}

i32 duel(u8 *attacker, u8 *target) {
    side a, t;
    read_side(&a, attacker);
    read_side(&t, target);
    float da = damage(&a, &t) * (1.0f - RAND_SPREAD + 2.0f * RAND_SPREAD * frand());
    float dt = damage(&t, &a) * (1.0f - RAND_SPREAD + 2.0f * RAND_SPREAD * frand());
    float ta = ttk(&a, da, &t), tt = ttk(&t, dt, &a);
    i32 a_wins;
    if (ta < tt) a_wins = 1;
    else if (tt < ta) a_wins = 0;
    else if (ta >= NO_KILL && a.weight != t.weight) a_wins = a.weight > t.weight; /* neither can hurt the other */
    else a_wins = frand() < 0.5f;
    if (a_wins) wound_winner(&a, &t, dt, ta);
    else wound_winner(&t, &a, da, tt);
    return a_wins;
}
