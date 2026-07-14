import type {
  EffectPrototype,
  TeleportPrototype,
  QuestNodePrototype,
  EGSCTeleportType,
} from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
Changes all teleports to instant — no fade, no delay, no loading screen blur.
[hr][/hr]
[list]
[*] All effect-based teleports are instant
[*] All teleport prototypes are instant
[*] All quest teleport nodes are instant
[/list]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
  structTransformers: [
    transformEffectPrototypes,
    transformTeleportPrototypes,
    transformQuestNodePrototypes,
  ],
};

const TP_INSTANT = "EGSCTeleportType::Instant" satisfies EGSCTeleportType;
const TP_NONE = "EGSCTeleportType::None" satisfies EGSCTeleportType;

function transformEffectPrototypes(struct: EffectPrototype) {
  if (
    struct.TeleportType != null &&
    struct.TeleportType !== TP_INSTANT &&
    struct.TeleportType !== TP_NONE
  ) {
    const fork = struct.fork();
    fork.TeleportType = TP_INSTANT;
    return fork;
  }
}

transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];

function transformTeleportPrototypes(struct: TeleportPrototype) {
  if (
    struct.TeleportType != null &&
    struct.TeleportType !== TP_INSTANT &&
    struct.TeleportType !== TP_NONE
  ) {
    const fork = struct.fork();
    fork.TeleportType = TP_INSTANT;
    return fork;
  }
}

transformTeleportPrototypes.files = ["/TeleportPrototypes.cfg"];

function transformQuestNodePrototypes(struct: QuestNodePrototype) {
  const teleportType = (struct as unknown as { TeleportType?: EGSCTeleportType }).TeleportType;
  if (teleportType != null && teleportType !== TP_INSTANT && teleportType !== TP_NONE) {
    const fork = struct.fork();
    (fork as unknown as { TeleportType: EGSCTeleportType }).TeleportType = TP_INSTANT;
    return fork;
  }
}

transformQuestNodePrototypes.contains = true;
transformQuestNodePrototypes.files = ["QuestNodePrototypes"];
