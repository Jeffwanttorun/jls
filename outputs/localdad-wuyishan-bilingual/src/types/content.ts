import type { TrustStatus } from "../data/editorial";
import type { TopicId } from "../data/topics";
import type { Locale } from "../i18n/config";
import type { ContentCategory } from "../data/content-categories";

export type { ContentCategory } from "../data/content-categories";
export type HeritageCategory = "natural-heritage" | "cultural-heritage" | "tea-heritage" | "living-heritage";
export type KnowledgeCategory = "overview" | HeritageCategory;
export type VideoRelationType = "place" | "person" | "story" | "topic" | "route";
export type VideoPlatform = "douyin" | "youtube" | "instagram" | "tiktok";
export type VideoProvider = VideoPlatform;
export type VideoContentType = "explanation" | "place-visit" | "route" | "interview" | "story";

export interface ContentReference {
  id: string;
  label: string;
  href: string;
}

export interface ContentAuthor {
  name: string;
  href?: string;
  role?: string;
}

export interface SourceReference {
  title: string;
  url?: string;
  publisher?: string;
  accessed?: Date;
}

export interface PracticalInformationItem {
  label: string;
  value: string;
}

export interface KeyVocabularyItem {
  term: string;
  meaning?: string;
}

export type LearningLevel = "beginner" | "intermediate" | "advanced" | "A2" | "A2-B1" | "B1" | "B1-B2" | "B2";

export interface LearningNotes {
  learningLevel?: LearningLevel;
  readingFocus?: string[];
  keyVocabulary?: KeyVocabularyItem[];
  usefulSentences?: string[];
  speakingTopic?: string;
  speakingPractice?: string[];
  guideUsage?: string[];
}

export type RouteTransportationType = "walking" | "cycling" | "driving" | "public-transport" | "mixed" | "other";

export interface RouteFields {
  routeName: string;
  distance?: string;
  estimatedDuration?: string;
  transportationType?: RouteTransportationType;
  highlights?: string[];
  routeLocations?: string[];
  transportNotes?: string[];
}

export interface ContentPhoto {
  src: string;
  alt: string;
  caption?: string;
  source?: string;
  photographer?: string;
  credit?: string;
  copyrightStatus?: "owned" | "licensed" | "permission-granted" | "public-domain" | "unconfirmed";
  photoLocation?: string;
  photoDate?: Date;
  relatedPlaceId?: string;
  width: number;
  height: number;
}

export type VideoRelationship =
  | { type: "topic"; slug: TopicId }
  | { type: Exclude<VideoRelationType, "topic">; slug: string };

export interface LinkedVideo {
  id?: string;
  title: string;
  url: string;
  provider?: VideoProvider;
  caption?: string;
  relationships: VideoRelationship[];
}

export interface VideoTranscript {
  language: Locale;
  format: "text" | "captions";
  text?: string;
  url?: string;
}

export interface VideoSocialMetadata {
  title?: string;
  description?: string;
  image?: ContentPhoto;
}

export interface VideoRecord extends Omit<LinkedVideo, "provider" | "id"> {
  slug: string;
  platform: VideoPlatform;
  language: Locale;
  contentType: VideoContentType;
  thumbnail?: ContentPhoto;
  description?: string;
  transcript?: VideoTranscript;
  social?: VideoSocialMetadata;
  published?: Date;
  updated?: Date;
  recordStatus: "draft" | "published";
}

export type CoordinateSystem = "WGS84" | "GCJ-02" | "BD-09";

export interface Coordinates {
  latitude: number;
  longitude: number;
  system: CoordinateSystem;
}

export interface SharedContentFields {
  contentCategory?: ContentCategory;
  heritageCategory?: KnowledgeCategory;
  heritageCategories?: HeritageCategory[];
  seoTitle?: string;
  englishName?: string;
  chineseName?: string;
  introduction?: string;
  summary?: string;
  whyItMatters?: string;
  keyIdeaIds?: TopicId[];
  learningNotes?: LearningNotes;
  historicalContext?: string;
  personalExperience?: string;
  practicalInformation?: PracticalInformationItem[];
  photos?: ContentPhoto[];
  videos?: LinkedVideo[];
  relatedPlaces?: ContentReference[];
  relatedPeople?: ContentReference[];
  relatedStories?: ContentReference[];
  relatedRoutes?: ContentReference[];
  relatedTopics?: TopicId[];
  relatedPlaceIds?: string[];
  relatedPersonIds?: string[];
  relatedStoryIds?: string[];
  relatedRouteIds?: string[];
  relatedKnowledgeIds?: string[];
  relatedGuideIds?: string[];
  sources?: SourceReference[];
  created?: Date;
  lastPersonallyChecked?: Date;
  trustStatus?: TrustStatus;
  author?: ContentAuthor;
}

export interface InterviewFields {
  personName: string;
  personChineseName?: string;
  shortIntroduction: string;
  interviewDate?: Date;
  interviewLocation?: string;
  interviewTheme?: string;
  relatedThemes?: TopicId[];
}
