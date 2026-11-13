/**
 * Every artifact detector's radii, from `DetectorPrototypes.cfg` (cfg units are centimetres):
 * - `DetectorWorkRadius`: the detector starts beeping at an artifact this close;
 * - `ShowArtifactRadius`: a hidden artifact becomes visible this close;
 * - `AnomalyDetectionRadius`: anomalies show on the screen this close (Veles only).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Struct } from "s2cfgtojson";
import { baseCfgDir } from "../../src/base-paths.mts";

export type DetectorStats = {
  SID: string;
  textSID: string;
  /** Metres. */
  detectionRange: number;
  /** Metres. */
  artifactReveal: number;
  /** Metres; 0 when the detector does not show anomalies. */
  anomalyScan: number;
};

const FILE = path.join(baseCfgDir, "GameData/ItemPrototypes/DetectorPrototypes.cfg");

export function readDetectorStats(): DetectorStats[] {
  const metres = (value: unknown) => (parseFloat(String(value ?? 0)) || 0) / 100;
  return Struct.fromString<Struct>(readFileSync(FILE, "utf8"))
    .filter((s) => s.SID && !s.SID.startsWith("Template"))
    .map((s) => ({
      SID: s.SID,
      textSID: s.SID,
      detectionRange: metres(s["DetectorWorkRadius" as string]),
      artifactReveal: metres(s["ShowArtifactRadius" as string]),
      anomalyScan: metres(s["AnomalyDetectionRadius" as string]),
    }));
}
