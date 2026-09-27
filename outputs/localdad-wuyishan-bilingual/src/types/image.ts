import type { TopicId } from "../data/topics";

export type ImageCopyrightStatus = "owned" | "licensed" | "permission-granted" | "public-domain" | "unconfirmed";
export type ImageArticleType = "knowledge" | "route" | "story";

export interface ImageVariant {
  src: string;
  format: "jpeg" | "webp" | "avif";
  width: number;
  height: number;
  bytes: number;
}

export interface ImageArticleRelationship {
  type: ImageArticleType;
  id: string;
}

export interface ImageAssetRecord {
  id: string;
  filename: string;
  alt: string;
  caption?: string;
  source?: string;
  credit?: string;
  /** Legacy combined field retained for existing records. */
  creditSource?: string;
  copyrightStatus: ImageCopyrightStatus;
  photographer?: string;
  photoLocation?: string;
  photoDate?: Date;
  relatedPlaceId?: string;
  captureDate?: Date;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  src: string;
  srcset: string;
  avifSrcset: string;
  webpSrcset: string;
  width: number;
  height: number;
  variants: ImageVariant[];
  relatedPlaceIds: string[];
  relatedTopicIds: TopicId[];
  relatedArticles: ImageArticleRelationship[];
  relatedVideoIds: string[];
  recordStatus: "draft" | "published";
}
