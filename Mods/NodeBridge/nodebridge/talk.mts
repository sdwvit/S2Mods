// Start an NPC's conversation the way the player's Use/E does: calls the native interact handler
// DialogManager::<interact>(DialogManager*, uint32* unitHandle) on the game thread (game.callNative, DLL v0.2.33+).
// Static analysis 2026-11-19 (2b1aeebf-b954000 build): the handler resolves `handle & 0x7ffffff` (< 0x400) in the
// A-Life unit pool (0x700-byte records, so handle = uid), reads the dialog component at record+0x688, builds a
// dialog topic from it and calls DialogManager::AddDialogTopic (0x142ed3196) with isQuest=0, isForced=0.
// AddDialogTopic starts the dialog now when none is active (DialogManager+0x350) and queues it otherwise.
import type { Bridge } from "@nodebridge/runtime";
import { getBuildId, getExeBase, getObjectName, parseHex, readU64At } from "@nodebridge/runtime";
import type { Zone } from "./zone.mts";

interface TalkLayout {
  dialogManager: number; // RVA of the DialogManager* slot in the game singleton table
  interact: number; // RVA of the interact handler
  prologue: string; // first bytes of the handler, checked before every call
}

const LAYOUTS: Record<string, TalkLayout> = {
  "2b1aeebf-b954000": {
    dialogManager: 0xa2c85c8,
    interact: 0x320b0ac,
    prologue: "4156565753 4881ecd8000000".replace(/ /g, ""),
  },
};

const DIALOG_COMPONENT = 0x688; // unit record (+0x10 of the pool slot): dialog component pointer, 0 when not loaded
const ACTIVE_DIALOG = 0x350; // DialogManager: current dialog, 0 when none

let handleBuf = 0;

export async function talkTo(bridge: Bridge, zone: Zone, uid: number) {
  const build = await getBuildId(bridge);
  const L = LAYOUTS[build];
  if (!L) return { ok: false, reason: `no talk layout for game build ${build}` };
  if (!(uid > 0 && uid < 0x400)) return { ok: false, reason: "uid must be 1..1023 (the handler only resolves the first pool chunk)" };
  if (!bridge.game.callNative) return { ok: false, reason: "DLL lacks game.callNative (needs v0.2.33+, game restart)" };

  const base = await getExeBase(bridge);
  const pro = await bridge.game.readMemory(base + L.interact, L.prologue.length / 2);
  if (!("hex" in pro) || pro.hex.replace(/\s/g, "").toLowerCase() !== L.prologue) {
    return { ok: false, reason: "interact handler bytes differ from the analysed build; re-verify the RVA" };
  }
  const dm = (await readU64At(bridge, base + L.dialogManager)) ?? 0;
  if (!dm || !(await getObjectName(bridge, dm)).startsWith("DialogManager_")) return { ok: false, reason: "DialogManager not found" };

  const npc = await zone.npcByUid(uid, false);
  if (!npc) return { ok: false, reason: "no live unit with that uid" };
  if (!npc.alive) return { ok: false, reason: `unit is ${npc.state}`, npc: npc.sid };
  const comp = (await readU64At(bridge, Number(npc.addr) + DIALOG_COMPONENT)) ?? 0;
  if (!comp) return { ok: false, reason: "NPC not loaded (no dialog component)", npc: npc.sid };
  const active = (await readU64At(bridge, dm + ACTIVE_DIALOG)) ?? 0;

  if (!handleBuf) {
    const a = await bridge.game.virtualAlloc(16);
    if ("error" in a) return { ok: false, reason: `virtualAlloc: ${a.error}` };
    handleBuf = a.addr;
  }
  const h = new Uint8Array(4);
  new DataView(h.buffer).setUint32(0, uid, true);
  await bridge.game.writeMemory(handleBuf, Array.from(h, (b) => b.toString(16).padStart(2, "0")).join(""));
  const r = await bridge.game.callNative(base + L.interact, [dm, handleBuf]);
  if (!("ok" in r) || r.ok === false) return { ok: false, reason: (r as any).reason ?? "callNative failed", npc: npc.sid };
  const nowActive = (await readU64At(bridge, dm + ACTIVE_DIALOG)) ?? 0;
  return {
    ok: true,
    npc: npc.sid,
    uid,
    queuedBehindActiveDialog: !!active,
    dialogActive: !!nowActive,
  };
}


