import { Struct } from "s2cfgtojson";

/**
 * Lair attacks between factions (RelationPrototypes `ExpansionPolicies.AttackLairRestrictions`). Vanilla lists no
 * attacks at all for some expanding factions (Noon, Militaries), so they can only move into empty lairs and nearly
 * never fight. Such a faction gets an attack on every faction it is at the Enemy relation level with: the
 * `Relations` value between them is at or below the end of the first `RelationLevelRanges` band (vanilla -800).
 * Factions vanilla already lists keep vanilla's hand-made list.
 */
const FACTIONS = ["Bandits", "Monolith", "Duty", "Freedom", "Varta", "Neutrals", "Militaries", "Mercenaries", "Spark", "Corpus", "Scientists", "Noon", "Mutant"];

/** attacker -> the factions it gets to attack; computed from the relations in `relationPrototype` (SID Default). */
export function addedLairAttacks(relationPrototype: Struct): Record<string, string[]> {
  const restrictions = relationPrototype.ExpansionPolicies?.AttackLairRestrictions as Struct | undefined;
  const relations = relationPrototype.Relations as Struct | undefined;
  if (!restrictions || !relations) return {};
  const enemyAtOrBelow = Number(relationPrototype.RelationLevelRanges?.[0]?.end ?? -800);
  const listed = new Set(restrictions.entries().map(([k]) => String(k).split("->")[0]));
  const relation = new Map<string, number>();
  for (const [k, v] of relations.entries()) {
    const [a, b] = String(k).split("<->");
    relation.set(`${a}|${b}`, Number(v));
    if (!relation.has(`${b}|${a}`)) relation.set(`${b}|${a}`, Number(v));
  }
  const out: Record<string, string[]> = {};
  for (const a of FACTIONS) {
    if (listed.has(a)) continue;
    const enemies = FACTIONS.filter((b) => b !== a && (relation.get(`${a}|${b}`) ?? 0) <= enemyAtOrBelow);
    if (enemies.length) out[a] = enemies;
  }
  return out;
}

export function transformRelationPrototypes(struct: Struct) {
  const added = addedLairAttacks(struct);
  if (!Object.keys(added).length) return null;
  const fork = struct.fork();
  fork.ExpansionPolicies = struct.ExpansionPolicies.fork();
  fork.ExpansionPolicies.__internal__.bpatch = true;
  const restrictions = struct.ExpansionPolicies.AttackLairRestrictions.fork();
  restrictions.__internal__.bpatch = true;
  for (const [attacker, targets] of Object.entries(added))
    for (const target of targets) (restrictions as any)[`${attacker}->${target}`] = true;
  fork.ExpansionPolicies.AttackLairRestrictions = restrictions;
  return fork;
}

transformRelationPrototypes.files = ["/RelationPrototypes.cfg"];
