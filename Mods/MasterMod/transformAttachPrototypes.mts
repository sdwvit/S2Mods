/**
 * Increases cost of Attachments by 10x.
 */
export function transformAttachPrototypes(entries: { Cost: number }, { file }: { file: string }) {
  if (!file.includes("AttachPrototypes.cfg")) {
    return entries;
  }
  if (!entries.Cost) {
    return null;
  }
  return { Cost: entries.Cost * 10 };
}