// Active dialog record (DialogManager+0x350), live probe 2026-11-19 while talking to Viktoria (RSQ01):
// +0x8 -> struct whose int32 at +0xc is the current phrase's SID index (RSQ01_Dialog_Warlock_RSQ_confirm_26957_4);
// +0x1c0 int32 = SID index of the last chosen reply; +0x148 int32 = the NPC's A-Life uid. DialogManager+0x120 is a TArray of running
// dialogs (count at +0x128); +0x350 is the one currently playing, which can be an NPC conversation near the player.
const DIALOG_PHRASE_REF = 0x8;
const PHRASE_SID = 0xc;
const DIALOG_NPC_SID = 0x1c0; // actually the last chosen reply's SID index (EQ197_QD_Orders_New_73037 after picking it)
const DIALOG_NPC_UID = 0x148; // int32 A-Life uid of the NPC (864 = ScientistViktoriaDoroznuk, 2026-11-19)

const DIALOG_LIST = 0x120; // DialogManager: TArray<Dialog*> of running dialogs (data, num @+0x128)

/**
 * Running dialogs with their current phrase and NPC spawn SID. `current` is DialogManager+0x350. Ambient NPC
 * conversations near the player run here too (2026-11-19: Sidorovich's RSQ06 lines and a hub guard's bark showed
 * up during another conversation), so the player's own conversation is the one whose phrase belongs to it;
 * a phrase of null means between lines or waiting for the player's reply.
 */
export async function currentDialog(bridge: Bridge, zone: Zone) {
  const L = LAYOUTS[await getBuildId(bridge)];
  if (!L) return { active: false, reason: "no dialog layout for this game build" };
  const base = await getExeBase(bridge);
  const dm = (await readU64At(bridge, base + L.dialogManager)) ?? 0;
  if (!dm) return { active: false, reason: "DialogManager not found" };
  const i32 = async (a: number) => {
    const r = await bridge.game.readMemory(a, 4);
    if (!("hex" in r)) return null;
    const b = parseHex(r.hex);
    return new DataView(b.buffer, b.byteOffset, 4).getInt32(0, true);
  };
  const name = async (i: number | null) => (i ? await zone.sid(i) : null); // 0 = between lines
  const describe = async (d: number) => {
    // The record changes between lines and two reads can straddle a change: read until two passes agree.
    const pass = async () => {
      const ref = (await readU64At(bridge, d + DIALOG_PHRASE_REF)) ?? 0;
      return [ref ? await i32(ref + PHRASE_SID) : null, await i32(d + DIALOG_NPC_SID)] as const;
    };
    let [p, n] = await pass();
    for (let k = 0; k < 4; k++) {
      const [p2, n2] = await pass();
      if (p2 === p && n2 === n) break;
      [p, n] = [p2, n2];
    }
    const uid = await i32(d + DIALOG_NPC_UID);
    const npc = uid && uid > 0 ? await zone.npcByUid(uid, false) : null;
    return {
      dialog: `0x${d.toString(16)}`,
      character: uid && uid > 0 ? { uid, sid: npc?.sid ?? null } : null,
      node: await name(p),
      lastReply: await name(n),
      raw: { nodeIdx: p, lastReplyIdx: n },
    };
  };
  const cur = (await readU64At(bridge, dm + ACTIVE_DIALOG)) ?? 0;
  const data = (await readU64At(bridge, dm + DIALOG_LIST)) ?? 0;
  const count = (await i32(dm + DIALOG_LIST + 8)) ?? 0;
  const ptrs: number[] = [];
  for (let i = 0; data && i < Math.min(count, 16); i++) {
    const p = (await readU64At(bridge, data + i * 8)) ?? 0;
    if (p) ptrs.push(p);
  }
  if (cur && !ptrs.includes(cur)) ptrs.unshift(cur);
  const dialogs = [];
  for (const p of ptrs) dialogs.push({ current: p === cur, ...(await describe(p)) });
  return { active: dialogs.length > 0, dialogs };
}
