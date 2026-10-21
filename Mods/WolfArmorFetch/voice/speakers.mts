import { characterOf, type Line, type Topic } from "../dialog.mts";

/** Dialog member -> the voice that speaks its lines (the `<speaker>` in `VO_<speaker>_<SID>`). */
const SPEAKER: Record<string, string> = { volk_0: "volk", volk_1: "volk", WolfArmorFetch_Bagor: "vasyan", army_0: "ward", sultan_0: "sultan" };

/** Who voices `line` of `topic`: Skif (`pc`) for the player, else the topic NPC's voice. */
export const speakerOf = (topic: Topic, line: Line) =>
  line.by === "player" ? "pc" : (SPEAKER[characterOf(topic)] ?? characterOf(topic));
