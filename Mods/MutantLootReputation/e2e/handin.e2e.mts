/**
 * In-game end-to-end test for MutantLootReputation (and StashClueRework, which hooks the same hand-in).
 * Needs the game running with NodeBridge (127.0.0.1:47811) and the Living Zone Tracker (127.0.0.1:8765).
 * Run: node src/e2e/run.mts Mods/MutantLootReputation/e2e/handin.e2e.mts
 *
 * Verified by hand on 2026-11-19 before this file was written: one Viktoria hand-in after a fresh launch
 * gave +10 Scientists and a new Gen_Stash clue; three in a row gave +30.
 */
import { test, expect } from "../../../src/e2e/runner.mts";

const VIKTORIA = "ScientistViktoriaDoroznuk";
const ORDERS_TOPIC = "EQ197_QD_Orders_New_73037";
const FLESH_ORDER = "EQ197_QD_Orders_Flesh_73041";
const HAND_IN = "EQ197_QD_Orders_Done_73060";
const LATER = "EQ197_QD_Orders_Later_73054";
const PARTS = ["FleshLoot", "BlinddogLoot"];

test.describe("MutantLootReputation: Viktoria's mutant loot orders", () => {
  test.beforeAll(async ({ game }) => {
    // Fresh launch + last save: proves the gameStartCommand load kick, nothing started by hand.
    await game.restart();
    await game.loadLastSave();
  });

  test("poll loops start on world load without help", async ({ quest }) => {
    await expect.poll(() => quest.activeNodes("BodyParts_Malahit"), { timeout: 30_000 }).toContainMatch(
      /^BodyParts_Malahit_MutantLootReputation_(TickA|TickB)$/,
    );
    await expect.poll(() => quest.activeNodes("BodyParts_Malahit"), { timeout: 30_000 }).toContainMatch(
      /^BodyParts_Malahit_StashClueRework_(TickA|TickB)$/,
    );
    expect(await quest.isRunning("StashClueRework")).toBe(true);
  });

  test("one hand-in pays +10 Scientists, keeps the vanilla payout and rolls a stash clue", async ({
    player,
    npc,
    dialog,
    globals,
    relation,
  }) => {
    for (const part of PARTS) await player.giveItem(part, 30);
    const viktoria = await npc.bySid(VIKTORIA);
    const repBefore = await relation.toPlayer(viktoria);
    const cluesBefore = await globals.trueSids(/^Gen_Stash\d+$/);

    await dialog.talkTo(viktoria);
    await dialog.choose(ORDERS_TOPIC);
    await dialog.choose(FLESH_ORDER);
    await dialog.choose(HAND_IN);
    await expect.poll(() => dialog.currentNode()).toBe("EQ197_QD_Orders_Done_73061");

    await expect.poll(() => relation.toPlayer(viktoria), { timeout: 15_000 }).toBe(repBefore + 10);
    await expect.poll(() => globals.get("MutantLootReputationMalahitDone")).toBe(0);
    await expect.poll(() => globals.get("StashClueReworkMalahitDone")).toBe(0);
    await expect.poll(() => globals.trueSids(/^Gen_Stash\d+$/), { timeout: 15_000 }).toHaveLength(cluesBefore.length + 1);
    // Vanilla GiveItem/GetMoney (parts taken, coupons paid) is not asserted: NodeBridge has no inventory
    // endpoint yet. Verified by hand on 2026-11-19.

    await dialog.choose(LATER);
  });

  test("several hand-ins in a row each pay", async ({ player, npc, dialog, relation }) => {
    await player.giveItem("FleshLoot", 30);
    const viktoria = await npc.bySid(VIKTORIA);
    const before = await relation.toPlayer(viktoria);

    await dialog.talkTo(viktoria);
    await dialog.choose(ORDERS_TOPIC);
    for (let i = 0; i < 3; i++) {
      await dialog.choose(FLESH_ORDER);
      await dialog.choose(HAND_IN);
    }
    await dialog.choose(LATER);

    await expect.poll(() => relation.toPlayer(viktoria), { timeout: 20_000 }).toBe(before + 30);
  });
});

test.describe("MutantLootReputation: Gonta's orders", () => {
  // Gonta must be spawned (near his hub, SQ94_P running). Skipped otherwise.
  test("one hand-in pays +10 Neutrals", async ({ quest, npc, dialog, player, relation }) => {
    test.skip(!(await quest.isRunning("SQ94_P")), "SQ94_P not running in this save");
    const gonta = await npc.bySidOrNull("Gonta");
    test.skip(!gonta, "Gonta not spawned");
    await expect.poll(() => quest.activeNodes("SQ94_P")).toContainMatch(/^SQ94_P_MutantLootReputation_(TickA|TickB)$/);

    for (const part of ["FleshLoot", "BoarLoot", "BlinddogLoot", "TushkanLoot"]) await player.giveItem(part, 30);
    const before = await relation.toPlayer(gonta!);
    await dialog.talkTo(gonta!);
    await dialog.chooseMatching(/^SQ94_QD_Gonta_Orders/); // his orders topic
    await dialog.chooseMatching(/^SQ94_QD_Gonta_Orders_Done(Second|Third)?_808(15|17|19)/);
    await expect.poll(() => relation.toPlayer(gonta!), { timeout: 15_000 }).toBe(before + 10);
  });
});
