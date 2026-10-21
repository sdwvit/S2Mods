/**
 * Writes the recording sheet for Cover Story: every spoken line in dialog order, with its phrase SID and
 * speaker, for `/media/nvme/vm/voice-clone/scripts/record_lines.py`.
 * usage: node Mods/WolfArmorFetch/voice/cover-lines.mts [out.json]
 */
import { writeFileSync } from "node:fs";
import { COVER_TOPICS } from "../coverDialog.mts";
import { isBranch, isPicker, lineSID, type Label, type Next, type Topic } from "../dialog.mts";
import { speakerOf } from "./speakers.mts";

const out: { sid: string; speaker: string; text: string; en: string }[] = [];
const seen = new Set<string>();
const walk = (topic: Topic, next: Next | undefined) => {
  if (!next) return;
  if (isPicker(next)) return next.choices.forEach((c) => walk(topic, c));
  if (isBranch(next)) return walk(topic, next.then), walk(topic, next.else);
  const label = next as Label;
  if (seen.has(lineSID(topic, label, 0))) return;
  seen.add(lineSID(topic, label, 0));
  label.lines.forEach((line, i) =>
    out.push({
      sid: lineSID(topic, label, i),
      speaker: speakerOf(topic, line),
      text: line.text.Ukrainian,
      en: line.text.English,
    }),
  );
  walk(topic, label.next);
};
COVER_TOPICS.forEach((t) => walk(t, t.opening));
writeFileSync(process.argv[2] ?? "/media/nvme/vm/voice-clone/perform_cover.json", JSON.stringify(out, null, 1));
console.log(out.length, "lines;", Object.entries(Object.groupBy(out, (l) => l.speaker)).map(([k, v]) => `${k} ${v!.length}`).join(", "));
