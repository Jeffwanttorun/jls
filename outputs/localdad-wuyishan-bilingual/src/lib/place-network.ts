import type { TopicId } from "../data/topics";
import type { ContentReference, LinkedVideo, VideoRecord } from "../types/content";
import type { LocationRecord } from "../types/location";
import type { Locale } from "../i18n/config";
import { resolveContentReferences, type ContentRegistry } from "./relationships";

export interface PlaceContentNetwork {
  placeId: string;
  topics: TopicId[];
  routes: ContentReference[];
  stories: ContentReference[];
  videos: LinkedVideo[];
}

export function buildPlaceContentNetwork(record: LocationRecord, videos: readonly VideoRecord[] = [], registry?: ContentRegistry, locale: Locale = "en"): PlaceContentNetwork {
  const linkedVideos = videos
    .filter((video) => video.relationships.some((relationship) => relationship.type === "place" && relationship.slug === record.slug))
    .map((video): LinkedVideo => ({ id:video.slug, title:video.title, url:video.url, provider:video.platform, caption:video.caption, relationships:video.relationships }));
  const videoUrls = new Set(record.videos?.map((video) => video.url) ?? []);
  if ((record.relatedRouteIds?.length || record.relatedStoryIds?.length) && !registry) throw new Error(`Place ${record.slug} needs the unified content registry to resolve stable relationship IDs.`);
  const resolvedRoutes = registry ? resolveContentReferences(registry, "route", record.relatedRouteIds ?? [], locale) : [];
  const resolvedStories = registry ? resolveContentReferences(registry, "story", record.relatedStoryIds ?? [], locale) : [];
  return {
    placeId: record.slug,
    topics: [...(record.relatedTopics ?? [])],
    routes: [...(record.relatedRoutes ?? []), ...resolvedRoutes],
    stories: [...(record.relatedStories ?? []), ...resolvedStories],
    videos: [...(record.videos ?? []), ...linkedVideos.filter((video) => !videoUrls.has(video.url))],
  };
}
