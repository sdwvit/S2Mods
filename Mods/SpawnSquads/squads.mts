/** Faction part of `GeneralNPC_<Faction>_<Role>`, with the roles each faction has. Varta is Ward in the English UI. */
const FACTION_ROLES: Record<string, string[]> = {
  Bandit: ["Stormtrooper", "Recon", "CloseCombat", "Heavy"],
  Corpus: ["Stormtrooper", "Recon", "Sniper", "CloseCombat", "Heavy"],
  Duty: ["Stormtrooper", "Recon", "Sniper", "CloseCombat", "Heavy"],
  Freedom: ["Stormtrooper", "Recon", "Sniper", "CloseCombat"],
  Mercenaries: ["Stormtrooper", "Recon", "Sniper", "CloseCombat"],
  Militaries: ["Stormtrooper", "Recon", "Sniper", "CloseCombat", "Heavy"],
  Monolith: ["Stormtrooper", "Recon", "Sniper", "CloseCombat"],
  Neutral: ["Stormtrooper", "Recon", "Sniper", "CloseCombat"],
  Noon: ["Stormtrooper", "Recon", "Sniper", "CloseCombat"],
  Scientists: ["Stormtrooper", "Recon"],
  Spark: ["Stormtrooper", "Recon", "Sniper", "CloseCombat"],
  Varta: ["Stormtrooper", "Recon", "Sniper", "CloseCombat", "Heavy"],
};

export const QUEST_SID = "SpawnSquads";
export const SQUAD_SIZE = 5;
/** Rank argument of XSpawnObjBySID. */
export const RANK = 2;
/** Vanilla faction that is Friend (800) to the player and neutral to everyone but ArenaEnemy. */
export const FRIENDLY_FACTION = "ArenaFriend";

/**
 * Where E01_MQ01_DebugTeleport_Player_ToQuestStart puts Skif at the start of the first main mission
 * (yaw -90, facing -Y). The squad stands in a row 10 m in front of that point.
 */
const SKIF_START = { x: 345728.3213, y: 661845.500178, z: 1127.865832 };
const AHEAD_CM = 1000;
const SPACING_CM = 250;

export type Squad = { sid: string; members: { prototypeSID: string; x: number; y: number; z: number; yaw: number }[] };

export const friendlyPrototypeSID = (faction: string, role: string) => `SpawnSquads_${faction}_${role}_Friendly`;

/** Every [faction, role] that needs a friendly ObjPrototype. */
export const FRIENDLY_PROTOTYPES: { faction: string; role: string }[] = [];

export const SQUADS: Squad[] = Object.entries(FACTION_ROLES).flatMap(([faction, roles]) =>
  [false, true].map((friendly) => ({
    sid: `SpawnSquad${faction}${friendly ? "Friendly" : ""}`,
    members: Array.from({ length: SQUAD_SIZE }, (_, i) => {
      const role = roles[i % roles.length];
      if (friendly && i < roles.length) FRIENDLY_PROTOTYPES.push({ faction, role });
      return {
        prototypeSID: friendly ? friendlyPrototypeSID(faction, role) : `GeneralNPC_${faction}_${role}`,
        x: Math.round(SKIF_START.x + (i - (SQUAD_SIZE - 1) / 2) * SPACING_CM),
        y: Math.round(SKIF_START.y - AHEAD_CM),
        z: Math.round(SKIF_START.z + 50),
        // Face Skif.
        yaw: 90,
      };
    }),
  })),
);
