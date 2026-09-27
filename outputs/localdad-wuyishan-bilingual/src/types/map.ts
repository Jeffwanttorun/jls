import type { Locale, RoutingMode } from "../i18n/config";
import type { ContentReference, Coordinates, LinkedVideo, PracticalInformationItem } from "./content";
import type { LocationCategory } from "./location";
import type { TopicId } from "../data/topics";
import type { MapFilterId } from "../data/map-filters";

export interface MapPlace {
  id: string;
  href: string;
  name: string;
  alternateName?: string;
  summary?: string;
  locale: Locale;
  translationStatus: "complete" | "partial";
  coordinates: Coordinates;
  categories: LocationCategory[];
  topics: TopicId[];
  filterIds: MapFilterId[];
  practicalInformation: PracticalInformationItem[];
  relatedRoutes: ContentReference[];
  relatedStories: ContentReference[];
  relatedVideos: LinkedVideo[];
}

export interface MapRouteGeometry {
  id: string;
  names: { en: string; zh?: string };
  path: Coordinates[];
  relatedPlaceIds: string[];
  topics: TopicId[];
}

export interface MapDataset {
  locale: Locale;
  routingMode: RoutingMode;
  places: MapPlace[];
  routes: MapRouteGeometry[];
}

export interface MapTileConfiguration {
  urlTemplate: string;
  attribution: string;
  maxZoom?: number;
}

export interface MapExplorerLabels {
  map: string;
  filters: string;
  relatedContent: string;
  openPlace: string;
  enableInteraction: string;
}
