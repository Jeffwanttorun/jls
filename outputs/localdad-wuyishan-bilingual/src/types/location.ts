import type { TrustStatus } from "../data/editorial";
import type { Locale } from "../i18n/config";
import type { ContentAuthor, ContentPhoto, ContentReference, Coordinates, LinkedVideo, PracticalInformationItem } from "./content";
import type { TopicId } from "../data/topics";
import type { MapExperienceFilterId } from "../data/map-filters";
import type { ExperienceCategoryId } from "../data/experience-categories";

export interface LocationLink {
  label: string;
  href?: string;
}

export type LocationPhoto = ContentPhoto;

export interface LocationLocalizations {
  chineseSummary?: string;
  practicalInformation?: Partial<Record<Locale, PracticalInformationItem[]>>;
}

export interface LocationDetails {
  englishName: string;
  chineseName?: string;
  localSummary: string;
  whyItMatters?: string;
  bestFor: string[];
  notSuitableFor?: string[];
  bestSeason?: string;
  suggestedTimeNeeded?: string;
  walkingDifficulty?: string;
  stairs?: string;
  youngChildSuitability?: string;
  strollerAccess?: string;
  parking?: string;
  restroom?: string;
  publicTransportation?: string;
  bestTimeOfDay?: string;
  rainConsiderations?: string;
  safetyNotes?: string;
  lastPersonallyChecked?: Date;
  sourceStatus: TrustStatus;
  nearbyPlaces: LocationLink[];
  mapLink?: string;
  relatedArticle?: LocationLink;
  videos?: LinkedVideo[];
  relatedTopics?: TopicId[];
  relatedRoutes?: ContentReference[];
  relatedStories?: ContentReference[];
  relatedRouteIds?: string[];
  relatedStoryIds?: string[];
  author?: ContentAuthor;
  gallery: LocationPhoto[];
}

export interface LocationPageData extends LocationDetails {
  slug: string;
  title: string;
  description: string;
  area?: string;
  lang?: Locale;
  image?: string;
  imageWebp?: string;
  imageSrcset?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageNeedsReplacement?: boolean;
  coordinates?: Coordinates;
  mapNote?: string;
  schemaType?: "Place" | "TouristAttraction";
  parentHref?: string;
  parentLabel?: string;
}

export type LocationCategory = "river" | "peak" | "trail" | "tea-area" | "village" | "neighborhood" | "recreation-area";
export type LocationRecordStatus = "draft" | "published";

export interface LocationRecord extends LocationPageData {
  translationKey: string;
  categories: LocationCategory[];
  experienceCategories?: ExperienceCategoryId[];
  mapExperienceFilters?: MapExperienceFilterId[];
  localizations?: LocationLocalizations;
  audience: string[];
  order: number;
  featured: boolean;
  recordStatus: LocationRecordStatus;
  published?: Date;
  updated?: Date;
}
