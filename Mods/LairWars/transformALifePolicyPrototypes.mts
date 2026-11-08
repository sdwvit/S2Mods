import type { Struct } from "s2cfgtojson";

/**
 * A-Life population: vanilla starts despawning ("extinction") above 2000 units and stops at 1950, which caps how much
 * the bigger, faster lairs can field. Wiped lairs also refill sooner (vanilla 6 min full wipe, 2 min partial).
 *
 * Vanilla refills a lair only while the player is 200-250 m away (Min/MaxRefillDistance), farther than the online
 * bubble (A-Life vision 85 m), so a lair near the player never refills. 0 lets a lair refill wherever the player is.
 */
export const TRIGGER_EXTINCTION = 4000;
export const STOP_EXTINCTION = 3900;
export const FULL_WIPE_REFILL_COOLDOWN = 120;
export const PARTIAL_WIPE_REFILL_COOLDOWN = 40;
export const MIN_REFILL_DISTANCE = 0;
export const MAX_REFILL_DISTANCE = 0;

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
  fork.MaxRefillDistance = MAX_REFILL_DISTANCE;
  return fork;
}

transformALifePolicyPrototypes.files = ["/ALifePolicyPrototypes.cfg"];
