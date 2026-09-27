import type { CreatorProfile } from "../types/social";

function isYouTubeChannel(url: URL) {
  if (!["youtube.com", "www.youtube.com"].includes(url.hostname)) return false;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 1) return parts[0].startsWith("@") && parts[0].length > 1;
  return parts.length === 2 && ["channel", "c", "user"].includes(parts[0]) && Boolean(parts[1]);
}

function isInstagramProfile(url: URL) {
  if (!["instagram.com", "www.instagram.com"].includes(url.hostname)) return false;
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.length === 1 && !["p", "reel", "tv"].includes(parts[0]);
}

export function validateCreatorProfiles(records: readonly CreatorProfile[]) {
  const ids = new Set<string>();
  const creatorPlatforms = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Duplicate creator profile ID: ${record.id}`);
    ids.add(record.id);
    const key = `${record.creatorId}:${record.platform}`;
    if (creatorPlatforms.has(key)) throw new Error(`Duplicate creator platform profile: ${key}`);
    creatorPlatforms.add(key);
    let url: URL;
    try { url = new URL(record.url); }
    catch { throw new Error(`Invalid creator profile URL: ${record.id}`); }
    if (url.protocol !== "https:") throw new Error(`Creator profile URL must use HTTPS: ${record.id}`);
    if (!record.label.trim()) throw new Error(`Creator profile needs a public label: ${record.id}`);
    const matches = record.platform === "youtube" ? isYouTubeChannel(url) : isInstagramProfile(url);
    if (!matches) throw new Error(`Creator profile URL does not match its platform: ${record.id}`);
  }
}

export function profilesForCreator(records: readonly CreatorProfile[], creatorId: string, includeDrafts = false) {
  return records.filter((record) => record.creatorId === creatorId && (includeDrafts || record.recordStatus === "published"));
}

export function creatorProfileUrls(records: readonly CreatorProfile[], creatorId: string) {
  return profilesForCreator(records, creatorId).map((record) => record.url);
}
