// NPC lookup (native A-Life unit pool) and relation reads/writes (GSC::Relations records), done in JS
// over readMemory/writeMemory. Layouts are per game build (BUILD_LAYOUTS); other builds get an error.
// Unit pool layout: the Living Zone Tracker's native_reader (verified there against the live game).
// Relation records: live probe 2026-11-19 (record (player 3, NPC 1151) changed with XSetRelationsInRadius).

/** The subset of Bridge this module uses, so it also runs against a /proc/<pid>/mem test double. */
export interface MemBridge {
  game: {
    readMemory(addr: number, count?: number): Promise<any>;
    writeMemory(addr: number, hex: string): Promise<any>;
  };
  log: ((msg: string) => void) & { warn?(msg: string): void };
}

export interface BuildLayout {
  unitPool: number; // RVA of the first chunk: { next ptr, int32 count }, records at chunk+16+i*0x700
  sidPositive: number; // RVA of the SID string table (index >= 0), 1024 FStrings of 32 bytes per block
  sidNegative: number;
  factionBucketCount: number;
  factionBuckets: number;
  globalVariableManager: number; // RVA of the UGlobalVariableManager* static (101 code refs)
}

/** Keyed by getBuildId ("<PE TimeDateStamp>-<SizeOfImage>"). */
export const BUILD_LAYOUTS: Record<string, BuildLayout> = {
  // exe sha256 b78e3471...d772ef5
  "2b1aeebf-b954000": {
    unitPool: 0xa2f7a00,
    sidPositive: 0xb10ee88,
    sidNegative: 0xb12ee18,
    factionBucketCount: 0xb0f5f18,
    factionBuckets: 0xb0f5f10,
    globalVariableManager: 0xa2c85f0,
  },
};

const UNIT_STRIDE = 0x700;
const UNIT_READ = 0x6f0;
const U = {
  uid: 0x10,
  flags: 0x14,
  pos: 0x28,
  dead: 0x88,
  faction: 0x120,
  subject: 0x140,
  health: 0x148,
  rank: 0x1d0,
  state: 0x224,
  proto: 0x658,
};
const R = { next: 0x0, a: 0x28, b: 0x30, value: 0x38, size: 0x40 };
const RELATION_SELF = 100000;

// UGlobalVariableManager: TSet of {FName SID, int32 value, int32 type} at +0x80 (live probe 2026-11-19).
// TSparseArray: data ptr, num, max @+0x80; TBitArray allocation flags inline @+0x90 (4 dwords) or heap ptr @+0xa0, bits @+0xa8.
const GV = { set: 0x80, flagsInline: 0x90, flagsHeap: 0xa0, numBits: 0xa8, stride: 0x1c, value: 8, type: 0xc };
const GV_TYPES = ["Int", "String", "Bool"] as const; // EGlobalVariableType order in memory; String values are SID indices
export interface GlobalVariable {
  sid: string;
  type: (typeof GV_TYPES)[number] | number;
  value: number | boolean | string | null;
  raw: number;
}

export function relationLevel(v: number): string {
  if (v === RELATION_SELF) return "Self";
  if (v <= -800) return "Enemy";
  if (v <= -201) return "Disaffection";
  if (v <= 200) return "Neutral";
  return "Friend";
}

// ---------------------------------------------------------------------------
// byte helpers (local so the module has no runtime import)

