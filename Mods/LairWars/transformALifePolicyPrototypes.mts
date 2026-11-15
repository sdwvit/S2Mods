import type { Struct } from "s2cfgtojson";

/**
 * A-Life population: vanilla starts despawning ("extinction") above 2000 units and stops at 1950. A session with
 * the bigger lairs and the wild lairs had 8,800 units alive, so a 4000 cap culled offline units all session and
 * expansion squads died before leaving; extinction now starts at 15000.
 *
 * Wiped lairs refill slower: 30 min after a full wipe, 10 min after a partial one (vanilla 6 min and 2 min; real
 * seconds, the 133 s median measured between refills matched vanilla's 2 min).
 *
 * Vanilla refills a lair only while the player is 200-250 m away (Min/MaxRefillDistance). MinRefillDistance 0 lets a
 * lair refill right next to the player. MaxRefillDistance stays vanilla.
 */
export const TRIGGER_EXTINCTION = 15000;
export const STOP_EXTINCTION = 14900;
export const FULL_WIPE_REFILL_COOLDOWN = 1800;
export const PARTIAL_WIPE_REFILL_COOLDOWN = 600;
export const MIN_REFILL_DISTANCE = 0;

export function transformALifePolicyPrototypes(struct: Struct) {
  if (struct.SID !== "Default") {
    return null;
  }
  const fork = struct.fork();
  fork.TriggerExtinction = TRIGGER_EXTINCTION;
  fork.StopExtinction = STOP_EXTINCTION;
  fork.FullWipeRefillCooldown = `${FULL_WIPE_REFILL_COOLDOWN}.f`;
  fork.PartialWipeRefillCooldown = `${PARTIAL_WIPE_REFILL_COOLDOWN}.f`;
  fork.MinRefillDistance = MIN_REFILL_DISTANCE;
  return fork;
}

transformALifePolicyPrototypes.files = ["/ALifePolicyPrototypes.cfg"];
