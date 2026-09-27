import { localizedPath, type Locale, type RoutingMode } from "../i18n/config";
import { mapFiltersForTopics } from "../data/map-filters";
import type { LocationRecord } from "../types/location";
import type { MapDataset, MapPlace, MapRouteGeometry } from "../types/map";
import type { VideoRecord } from "../types/content";
import { buildPlaceContentNetwork } from "./place-network";
import type { ContentRegistry } from "./relationships";

export function toMapPlace(record: LocationRecord, locale: Locale, routingMode: RoutingMode = "current", videos: readonly VideoRecord[] = [], registry?: ContentRegistry): MapPlace | undefined {
  if (!record.coordinates) return undefined;
  if (record.coordinates.system !== "WGS84") throw new Error(`Leaflet map data requires WGS84 coordinates: ${record.slug}`);
  const chineseName = record.chineseName;
  const chineseSummary = record.localizations?.chineseSummary;
  const isChinese = locale === "zh";
  const network = buildPlaceContentNetwork(record, videos, registry, locale);
  return {
    id:record.slug,
    href:localizedPath(`/locations/${record.slug}`, locale, routingMode),
    name:isChinese ? chineseName ?? record.englishName : record.englishName,
    shortName:isChinese ? chineseName ?? record.englishName : record.englishName,
    labelPriority:60,
    category:record.categories[0] ?? "place",
    alternateName:isChinese ? record.englishName : chineseName,
    summary:isChinese ? chineseSummary : record.localSummary,
    locale,
    translationStatus:isChinese && (!chineseName || !chineseSummary) ? "partial" : "complete",
    coordinates:record.coordinates,
    categories:record.categories,
    topics:network.topics,
    filterIds:[...mapFiltersForTopics(network.topics), ...(record.mapExperienceFilters ?? [])],
    practicalInformation:record.localizations?.practicalInformation?.[locale] ?? [],
    relatedRoutes:network.routes,
    relatedStories:network.stories,
    relatedVideos:network.videos,
  };
}

export function buildMapDataset(records: readonly LocationRecord[], routes: readonly MapRouteGeometry[], locale: Locale, routingMode: RoutingMode = "current", videos: readonly VideoRecord[] = [], registry?: ContentRegistry): MapDataset {
  return {
    locale,
    routingMode,
    places:records.filter((record) => record.recordStatus === "published").map((record) => toMapPlace(record, locale, routingMode, videos, registry)).filter((place): place is MapPlace => Boolean(place)),
    routes:[...routes],
  };
}

export function validateMapRoutes(routes: readonly MapRouteGeometry[], locationIds: ReadonlySet<string>) {
  const routeIds = new Set<string>();
  for (const route of routes) {
    if (routeIds.has(route.id)) throw new Error(`Duplicate map route ID: ${route.id}`);
    routeIds.add(route.id);
    if (route.path.length < 2) throw new Error(`Map route needs at least two verified coordinates: ${route.id}`);
    if (route.path.some((point) => point.system !== "WGS84")) throw new Error(`Map route requires WGS84 coordinates: ${route.id}`);
    for (const placeId of route.relatedPlaceIds) if (!locationIds.has(placeId)) throw new Error(`Map route ${route.id} references unknown place: ${placeId}`);
  }
}
