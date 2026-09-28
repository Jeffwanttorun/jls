import type { Locale } from "../i18n/config";
import type { Coordinates } from "./content";

export type KnowledgeVideoPlatform = "douyin" | "youtube" | "instagram" | "tiktok";

export interface KnowledgeVideo {
  platform: KnowledgeVideoPlatform;
  title: string;
  url: string;
  publishedAt?: string;
  language?: Locale;
}

export interface KnowledgeLink {
  title: string;
  url: string;
}

export interface KnowledgePhoto {
  src: string;
  altZh: string;
  altEn?: string;
}

export interface PlaceTrustStatus {
  firsthand?: boolean;
  checkedInPerson?: boolean;
  officialSource?: boolean;
  recheckBeforeGoing?: boolean;
}

export type KnowledgeRoutePlaceRole = "core-stop" | "secondary-stop" | "service" | "junction" | "observation" | "food";

export interface KnowledgeRoutePlaceRelationship {
  placeId: string;
  role: KnowledgeRoutePlaceRole;
}

export interface KnowledgePlace {
  id: string;
  nameZh: string;
  nameEn?: string;
  shortNameZh: string;
  shortNameEn?: string;
  englishNameStatus: "official" | "established" | "translated" | "pinyin" | "pending";
  labelPriority: 20 | 40 | 60 | 80 | 100;
  category: string;
  coordinates: Coordinates;
  region?: Partial<Record<Locale,string>>;
  summary?: Partial<Record<Locale,string>>;
  description?: Partial<Record<Locale,string>>;
  whyStop?: Partial<Record<Locale,string>>;
  firsthandNotes?: Partial<Record<Locale,string>>;
  practicalInfo?: Partial<Record<Locale,string[]>>;
  parking?: Partial<Record<Locale,string>>;
  toilet?: boolean;
  food?: boolean;
  shop?: boolean;
  lodging?: boolean;
  familyFriendly?: boolean;
  familyNotes?: Partial<Record<Locale,string>>;
  safetyNotes?: Partial<Record<Locale,string>>;
  accessNotes?: Partial<Record<Locale,string>>;
  seasonNotes?: Partial<Record<Locale,string>>;
  lastCheckedAt?: string;
  trustStatus?: PlaceTrustStatus;
  routeIds?: string[];
  previousPlaceId?: string;
  nextPlaceId?: string;
  nearbyPlaceIds?: string[];
  nearbyServiceIds?: string[];
  videos?: KnowledgeVideo[];
  storyLinks?: KnowledgeLink[];
  researchLinks?: KnowledgeLink[];
  photoGallery?: KnowledgePhoto[];
  themeIds?: string[];
  publicStatus?: string;
}

export interface KnowledgeRouteStage {
  id: string;
  titleZh: string;
  titleEn?: string;
  placeIds: string[];
}

export interface KnowledgeRoute {
  id: string;
  slug: string;
  published: boolean;
  featured: boolean;
  order: number;
  nameZh: string;
  nameEn: string;
  summaryZh?: string;
  summaryEn?: string;
  placeIds: string[];
  geometryRouteIds: string[];
  places: KnowledgeRoutePlaceRelationship[];
  stages: KnowledgeRouteStage[];
  practicalNotesZh?: string[];
  practicalNotesEn?: string[];
  videos?: KnowledgeVideo[];
  storyLinks?: KnowledgeLink[];
  researchLinks?: KnowledgeLink[];
}