function hexToBytes(hex: string): Uint8Array {
  const c = hex.replace(/[^0-9a-fA-F]/g, "");
  const b = new Uint8Array(c.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(c.slice(i * 2, i * 2 + 2), 16);
  return b;
}
const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const u32 = (b: Uint8Array, o: number) => dv(b).getUint32(o, true);
const i32 = (b: Uint8Array, o: number) => dv(b).getInt32(o, true);
const u64 = (b: Uint8Array, o: number) =>
  dv(b).getUint32(o + 4, true) * 0x100000000 + dv(b).getUint32(o, true);
const i64 = (b: Uint8Array, o: number) => Number(dv(b).getBigInt64(o, true));
const f32 = (b: Uint8Array, o: number) => dv(b).getFloat32(o, true);
const i32Hex = (v: number) => {
  const b = new Uint8Array(4);
  dv(b).setInt32(0, v, true);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};
const isHeapPtr = (p: number) => p > 0x10000 && p < 0x7fffffffffff;

export interface Deps {
  exeBase: number;
  buildId: string;
  /** FName (comp, num) -> string; used for faction names. */
  decodeFName(comp: number, num: number): Promise<string>;
  readCache(): Promise<Record<string, any>>;
  writeCache(patch: Record<string, unknown>): Promise<void>;
}

export interface Npc {
  uid: number;
  addr: string;
  sid: string | null;
  faction: string | null;
  subject: number;
  alive: boolean;
  state: "Alive" | "Wounded" | "Dead";
  health: number | null;
  rank: number;
  pos: { x: number; y: number; z: number };
}

export class Zone {
  private layout: BuildLayout | undefined;
  private sidCache = new Map<number, string>(); // SID table entries are static per run
  private protoSid = new Map<number, string | null>(); // prototype pointer -> SID (prototypes live for the whole run)
  private factionNames = new Map<number, string | null>();
  private chunks: number[] = []; // chunk addresses by index; checked against the next pointer on use
  private sidIndex: { at: number; bySid: Map<string, number[]> } | null = null;
  private playerUid: number | null = null;
  private relIndex: {
    at: number;
    buckets: number[];
    byPair: Map<string, number>;
    count: number;
  } | null = null;
  private bucketHint: { rva: number; count: number } | null | undefined;

  /** Max age (ms) of the full-scan indexes (SID -> uids, relation pair -> record). Single records are always re-read. */
  indexTtlMs = 5000;

  private bridge: MemBridge;
  private deps: Deps;
  constructor(bridge: MemBridge, deps: Deps) {
    this.bridge = bridge;
    this.deps = deps;
    this.layout = BUILD_LAYOUTS[deps.buildId];
  }

  private need(): BuildLayout {
    if (!this.layout) throw new Error(`no unit-pool layout for game build ${this.deps.buildId}`);
    return this.layout;
  }

  private async read(addr: number, n: number): Promise<Uint8Array | null> {
    const r = await this.bridge.game.readMemory(addr, n);
    return r && "hex" in r ? hexToBytes(r.hex) : null;
  }
  private async ptr(addr: number): Promise<number> {
    const b = await this.read(addr, 8);
    return b ? u64(b, 0) : 0;
  }

  private async fstring(addr: number, limit = 512): Promise<string | null> {
    const h = await this.read(addr, 16);
    if (!h) return null;
    const p = u64(h, 0),
      n = i32(h, 8),
      cap = i32(h, 12);
    if (n === 0) return "";
    if (!(n > 0 && n <= cap && n <= limit) || !isHeapPtr(p)) return null;
    const s = await this.read(p, n * 2);
    return s ? Buffer.from(s).toString("utf16le").replace(/\0+$/, "") : null;
  }

  private sidRvas: { pos: number; neg: number } | null = null;

  /**
   * A SID block table: its first 4 entries point at 1024-entry blocks of 32-byte records whose FStrings look like SIDs
   * (checked at entries 1, 2 and 1000 of block 0 and entry 1 of blocks 1-3). Other .data arrays of FString blocks
   * passed a weaker check (2026-11-19).
   */
  private async validSidTable(addr: number): Promise<boolean> {
    const sidLike = (s: string | null) => !!s && /^[A-Za-z0-9_]+$/.test(s);
    const head = await this.read(addr, 32);
    if (!head) return false;
    const blocks = [0, 8, 16, 24].map((o) => u64(head, o));
    if (!blocks.every(isHeapPtr)) return false;
    for (const i of [1, 2, 1000]) if (!sidLike(await this.fstring(blocks[0] + i * 32, 256))) return false;
    for (const b of blocks.slice(1)) if (!sidLike(await this.fstring(b + 32, 256))) return false;
    return true;
  }

  /**
   * SID string tables (positive and negative index). The layout RVAs are hints: on 2026-11-19 the positive table
   * sat 0x778 past its hint (the hint then held unrelated field-name FStrings), so it is validated, searched for
   * near the hint on a miss, and the hit kept for the run and in the build cache (`sidTables`). The negative
   * table is taken at the same shift.
   */
  private async sidTables(): Promise<{ pos: number; neg: number } | null> {
    const exe = this.deps.exeBase;
    if (this.sidRvas) return this.sidRvas;
    const L = this.need();
    const cached = (await this.deps.readCache()).sidTables as { pos: number; neg: number } | undefined;
    const tries = [cached, { pos: L.sidPositive, neg: L.sidNegative }].filter((x): x is { pos: number; neg: number } => !!x);
    for (const t of tries) if (await this.validSidTable(exe + t.pos)) return (this.sidRvas = t);
    const hint = exe + L.sidPositive;
    // Outward from the hint, nearest first.
    for (let d = 0; d < 0x10000; d += 8) {
      for (const cand of d ? [hint + d, hint - d] : [hint]) {
        if (!(await this.validSidTable(cand))) continue;
        const pos = cand - exe;
        this.sidRvas = { pos, neg: L.sidNegative + (pos - L.sidPositive) };
        this.bridge.log(`[sid] tables at RVA 0x${pos.toString(16)} / 0x${this.sidRvas.neg.toString(16)} (hint 0x${L.sidPositive.toString(16)})`);
        await this.deps.writeCache({ sidTables: this.sidRvas });
        return this.sidRvas;
      }
    }
    this.bridge.log("[sid] SID tables not found near the hint");
    return null;
  }

  async sid(index: number): Promise<string | null> {
    const hit = this.sidCache.get(index);
    if (hit != null) return hit;
    if (Math.abs(index) > 2_000_000) return null;
    const T = await this.sidTables();
    if (!T) return null;
    const table = this.deps.exeBase + (index < 0 ? T.neg : T.pos);
    const a = Math.abs(index);
    const block = await this.ptr(table + Math.floor(a / 1024) * 8);
    if (!isHeapPtr(block)) return null;
    const s = await this.fstring(block + (a % 1024) * 32);
    if (s != null) this.sidCache.set(index, s);
    return s;
  }

  private async protoSidOf(proto: number): Promise<string | null> {
    if (this.protoSid.has(proto)) return this.protoSid.get(proto)!;
    if (!isHeapPtr(proto)) return null;
    const b = await this.read(proto + 12, 4);
    const s = b ? await this.sid(i32(b, 0)) : null;
    if (s != null) this.protoSid.set(proto, s);
    return s;
  }

  private async factionName(key: number): Promise<string | null> {
    if (this.factionNames.has(key)) return this.factionNames.get(key)!;
    const L = this.need();
    const count = await this.ptr(this.deps.exeBase + L.factionBucketCount);
    const buckets = await this.ptr(this.deps.exeBase + L.factionBuckets);
    if (!(count > 0 && count < 10_000_000) || !isHeapPtr(buckets)) return null;
    const sentinel = buckets + (key % count) * 8;
    const seen = new Set<number>();
    for (
      let node = await this.ptr(sentinel);
      node && node !== sentinel && !seen.has(node) && seen.size < 1000;
      node = await this.ptr(node)
    ) {
      seen.add(node);
      if ((await this.ptr(node - 0x80)) === key) {
        const nb = await this.read(node - 0x68, 8);
        const name = nb ? await this.deps.decodeFName(u32(nb, 0), u32(nb, 4)) : null;
        this.factionNames.set(key, name);
        return name;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // unit pool

  private poolRva: number | null = null;

  /**
   * A first chunk: int32 count 3..1024 at +8; records 0, 1, 2 and the last one carry their own index as uid; the next
   * pointer is 0 or a chunk whose first record has uid 1024. A weaker check (count + uids 0/1) accepted a
   * different .data array on 2026-11-19 and every scan then failed with "bad chunk count".
   */
  private async validPool(addr: number): Promise<boolean> {
    const hdr = await this.read(addr, 12);
    if (!hdr) return false;
    const next = u64(hdr, 0),
      n = i32(hdr, 8);
    if (!(n >= 3 && n <= 1024)) return false;
    for (const i of [0, 1, 2, n - 1]) {
      const r = await this.read(addr + 16 + i * UNIT_STRIDE + U.uid, 4);
      if (!r || u32(r, 0) !== i) return false;
    }
    if (next) {
      if (!isHeapPtr(next) || n !== 1024) return false;
      const r = await this.read(next + 16 + U.uid, 4);
      if (!r || u32(r, 0) !== 1024) return false;
    }
    return true;
  }

  /** Forget the pool location (bad chunk seen): the next lookup validates and searches again. */
  private async dropPool() {
    this.poolRva = null;
    this.chunks = [];
    await this.deps.writeCache({ unitPool: null });
  }

  /**
   * First unit-pool chunk. The layout RVA is a hint: on 2026-11-19 the pool sat 0x6c0 past it (exe+0xa2f80c0) in
   * some runs. Validated each time; on a miss, searched outward from the hint (nearest first, +-0x10000), then all
   * of .data; the hit is kept for this run and in the build cache.
   */
  private async poolBase(): Promise<number> {
    const exe = this.deps.exeBase;
    if (this.poolRva != null && (await this.validPool(exe + this.poolRva))) return exe + this.poolRva;
    const cached = (await this.deps.readCache()).unitPool as number | null | undefined;
    const hint = this.need().unitPool;
    for (const rva of [cached, hint, hint + 0x6c0]) {
      if (typeof rva === "number" && (await this.validPool(exe + rva))) return this.keepPool(rva, hint);
    }
    for (let d = 8; d < 0x10000; d += 8) {
      for (const rva of [hint + d, hint - d]) if (await this.validPool(exe + rva)) return this.keepPool(rva, hint);
    }
    const { start: ds, size } = await this.dataSection();
    for (let off = ds; off < ds + size; off += 4096) {
      const page = await this.read(off, Math.min(4096, ds + size - off));
      if (!page) continue;
      for (let j = 0; j + 12 <= page.length; j += 8) {
        const n = i32(page, j + 8);
        if (n >= 3 && n <= 1024 && (await this.validPool(off + j))) return this.keepPool(off + j - exe, hint);
      }
    }
    this.bridge.log(`[units] pool not found (no save loaded?)`);
    return 0;
  }

  private async keepPool(rva: number, hint: number): Promise<number> {
    if (this.poolRva !== rva) {
      this.bridge.log(`[units] pool at RVA 0x${rva.toString(16)} (hint 0x${hint.toString(16)})`);
      await this.deps.writeCache({ unitPool: rva });
    }
    this.poolRva = rva;
    return this.deps.exeBase + rva;
  }

  /** Chunk address for chunk index `ci` (uid >> 10). Cached; a cached entry is re-checked through its predecessor's next pointer. */
  private async chunk(ci: number): Promise<number> {
    const base = await this.poolBase();
    if (!base) return 0;
    if (this.chunks[0] !== base) this.chunks = [base];
    for (let i = 1; i <= ci; i++) {
      const next = await this.ptr(this.chunks[i - 1]);
      if (!next) return 0;
      this.chunks[i] = next;
    }
    return this.chunks[ci];
  }

  private async decodeUnit(addr: number, raw: Uint8Array, full: boolean): Promise<Npc | null> {
    if (!(raw[U.flags] & 0x10)) return null;
    const x = f32(raw, U.pos),
      y = f32(raw, U.pos + 4),
      z = f32(raw, U.pos + 8);
    if (![x, y, z].every((v) => Number.isFinite(v) && Math.abs(v) < 1e8)) return null;
    const dead = raw[U.dead] === 1;
    const state = dead ? "Dead" : u32(raw, U.state) === 2 ? "Wounded" : "Alive";
    const health = f32(raw, U.health);
    return {
      uid: u32(raw, U.uid),
      addr: "0x" + addr.toString(16),
      sid: await this.protoSidOf(u64(raw, U.proto)),
      faction: full ? await this.factionName(u64(raw, U.faction)).catch(() => null) : null,
      subject: i64(raw, U.subject),
      alive: !dead,
      state,
      health: Number.isFinite(health) ? health : null,
      rank: raw[U.rank],
      pos: { x, y, z },
    };
  }

  /** Always a fresh read of the record; the chunk chain is cached. */
  async npcByUid(uid: number, full = true): Promise<Npc | null> {
    const ci = Math.floor(uid / 1024),
      i = uid % 1024;
    const c = await this.chunk(ci);
    if (!c) return null;
    const hdr = await this.read(c, 12);
    if (!hdr || i >= i32(hdr, 8)) return null;
    const addr = c + 16 + i * UNIT_STRIDE;
    const raw = await this.read(addr, UNIT_READ);
    if (!raw || u32(raw, U.uid) !== uid) return null;
    return this.decodeUnit(addr, raw, full);
  }

  /** Every live record in the pool (one read per record). */
  async scanUnits(full = false): Promise<Npc[]> {
    const out: Npc[] = [];
    for (let ci = 0; ci < 128; ci++) {
      const c = await this.chunk(ci);
      if (!c) break;
      const hdr = await this.read(c, 12);
      const n = hdr ? i32(hdr, 8) : 0;
      if (!(n >= 0 && n <= 1024)) {
        await this.dropPool();
        throw new Error("unit pool: bad chunk count (location dropped; retry)");
      }
      for (let i = 0; i < n; i++) {
        const addr = c + 16 + i * UNIT_STRIDE;
        const raw = await this.read(addr, UNIT_READ);
        if (!raw || u32(raw, U.uid) !== ci * 1024 + i) continue;
        const npc = await this.decodeUnit(addr, raw, full);
        if (npc) out.push(npc);
      }
    }
    return out;
  }

  private async buildSidIndex() {
    const bySid = new Map<string, number[]>();
    for (const u of await this.scanUnits(false)) {
      if (!u.sid) continue;
      const k = u.sid.toLowerCase();
      bySid.set(k, [...(bySid.get(k) ?? []), u.uid]);
      if (u.sid === "Player") this.playerUid = u.uid;
    }
    this.sidIndex = { at: Date.now(), bySid };
  }

  /** Units with this SID (case-insensitive). Index entries are re-verified; a miss or an old index triggers a rescan. */
  async npcsBySid(sid: string, fresh = false): Promise<Npc[]> {
    const key = sid.toLowerCase();
    const old = !this.sidIndex || Date.now() - this.sidIndex.at > this.indexTtlMs;
    if (fresh || !this.sidIndex) await this.buildSidIndex();
    let hits = await this.verifySid(key);
    if (!hits.length && old && !fresh) {
      await this.buildSidIndex();
      hits = await this.verifySid(key);
    }
    return hits;
  }

  private async verifySid(key: string): Promise<Npc[]> {
    const out: Npc[] = [];
    for (const uid of this.sidIndex?.bySid.get(key) ?? []) {
      const n = await this.npcByUid(uid);
      if (n && n.sid?.toLowerCase() === key) out.push(n);
    }
    return out;
  }

  async player(): Promise<Npc | null> {
    if (this.playerUid != null) {
      const p = await this.npcByUid(this.playerUid);
      if (p?.sid === "Player") return p;
    }
    this.playerUid = null;
    return (await this.npcsBySid("Player", true))[0] ?? null;
  }

  /** "player" | "uid:N" | "subject:N" or a bare number (relation subject id) | "sid:X" or any other text (SID; first alive unit). */
  async subjectOf(ref: string): Promise<{ subject: number; npc?: Npc }> {
    const r = ref.trim();
    if (/^(subject:)?-?\d+$/i.test(r)) return { subject: Number(r.replace(/^subject:/i, "")) };
    let npc: Npc | null | undefined;
    if (r.toLowerCase() === "player") npc = await this.player();
    else if (/^uid:\d+$/i.test(r)) npc = await this.npcByUid(Number(r.slice(4)));
    else {
      const all = await this.npcsBySid(r.replace(/^sid:/i, ""));
      npc = all.find((n) => n.alive) ?? all[0];
    }
    if (!npc) throw new Error(`no unit for ${ref}`);
    return { subject: npc.subject, npc };
  }

  // ---------------------------------------------------------------------------
  // relations: a boost intrusive unordered_set whose bucket array sits in exe .data. Each record's
  // +0 is the singly linked next pointer; a chain ends at its bucket slot, and an empty bucket points
  // to itself. The array is found once per build by scanning .data and its RVA is kept in the build cache.

  private async dataSection(): Promise<{ start: number; size: number }> {
    const base = this.deps.exeBase;
    const h = await this.read(base + 0x3c, 4);
    const nt = base + u32(h!, 0);
    const fh = await this.read(nt + 4, 20);
    const nsec = dv(fh!).getUint16(2, true),
      opt = dv(fh!).getUint16(16, true);
    const secs = await this.read(nt + 24 + opt, nsec * 40);
    for (let i = 0; i < nsec; i++) {
      const name = Buffer.from(secs!.slice(i * 40, i * 40 + 8))
        .toString("latin1")
        .replace(/\0+$/, "");
      if (name === ".data")
        return { start: base + u32(secs!, i * 40 + 12), size: u32(secs!, i * 40 + 8) };
    }
    throw new Error(".data section not found");
  }

  private async plausibleRecord(rec: number): Promise<Uint8Array | null> {
    const b = await this.read(rec, R.size);
    if (!b) return null;
    // Not every record keys on two small ids (about 2% hold a pointer at +0x28), so only the value is checked.
    return Math.abs(i32(b, R.value)) <= RELATION_SELF ? b : null;
  }

  /** Bucket array as [first slot address, count]. Hint from the build cache is re-validated. */
  private async findBuckets(): Promise<{ start: number; count: number }> {
    if (this.bucketHint === undefined)
      this.bucketHint = (await this.deps.readCache()).relationBuckets ?? null;
    if (this.bucketHint) {
      const start = this.deps.exeBase + this.bucketHint.rva;
      if (await this.validBuckets(start, this.bucketHint.count))
        return { start, count: this.bucketHint.count };
      this.bridge.log(`[relations] cached bucket array failed validation; rescanning .data`);
    }
    const { start: ds, size } = await this.dataSection();
    const t0 = Date.now();
    // Runs of slots that point to themselves (empty) or to a plausible record whose chain reaches back to that slot.
    let best = { start: 0, count: 0, used: 0 };
    let run = { start: 0, count: 0, used: 0 };
    const close = () => {
      if (run.used > best.used && run.used >= 8) best = { ...run };
      run = { start: 0, count: 0, used: 0 };
    };
    for (let off = 0; off < size; off += 4096) {
      const page = await this.read(ds + off, Math.min(4096, size - off));
      if (!page) {
        close();
        continue;
      }
      for (let j = 0; j + 8 <= page.length; j += 8) {
        const slot = ds + off + j;
        const p = u64(page, j);
        let ok = p === slot;
        // A heap pointer is only tested next to an empty (self-pointing) bucket or inside a run,
        // which skips almost every other pointer in .data (one RPC per test).
        const nearEmpty =
          (j >= 8 && u64(page, j - 8) === slot - 8) ||
          (j + 16 <= page.length && u64(page, j + 8) === slot + 8);
        if (
          !ok &&
          (run.count > 0 || nearEmpty) &&
          isHeapPtr(p) &&
          (p < this.deps.exeBase || p > ds + size)
        ) {
          const rec = await this.plausibleRecord(p);
          ok = !!rec && (await this.chainReturnsTo(p, slot, 64));
          if (ok) run.used++;
        }
        if (ok) {
          if (!run.count) run.start = slot;
          run.count++;
        } else close();
      }
    }
    close();
    if (!best.used) throw new Error("relations: bucket array not found in .data (no save loaded?)");
    this.bridge.log(
      `[relations] bucket array at .data+0x${(best.start - ds).toString(16)}, ${best.count} slots, ${best.used} used (${Date.now() - t0} ms)`,
    );
    this.bucketHint = { rva: best.start - this.deps.exeBase, count: best.count };
    await this.deps.writeCache({ relationBuckets: this.bucketHint });
    return best;
  }

  private async chainReturnsTo(node: number, slot: number, max: number): Promise<boolean> {
    for (let i = 0; i < max && node; i++) {
      const next = await this.ptr(node + R.next);
      if (next === slot) return true;
      node = next;
    }
    return false;
  }

  private async validBuckets(start: number, count: number): Promise<boolean> {
    let used = 0;
    for (let k = 0; k < count && used < 4; k++) {
      const p = await this.ptr(start + k * 8);
      if (p === start + k * 8) continue;
      if (!(await this.plausibleRecord(p))) return false;
      used++;
    }
    return used > 0;
  }

  /** Full walk of every bucket chain into a pair -> record map. */
  private async buildRelIndex() {
    const { start, count } = await this.findBuckets();
    const byPair = new Map<string, number>();
    for (let k = 0; k < count; k += 512) {
      const n = Math.min(512, count - k);
      const slots = await this.read(start + k * 8, n * 8);
      if (!slots) continue;
      for (let j = 0; j < n; j++) {
        const slot = start + (k + j) * 8;
        let node = u64(slots, j * 8);
        for (let d = 0; node && node !== slot && d < 256; d++) {
          const b = await this.read(node, R.size);
          if (!b) break;
          byPair.set(`${i64(b, R.a)}:${i64(b, R.b)}`, node);
          node = u64(b, R.next);
        }
      }
    }
    this.relIndex = { at: Date.now(), buckets: [start, count], byPair, count: byPair.size };
  }

  private async relIdx(fresh: boolean) {
    if (fresh || !this.relIndex || Date.now() - this.relIndex.at > this.indexTtlMs * 12)
      await this.buildRelIndex();
    return this.relIndex!;
  }

  /** Record address of (a, b), re-read and checked; a stale or missing entry rebuilds the index once. */
  private async relationRecord(
    a: number,
    b: number,
  ): Promise<{ addr: number; value: number } | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const idx = await this.relIdx(attempt === 1 && Date.now() - (this.relIndex?.at ?? 0) > 1000);
      const addr = idx.byPair.get(`${a}:${b}`);
      if (addr) {
        const r = await this.read(addr, R.size);
        if (r && i64(r, R.a) === a && i64(r, R.b) === b) return { addr, value: i32(r, R.value) };
        idx.byPair.delete(`${a}:${b}`);
      }
    }
    return null;
  }

  private gvNames = new Map<number, string>(); // FName comparison index -> string, static per run

  /** Every global variable (live values from UGlobalVariableManager), optionally filtered by SID substring. */
  async globalVariables(filter?: string): Promise<GlobalVariable[]> {
    const mgr = await this.ptr(this.deps.exeBase + this.need().globalVariableManager);
    if (!isHeapPtr(mgr)) throw new Error("GlobalVariableManager not created yet (load a save)");
    const h = await this.read(mgr + GV.set, 0x30);
    if (!h) throw new Error("GlobalVariableManager unreadable");
    const data = u64(h, 0),
      num = i32(h, 8);
    if (!isHeapPtr(data) || !(num >= 0 && num < 100000)) throw new Error(`GlobalVariableManager set looks wrong (num ${num})`);
    const flagsHeap = u64(h, GV.flagsHeap - GV.set);
    const flags = isHeapPtr(flagsHeap) ? await this.read(flagsHeap, Math.ceil(num / 32) * 4) : h.subarray(GV.flagsInline - GV.set, GV.flagsInline - GV.set + 16);
    if (!flags) throw new Error("GlobalVariableManager flags unreadable");
    const needle = filter?.toLowerCase();
    const out: GlobalVariable[] = [];
    const perRead = Math.floor(4096 / GV.stride);
    for (let i = 0; i < num; i += perRead) {
      const n = Math.min(perRead, num - i);
      const b = await this.read(data + i * GV.stride, n * GV.stride);
      if (!b) continue;
      for (let k = 0; k < n; k++) {
        const idx = i + k;
        if (!((flags[idx >> 3] >> (idx & 7)) & 1)) continue;
        const o = k * GV.stride;
        const comp = u32(b, o),
          fnum = u32(b, o + 4);
        let sid = this.gvNames.get(comp);
        if (sid == null) this.gvNames.set(comp, (sid = await this.deps.decodeFName(comp, 0)));
        if (fnum) sid = `${sid}_${fnum - 1}`;
        if (needle && !sid.toLowerCase().includes(needle)) continue;
        const raw = i32(b, o + GV.value),
          t = i32(b, o + GV.type);
        const type = GV_TYPES[t] ?? t;
        const value = type === "Bool" ? raw !== 0 : type === "String" ? await this.sid(raw) : raw;
        out.push({ sid, type, value, raw });
      }
    }
    return out;
  }

  async relation(aRef: string, bRef: string) {
    const A = await this.subjectOf(aRef),
      B = await this.subjectOf(bRef);
    const fwd = await this.relationRecord(A.subject, B.subject);
    const back = await this.relationRecord(B.subject, A.subject);
    const fmt = (r: { addr: number; value: number } | null) =>
      r
        ? { value: r.value, level: relationLevel(r.value), addr: "0x" + r.addr.toString(16) }
        : null;
    // Records seen live are stored once per pair with the smaller id first ((3,12) but no (12,3)).
    const one = fwd ?? back;
    return {
      value: one?.value ?? null,
      level: one ? relationLevel(one.value) : null,
      a: { ref: aRef, subject: A.subject, sid: A.npc?.sid },
      b: { ref: bRef, subject: B.subject, sid: B.npc?.sid },
      ab: fmt(fwd),
      ba: fmt(back),
    };
  }

  async relationsOf(ref: string, limit: number, fresh: boolean) {
    const S = await this.subjectOf(ref);
    const idx = await this.relIdx(fresh);
    const items: Array<{ a: number; b: number; value: number; level: string }> = [];
    for (const [k, addr] of idx.byPair) {
      const [a, b] = k.split(":").map(Number);
      if (a !== S.subject && b !== S.subject) continue;
      const r = await this.read(addr, R.size);
      if (!r || i64(r, R.a) !== a || i64(r, R.b) !== b) continue;
      const v = i32(r, R.value);
      items.push({ a, b, value: v, level: relationLevel(v) });
      if (items.length >= limit) break;
    }
    return {
      subject: S.subject,
      sid: S.npc?.sid,
      indexAgeMs: Date.now() - idx.at,
      records: idx.count,
      items,
    };
  }

  /** Writes the value into the (a,b) record and, with both, (b,a); reads it back. Bypasses the game's change hooks. */
  async setRelation(aRef: string, bRef: string, value: number, both: boolean) {
    // Live values go past +-1000 (player records of 1350 and -2970 seen); 100000 marks Self.
    if (!Number.isInteger(value) || Math.abs(value) >= RELATION_SELF)
      throw new Error("value must be an integer in -99999..99999");
    const A = await this.subjectOf(aRef),
      B = await this.subjectOf(bRef);
    const pairs =
      both && A.subject !== B.subject
        ? [
            [A.subject, B.subject],
            [B.subject, A.subject],
          ]
        : [[A.subject, B.subject]];
    const written: Array<{ a: number; b: number; before: number; after: number }> = [];
    for (const [a, b] of pairs) {
      const r = await this.relationRecord(a, b);
      if (!r) continue;
      await this.bridge.game.writeMemory(r.addr + R.value, i32Hex(value));
      const after = await this.read(r.addr + R.value, 4);
      written.push({ a, b, before: r.value, after: after ? i32(after, 0) : NaN });
    }
    if (!written.length)
      throw new Error(`no relation record between subjects ${A.subject} and ${B.subject}`);
    return { ok: written.every((w) => w.after === value), level: relationLevel(value), written };
  }

  async npcs(filter: { sid?: string; faction?: string; alive?: boolean; limit: number }) {
    const all = await this.scanUnits(!!filter.faction);
    const sid = filter.sid?.toLowerCase(),
      fac = filter.faction?.toLowerCase();
    const items = all.filter(
      (u) =>
        (!sid || u.sid?.toLowerCase().includes(sid)) &&
        (!fac || u.faction?.toLowerCase().includes(fac)) &&
        (filter.alive == null || u.alive === filter.alive),
    );
    return { total: all.length, matched: items.length, items: items.slice(0, filter.limit) };
  }
}
