import { RelationPrototype } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";

/**
 * Fixes some of the relationships
 */
export const transformRelationPrototypes: StructTransformer<RelationPrototype> = async (struct) => {
  const fork = struct.fork();

  fork.Relations = struct.Relations.fork();

  fork.Relations["Bandits<->Mercenaries"] = 0;
  fork.Relations["Mercenaries<->Bandits"] = 0;
  fork.Relations["Bandits<->Freedom"] = 0;
  fork.Relations["Freedom<->Bandits"] = 0;
  fork.Relations["Freedom<->Mercenaries"] = 0;
  fork.Relations["Mercenaries<->Freedom"] = 0;

  fork.Relations["Mercenaries<->Duty"] = -10000;
  fork.Relations["Duty<->Mercenaries"] = -10000;

  fork.Relations["Mercenaries<->FreeStalkers"] = -10000;
  fork.Relations["FreeStalkers<->Mercenaries"] = -10000;
  fork.Relations["Mercenaries<->Militaries"] = -10000;
  fork.Relations["Militaries<->Mercenaries"] = -10000;
  fork.Relations["Mercenaries<->Spark"] = 0;
  fork.Relations["Spark<->Mercenaries"] = 0;

  fork.Relations["Mercenaries<->Varta"] = 0;
  fork.Relations["Varta<->Mercenaries"] = 0;

  fork.Relations["Freedom<->Duty"] = -10000;
  fork.Relations["Duty<->Freedom"] = -10000;

  fork.Relations["Varta<->Spark"] = -10000;
  fork.Relations["Spark<->Varta"] = -10000;

  return fork;
};

transformRelationPrototypes.files = ["/RelationPrototypes.cfg"];
