import type { LocationDetails, LocationRecord } from "../types/location";

export function toLocationDetails(record: LocationRecord): LocationDetails {
  return {
    englishName: record.englishName,
    chineseName: record.chineseName,
    localSummary: record.localSummary,
    whyItMatters: record.whyItMatters,
    bestFor: record.bestFor,
    notSuitableFor: record.notSuitableFor,
    bestSeason: record.bestSeason,
    suggestedTimeNeeded: record.suggestedTimeNeeded,
    walkingDifficulty: record.walkingDifficulty,
    stairs: record.stairs,
    youngChildSuitability: record.youngChildSuitability,
    strollerAccess: record.strollerAccess,
    parking: record.parking,
    restroom: record.restroom,
    publicTransportation: record.publicTransportation,
    bestTimeOfDay: record.bestTimeOfDay,
    rainConsiderations: record.rainConsiderations,
    safetyNotes: record.safetyNotes,
    lastPersonallyChecked: record.lastPersonallyChecked,
    sourceStatus: record.sourceStatus,
    nearbyPlaces: record.nearbyPlaces,
    mapLink: record.mapLink,
    relatedArticle: record.relatedArticle,
    videos: record.videos,
    relatedTopics: record.relatedTopics,
    relatedRoutes: record.relatedRoutes,
    relatedStories: record.relatedStories,
    author: record.author,
    gallery: record.gallery,
  };
}

export function validateLocationRecords(records: LocationRecord[]) {
  const seen = new Set<string>();
  for (const record of records) {
    if (!record.slug || !record.translationKey || !record.title || !record.englishName || !record.description || !record.localSummary) throw new Error(`Location is missing required identity or copy fields: ${record.slug || "unknown"}`);
    if (seen.has(record.slug)) throw new Error(`Duplicate location slug: ${record.slug}`);
    seen.add(record.slug);
    if (record.categories.length === 0) throw new Error(`Location needs at least one category: ${record.slug}`);
    if (new Set(record.categories).size !== record.categories.length) throw new Error(`Location has duplicate categories: ${record.slug}`);
    if (new Set(record.experienceCategories ?? []).size !== (record.experienceCategories?.length ?? 0)) throw new Error(`Location has duplicate experience categories: ${record.slug}`);
    if (new Set(record.mapExperienceFilters ?? []).size !== (record.mapExperienceFilters?.length ?? 0)) throw new Error(`Location has duplicate map experience filters: ${record.slug}`);
    if (new Set(record.relatedRouteIds ?? []).size !== (record.relatedRouteIds?.length ?? 0)) throw new Error(`Location has duplicate related route IDs: ${record.slug}`);
    if (new Set(record.relatedStoryIds ?? []).size !== (record.relatedStoryIds?.length ?? 0)) throw new Error(`Location has duplicate related story IDs: ${record.slug}`);
    if (record.image && (!record.imageAlt || !record.imageWidth || !record.imageHeight)) {
      throw new Error(`Location image is missing alt text or dimensions: ${record.slug}`);
    }
    if (record.sourceStatus === "checked-on-location" && !record.lastPersonallyChecked) {
      throw new Error(`On-location status requires a check date: ${record.slug}`);
    }
    if (record.recordStatus === "published" && !record.published) throw new Error(`Published location requires a publication date: ${record.slug}`);
    if (record.coordinates && (record.coordinates.latitude < -90 || record.coordinates.latitude > 90)) throw new Error(`Invalid latitude: ${record.slug}`);
    if (record.coordinates && (record.coordinates.longitude < -180 || record.coordinates.longitude > 180)) throw new Error(`Invalid longitude: ${record.slug}`);
  }
}
