import { getCollection } from "astro:content";
import { topicIds, topicRegistry } from "../data/topics";
import { locationDatabase } from "../data/locations";
import { videoDatabase } from "../data/videos";
import { imageDatabase } from "../data/image-assets";
import type { Locale } from "../i18n/config";
import { localizedPath } from "../i18n/config";
import type { ContentReference } from "../types/content";
import { buildContentRegistry, type ContentNodeInput, type ContentNodeType, type ContentRelationship } from "./relationships";
import { editorialPath } from "./localized-content";
import { hasMarkdownFiles } from "./content-files";

interface RegistryEditorialData {
  slug: string;
  translationKey: string;
  lang: Locale;
  title: string;
  recordStatus?: "draft" | "published";
  relatedPlaces?: ContentReference[];
  relatedPeople?: ContentReference[];
  relatedStories?: ContentReference[];
  relatedRoutes?: ContentReference[];
  relatedTopics?: string[];
  relatedThemes?: string[];
  routeLocations?: string[];
  relatedPlaceIds?: string[];
  relatedPersonIds?: string[];
  relatedStoryIds?: string[];
  relatedRouteIds?: string[];
  relatedKnowledgeIds?: string[];
  relatedGuideIds?: string[];
}

interface RegistryEntry { data: RegistryEditorialData; }

const referenceRelationships = (data: RegistryEditorialData): ContentRelationship[] => [
  ...(data.relatedPlaces ?? []).map((reference) => ({ targetType:"place" as const, targetId:reference.id })),
  ...(data.relatedPeople ?? []).map((reference) => ({ targetType:"person" as const, targetId:reference.id })),
  ...(data.relatedStories ?? []).map((reference) => ({ targetType:"story" as const, targetId:reference.id })),
  ...(data.relatedRoutes ?? []).map((reference) => ({ targetType:"route" as const, targetId:reference.id })),
  ...[...(data.relatedTopics ?? []), ...(data.relatedThemes ?? [])].map((id) => ({ targetType:"topic" as const, targetId:id })),
  ...(data.relatedPlaceIds ?? []).map((id) => ({ targetType:"place" as const, targetId:id })),
  ...(data.relatedPersonIds ?? []).map((id) => ({ targetType:"person" as const, targetId:id })),
  ...(data.relatedStoryIds ?? []).map((id) => ({ targetType:"story" as const, targetId:id })),
  ...(data.relatedRouteIds ?? []).map((id) => ({ targetType:"route" as const, targetId:id })),
  ...(data.relatedKnowledgeIds ?? []).map((id) => ({ targetType:"knowledge" as const, targetId:id })),
  ...(data.relatedGuideIds ?? []).map((id) => ({ targetType:"guide" as const, targetId:id })),
];

function editorialNodes(entries: readonly RegistryEntry[], type: ContentNodeType, section: string): ContentNodeInput[] {
  return entries.map(({ data }) => ({
    type,
    id:data.translationKey,
    labels:{ [data.lang]:data.title },
    hrefs:data.recordStatus === "published" ? { [data.lang]:editorialPath(section, data.slug, data.lang) } : undefined,
    relationships:[...referenceRelationships(data), ...(data.routeLocations ?? []).map((id) => ({ targetType:"place" as const, targetId:id }))],
  }));
}

async function collectionEntries(name: "knowledgeArticles" | "routes" | "people" | "localStories", path: string) {
  return hasMarkdownFiles(path) ? getCollection(name) : [];
}

async function createSiteContentRegistry() {
  const [knowledge, routes, people, stories, guides] = await Promise.all([
    collectionEntries("knowledgeArticles", "./src/content/knowledge"),
    collectionEntries("routes", "./src/content/routes"),
    collectionEntries("people", "./src/content/people"),
    collectionEntries("localStories", "./src/content/local-stories"),
    getCollection("guides"),
  ]) as unknown as [RegistryEntry[], RegistryEntry[], RegistryEntry[], RegistryEntry[], RegistryEntry[]];

  const inputs: ContentNodeInput[] = [
    ...topicIds.map((id) => ({ type:"topic" as const, id, labels:{ en:topicRegistry[id].label }, relationships:[] })),
    ...locationDatabase.map((place) => ({
      type:"place" as const,
      id:place.slug,
      labels:{ en:place.englishName, ...(place.chineseName ? { zh:place.chineseName } : {}) },
      hrefs:{ en:localizedPath(`/locations/${place.slug}`, "en") },
      relationships:[
        ...(place.relatedTopics ?? []).map((id) => ({ targetType:"topic" as const, targetId:id })),
        ...(place.relatedRoutes ?? []).map((reference) => ({ targetType:"route" as const, targetId:reference.id })),
        ...(place.relatedStories ?? []).map((reference) => ({ targetType:"story" as const, targetId:reference.id })),
        ...(place.relatedRouteIds ?? []).map((id) => ({ targetType:"route" as const, targetId:id })),
        ...(place.relatedStoryIds ?? []).map((id) => ({ targetType:"story" as const, targetId:id })),
      ],
    })),
    ...editorialNodes(knowledge, "knowledge", "why-wuyishan"),
    ...guides.map(({ data }) => ({
      type:"guide" as const,
      id:data.translationKey,
      labels:{ [data.lang]:data.title },
      hrefs:data.recordStatus === "published" ? { [data.lang]:localizedPath(`/${data.slug}`, data.lang) } : undefined,
      relationships:referenceRelationships(data),
    })),
    ...editorialNodes(routes, "route", "routes"),
    ...editorialNodes(people, "person", "people"),
    ...editorialNodes(stories, "story", "local-stories"),
    ...videoDatabase.map((video) => ({
      type:"video" as const,
      id:video.slug,
      labels:{ [video.language]:video.title },
      hrefs:{ [video.language]:video.url },
      relationships:video.relationships.map((relationship) => ({ targetType:relationship.type, targetId:relationship.slug })),
    })),
    ...imageDatabase.map((image) => ({
      type:"image" as const,
      id:image.id,
      labels:{ en:image.caption ?? image.alt },
      relationships:[
        ...[...new Set([...(image.relatedPlaceId ? [image.relatedPlaceId] : []), ...image.relatedPlaceIds])].map((id) => ({ targetType:"place" as const, targetId:id })),
        ...image.relatedTopicIds.map((id) => ({ targetType:"topic" as const, targetId:id })),
        ...image.relatedArticles.map((article) => ({ targetType:article.type, targetId:article.id })),
        ...image.relatedVideoIds.map((id) => ({ targetType:"video" as const, targetId:id })),
      ],
    })),
  ];

  return buildContentRegistry(inputs);
}

let registryPromise: ReturnType<typeof createSiteContentRegistry> | undefined;

export function buildSiteContentRegistry() {
  registryPromise ??= createSiteContentRegistry();
  return registryPromise;
}
