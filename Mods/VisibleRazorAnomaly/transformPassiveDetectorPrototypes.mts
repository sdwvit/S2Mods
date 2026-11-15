import { Struct } from "s2cfgtojson";

/**
 * The player's passive anomaly detector (PlayerDetector) skips anomalies in ExclusionAnomalyList,
 * and RazorAnomaly is on it, so no detector beeps near Shards. Drop that entry.
 */
export function transformPassiveDetectorPrototypes(struct: any) {
  if (struct.SID !== "PlayerDetector" || !struct.ExclusionAnomalyList) {
    return null;
  }
  const fork = struct.fork();
  fork.ExclusionAnomalyList = new Struct().fork(true);
  struct.ExclusionAnomalyList.forEach(([key, sid]: [string, string]) => {
    if (sid === "RazorAnomaly") {
      fork.ExclusionAnomalyList[key] = new Struct();
      fork.ExclusionAnomalyList.removeNode(key);
    }
  });
  return fork;
}

transformPassiveDetectorPrototypes.files = ["/PassiveDetectorPrototypes.cfg"];
