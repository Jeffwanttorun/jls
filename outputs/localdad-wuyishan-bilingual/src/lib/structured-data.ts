import { getEditorialDate } from "./dates";
import { getVideoEmbedUrl } from "./video";
import { localeInfo } from "../i18n/config";
import type { VideoRecord } from "../types/content";
interface BreadcrumbItem { name: string; url?: string; }

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

interface ArticleSchemaInput {
  title: string; description: string; url: string; published: Date; updated?: Date;
  language: string; image?: string; authorName?: string; authorUrl: string;
}

export function articleSchema(input: ArticleSchemaInput) {
  const isJeff = !input.authorName || input.authorName === "Jeff";
  const personId = `${input.authorUrl}${isJeff ? "#jeff" : "#person"}`;
  const author = {
    "@type": "Person",
    "@id": personId,
    name: input.authorName ?? "Jeff",
    url: input.authorUrl,
    ...(isJeff ? { homeLocation: { "@type": "Place", name: "Wuyishan, Fujian, China" } } : {}),
  };
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    datePublished: input.published.toISOString(),
    dateModified: getEditorialDate(input.published, input.updated).toISOString(),
    inLanguage: input.language,
    image: input.image,
    author,
    publisher: { "@type": "Person", "@id": personId, name: input.authorName ?? "Jeff", url: input.authorUrl },
  };
}

interface PersonSchemaInput {
  name: string;
  url: string;
  id?: string;
  alternateName?: string;
  description?: string;
  homeLocation?: string;
  jobTitle?: string;
  sameAs?: string[];
}

export function personEntity(input: PersonSchemaInput) {
  return {
    "@type": "Person",
    "@id": input.id ?? `${input.url}#person`,
    name: input.name,
    url: input.url,
    ...(input.alternateName ? { alternateName:input.alternateName } : {}),
    ...(input.description ? { description:input.description } : {}),
    ...(input.homeLocation ? { homeLocation:{ "@type":"Place", name:input.homeLocation } } : {}),
    ...(input.jobTitle ? { jobTitle:input.jobTitle } : {}),
    ...(input.sameAs?.length ? { sameAs:input.sameAs } : {}),
  };
}

export function personSchema(input: PersonSchemaInput) {
  return { "@context":"https://schema.org", ...personEntity(input) };
}

interface PlaceSchemaInput {
  name: string;
  url: string;
  description?: string;
  alternateName?: string;
  image?: string;
  containedInPlace?: string;
  latitude?: number;
  longitude?: number;
  schemaType?: "Place" | "TouristAttraction";
}

export function placeSchema(input: PlaceSchemaInput) {
  const hasCoordinates = input.latitude !== undefined && input.longitude !== undefined;
  return {
    "@context":"https://schema.org",
    "@type":input.schemaType ?? "Place",
    name:input.name,
    url:input.url,
    ...(input.description ? { description:input.description } : {}),
    ...(input.alternateName ? { alternateName:input.alternateName } : {}),
    ...(input.image ? { image:input.image } : {}),
    ...(input.containedInPlace ? { containedInPlace:{ "@type":"Place", name:input.containedInPlace } } : {}),
    ...(hasCoordinates ? { geo:{ "@type":"GeoCoordinates", latitude:input.latitude, longitude:input.longitude } } : {}),
  };
}

interface VideoSchemaInput {
  name: string;
  url: string;
  embedUrl?: string;
  description?: string;
  thumbnailUrl?: string;
  uploadDate?: Date;
  language?: string;
  transcript?: string;
}

export function videoSchema(input: VideoSchemaInput) {
  return {
    "@context":"https://schema.org",
    "@type":"VideoObject",
    name:input.name,
    url:input.url,
    ...(input.embedUrl ? { embedUrl:input.embedUrl } : {}),
    ...(input.description ? { description:input.description } : {}),
    ...(input.thumbnailUrl ? { thumbnailUrl:input.thumbnailUrl } : {}),
    ...(input.uploadDate ? { uploadDate:input.uploadDate.toISOString() } : {}),
    ...(input.language ? { inLanguage:input.language } : {}),
    ...(input.transcript ? { transcript:input.transcript } : {}),
  };
}

export function videoRecordSchema(record: VideoRecord, thumbnailUrl: string) {
  return videoSchema({
    name:record.title,
    url:record.url,
    embedUrl:getVideoEmbedUrl(record),
    description:record.description,
    thumbnailUrl,
    uploadDate:record.published,
    language:localeInfo[record.language].htmlLang,
    transcript:record.transcript?.format === "text" ? record.transcript.text : undefined,
  });
}
