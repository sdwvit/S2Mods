import { MetaType } from "../../src/meta-type.mts";
import { QuestNodePrototype, Struct } from "s2cfgtojson";

export const meta: MetaType<QuestNodePrototype> = {
  description: `
Skip Intro Cutscene
[hr][/hr]
Tired of watching the same intro cutscene in every new game?[h1][/h1]
Say no more![h1][/h1]
[hr][/hr]
Skips intro cutscene in E01_MQ01 by redirecting the quest flow in QuestNodePrototypes.[h1][/h1]
Just start a new game, hit escape, then back to fix the sound and you're good to go[h1][/h1]
`,
  changenote: "Update to 1.7.x",
  structTransformers: [structTransformer],
};

function structTransformer(struct: QuestNodePrototype) {
  if (struct.SID === "E01_MQ01_Technical_NoIntro" || struct.SID === "E01_MQ01_PlayVideo") {
    const fork = struct.fork();

    fork.Launchers = new Struct().fork() as any;
    fork.Launchers[0] = new Struct().fork();
    fork.Launchers[0].Connections = new Struct().fork();
    fork.Launchers[0].Connections[0] = new Struct().fork();
    if (struct.SID === "E01_MQ01_Technical_NoIntro") {
      fork.Launchers[0].Connections[0].SID = "E01_MQ01_Start";
      return fork;
    }
    if (struct.SID === "E01_MQ01_PlayVideo") {
      fork.Launchers[0].Connections[0].SID = "empty";
      return fork;
    }
    return null;
  }
}

structTransformer.files = ["/QuestNodePrototypes/E01_MQ01.cfg"];
