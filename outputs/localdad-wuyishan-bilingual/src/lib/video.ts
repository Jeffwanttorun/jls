import { localeInfo } from "../i18n/config";
import type { VideoRecord, VideoRelationType } from "../types/content";

function youtubeId(url: URL) {
  if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0];
  if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com" || url.hostname === "m.youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v") ?? undefined;
    const [section, id] = url.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(section)) return id;
  }
  return undefined;
}

function instagramPath(url: URL) {
  if (url.hostname !== "www.instagram.com" && url.hostname !== "instagram.com") return undefined;
  const [section, id] = url.pathname.split("/").filter(Boolean);
  if (!["p", "reel", "tv"].includes(section) || !id) return undefined;
  return `/${section}/${id}/`;
}

export function getVideoEmbedUrl(video: Pick<VideoRecord, "platform" | "url">) {
  const url = new URL(video.url);
  if (url.protocol !== "https:") throw new Error(`Video URL must use HTTPS: ${video.url}`);
  if (video.platform === "youtube") {
    const id = youtubeId(url);
    if (!id) throw new Error(`Invalid YouTube video URL: ${video.url}`);
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
  }
  const path = instagramPath(url);
  if (!path) throw new Error(`Invalid Instagram video URL: ${video.url}`);
  return `https://www.instagram.com${path}embed/`;
}

export function validateVideoPlatformUrl(video: Pick<VideoRecord, "platform" | "url">) {
  getVideoEmbedUrl(video);
}

export function videosForRelationship(records: readonly VideoRecord[], type: VideoRelationType, id: string, includeDrafts = false) {
  return records.filter((video) => (includeDrafts || video.recordStatus === "published") && video.relationships.some((relationship) => relationship.type === type && relationship.slug === id));
}

export function getVideoSocialMetadata(video: VideoRecord) {
  return {
    title: video.social?.title ?? video.title,
    description: video.social?.description ?? video.description,
    image: video.social?.image ?? video.thumbnail,
    language: localeInfo[video.language].htmlLang,
  };
}
