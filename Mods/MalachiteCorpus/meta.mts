import { logger } from "../../src/logger.mts";
import { MetaType } from "../../src/meta-type.mts";
import { SpawnActorPrototype } from "s2cfgtojson";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
Replaces all MSOP guards with Corpus guards at Malachite Hub.
[hr][/hr]
Seems more fitting that way.
[hr][/hr]
bPatches /WorldMap_WP/Malahit_Hub_LogicLevel_WP/*.cfg
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer(struct: SpawnActorPrototype) {
  if (struct.OverrideFaction !== "NeutralMSOP") {
    return null;
  }
  const fork = struct.fork();
  fork.OverrideFaction = "Corpus";
  fork.SpawnedGenericMembers = struct.SpawnedGenericMembers.fork(true).map(([_k, e]) => {
    const eFork = e.fork();
    eFork.SpawnedPrototypeSID = msopToCorpusMap[e.SpawnedPrototypeSID];
    if (!eFork.SpawnedPrototypeSID) {
      logger.error(`No Corpus mapping for MSOP prototype ${e.SpawnedPrototypeSID}`);
      return null;
    }
    return eFork;
  });
  if (!fork.SpawnedGenericMembers.entries().length) {
    return null;
  }
  return fork;
}

structTransformer.files = ["/WorldMap_WP/Malahit_Hub_LogicLevel_WP/"];
structTransformer.contains = true;

const msopToCorpusMap: Record<string, string> = {
  GeneralNPC_NeutralMSOP_CloseCombat: "GeneralNPC_Corpus_CloseCombat",
  GeneralNPC_NeutralMSOP_Recon: "GeneralNPC_Corpus_Recon",
  GeneralNPC_NeutralMSOP_Stormtrooper: "GeneralNPC_Corpus_Stormtrooper",
  GeneralNPC_NeutralMSOP_Sniper: "GeneralNPC_Corpus_Sniper",
  GeneralNPC_NeutralMSOP_Heavy: "GeneralNPC_Corpus_Heavy",
};
