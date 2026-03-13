import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";

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
  changenote: "Improved compatibility with recent game updates.",
  structTransformers: [structTransformer],
};

function structTransformer(struct: QuestNodePrototype) {
  if (struct.SID === "E01_MQ01_Technical_NoIntro" || struct.SID === "E01_MQ01_PlayVideo") {
    const launchers = (struct as any).Launchers;
    if (typeof launchers === "string") {
      return null;
    }
    const fork = struct.fork();

    (fork as any).Launchers = new Struct().fork();
    (fork as any).Launchers[0] = new Struct().fork();
    (fork as any).Launchers[0].Connections = new Struct().fork();
    (fork as any).Launchers[0].Connections[0] = new Struct().fork();
    if (struct.SID === "E01_MQ01_Technical_NoIntro") {
      (fork as any).Launchers[0].Connections[0].SID = "E01_MQ01_Start";
      return fork;
    }
    if (struct.SID === "E01_MQ01_PlayVideo") {
      (fork as any).Launchers[0].Connections[0].SID = "empty";
      return fork;
    }
    return null;
  }
}

structTransformer.files = ["/QuestNodePrototypes/E01_MQ01.cfg"];
