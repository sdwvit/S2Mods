import type { ArtifactPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

/**
 * Remove an essential flag from various items
 */
export const transformQuestArtifactPrototypes: StructTransformer<ArtifactPrototype> = async (struct) => {
  if (struct.IsQuestItem) {
    return Object.assign(struct.fork(), { IsQuestItem: false });
  }
  return null;
};
transformQuestArtifactPrototypes.files = ["/QuestArtifactPrototypes.cfg"];
