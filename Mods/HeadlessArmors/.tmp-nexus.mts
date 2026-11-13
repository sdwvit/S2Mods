import { api, getStoredIds, NEXUS_GAME_DOMAIN } from "../../src/publish/publish-nexus.mts";
import { finalizePublish } from "../../src/publish/publish-tracker.mts";
import { modMeta } from "../../src/mod-meta-paths.mts";
const meta = await modMeta;
const ids = getStoredIds()!;
const mod = await api<{ id: string }>(`/games/${NEXUS_GAME_DOMAIN}/mods/${ids.gameScopedId}`);
await api(`/mods/${mod.id}/changelogs`, { method: "POST", body: JSON.stringify({ version: "2026-11-13T134511.899Z", changelog: meta.changenote }) });
console.log("CHANGELOG OK");
finalizePublish("nexus", meta.changenote, new Date("2026-11-13T13:45:11.899Z"));
