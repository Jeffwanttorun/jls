import type { VideoRecord } from "../types/content";
import { getVideoEmbedUrl, validateVideoPlatformUrl } from "../lib/video";
import { authoredVideoRecords } from "./video-sources";

// Add only confirmed video records. Relationships are explicit and reviewed.
const legacyVideoRecords: readonly VideoRecord[] = [];
export const videoDatabase: readonly VideoRecord[] = [...legacyVideoRecords, ...authoredVideoRecords];

export function validateVideoDatabase(records: readonly VideoRecord[]) {
  const slugs = new Set<string>();
  for (const record of records) {
    if (slugs.has(record.slug)) throw new Error(`Duplicate video slug: ${record.slug}`);
    slugs.add(record.slug);
    try { validateVideoPlatformUrl(record); }
    catch { throw new Error(`Video URL does not match its platform: ${record.slug}`); }
    if (record.thumbnail && (!record.thumbnail.alt || !record.thumbnail.width || !record.thumbnail.height)) {
      throw new Error(`Video thumbnail is missing alt text or dimensions: ${record.slug}`);
    }
    if (record.social?.image && (!record.social.image.alt || !record.social.image.width || !record.social.image.height)) {
      throw new Error(`Video social image is missing alt text or dimensions: ${record.slug}`);
    }
    if (record.transcript) {
      const sources = Number(Boolean(record.transcript.text?.trim())) + Number(Boolean(record.transcript.url));
      if (sources !== 1) throw new Error(`Video transcript needs exactly one text or URL source: ${record.slug}`);
      if (record.transcript.url) {
        try { new URL(record.transcript.url, "https://local.invalid"); }
        catch { throw new Error(`Invalid video transcript URL: ${record.slug}`); }
      }
    }
    if (record.recordStatus === "published" && (!record.published || !record.thumbnail || !record.description?.trim())) {
      throw new Error(`Published video requires a description, publication date, and thumbnail: ${record.slug}`);
    }
    if (record.recordStatus === "published" && record.relationships.length === 0) {
      throw new Error(`Published video requires at least one reviewed content relationship: ${record.slug}`);
    }
    const relationships = new Set<string>();
    for (const relationship of record.relationships) {
      const key = `${relationship.type}:${relationship.slug}`;
      if (relationships.has(key)) throw new Error(`Duplicate relationship on video ${record.slug}: ${key}`);
      relationships.add(key);
    }
  }
}

export function buildReverseVideoIndex(records: readonly VideoRecord[]) {
  const index = new Map<string, VideoRecord[]>();
  for (const record of records) {
    for (const relationship of record.relationships) {
      const key = `${relationship.type}:${relationship.slug}`;
      index.set(key, [...(index.get(key) ?? []), record]);
    }
  }
  return index;
}

export function getVideoEmbedUrls(records: readonly VideoRecord[]) {
  return Object.fromEntries(records.map((record) => [record.slug, getVideoEmbedUrl(record)]));
}

validateVideoDatabase(videoDatabase);

export const publishedVideos = videoDatabase.filter((video) => video.recordStatus === "published");
export const videosBySlug = Object.fromEntries(videoDatabase.map((video) => [video.slug, video])) as Record<string, VideoRecord>;
export const reverseVideoIndex = buildReverseVideoIndex(videoDatabase);

export function getVideo(slug: string) {
  return videosBySlug[slug];
}
