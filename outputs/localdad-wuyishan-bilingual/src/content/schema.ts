import { z } from "astro:content";
import { topicIds } from "../data/topics";
import { contentCategoryIds } from "../data/content-categories";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const contentReferenceSchema = z.object({
  id: z.string().regex(slugPattern),
  label: z.string().min(1),
  href: z.string().startsWith("/", "Related content must use an internal path."),
});

export const sourceReferenceSchema = z.object({
  title: z.string().min(1),
  seoTitle: z.string().min(1).max(70).optional(),
  url: z.string().url().optional(),
  publisher: z.string().min(1).optional(),
  accessed: z.coerce.date().optional(),
});

export const authorSchema = z.object({
  name: z.string().min(1),
  href: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
});

export const practicalInformationSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const learningNotesSchema = z.object({
  learningLevel: z.enum(["beginner", "intermediate", "advanced", "A2", "A2-B1", "B1", "B1-B2", "B2"]).optional(),
  readingFocus: z.array(z.string().min(1)).default([]),
  keyVocabulary: z.array(z.object({ term:z.string().min(1), meaning:z.string().min(1).optional() })).default([]),
  usefulSentences: z.array(z.string().min(1)).default([]),
  speakingTopic: z.string().min(1).optional(),
  speakingPractice: z.array(z.string().min(1)).default([]),
  guideUsage: z.array(z.string().min(1)).default([]),
});

export const photoSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  photographer: z.string().min(1).optional(),
  credit: z.string().min(1).optional(),
  copyrightStatus: z.enum(["owned", "licensed", "permission-granted", "public-domain", "unconfirmed"]).optional(),
  photoLocation: z.string().min(1).optional(),
  photoDate: z.coerce.date().optional(),
  relatedPlaceId: z.string().regex(slugPattern).optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const videoRelationshipSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("topic"), slug: z.enum(topicIds) }),
  z.object({ type: z.enum(["place", "person", "story", "route"]), slug: z.string().regex(slugPattern) }),
]);

export const linkedVideoSchema = z.object({
  id: z.string().regex(slugPattern).optional(),
  title: z.string().min(1),
  url: z.string().url(),
  provider: z.enum(["youtube", "instagram"]).optional(),
  caption: z.string().min(1).optional(),
  relationships: z.array(videoRelationshipSchema).default([]),
});

export const editorialFields = {
  title: z.string().min(1),
  seoTitle: z.string().min(1).max(70).optional(),
  slug: z.string().regex(slugPattern),
  description: z.string().min(50).max(180),
  eyebrow: z.string().min(1),
  lang: z.enum(["en", "zh"]).default("en"),
  translationKey: z.string().min(1),
  audience: z.array(z.string()).default([]),
  contentCategory: z.enum(contentCategoryIds).optional(),
  created: z.coerce.date().optional(),
  published: z.coerce.date().optional(),
  updated: z.coerce.date().optional(),
  lastPersonallyChecked: z.coerce.date().optional(),
  englishName: z.string().min(1).optional(),
  chineseName: z.string().min(1).optional(),
  introduction: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  whyItMatters: z.string().min(1).optional(),
  keyIdeaIds: z.array(z.enum(topicIds)).default([]),
  learningNotes: learningNotesSchema.optional(),
  historicalContext: z.string().min(1).optional(),
  personalExperience: z.string().min(1).optional(),
  practicalInformation: z.array(practicalInformationSchema).default([]),
  photos: z.array(photoSchema).default([]),
  videos: z.array(linkedVideoSchema).default([]),
  relatedPlaces: z.array(contentReferenceSchema).default([]),
  relatedPeople: z.array(contentReferenceSchema).default([]),
  relatedStories: z.array(contentReferenceSchema).default([]),
  relatedRoutes: z.array(contentReferenceSchema).default([]),
  relatedTopics: z.array(z.enum(topicIds)).default([]),
  relatedPlaceIds: z.array(z.string().regex(slugPattern)).default([]),
  relatedPersonIds: z.array(z.string().regex(slugPattern)).default([]),
  relatedStoryIds: z.array(z.string().regex(slugPattern)).default([]),
  relatedRouteIds: z.array(z.string().regex(slugPattern)).default([]),
  relatedKnowledgeIds: z.array(z.string().regex(slugPattern)).default([]),
  relatedGuideIds: z.array(z.string().regex(slugPattern)).default([]),
  sources: z.array(sourceReferenceSchema).default([]),
  author: authorSchema.optional(),
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
  trustStatus: z.enum(["personal-experience", "checked-on-location", "official-information", "research-in-progress", "reconfirm-before-travel"]).default("reconfirm-before-travel"),
  recordStatus: z.enum(["draft", "published"]).default("draft"),
};

export function validateEditorialImage(data: { image?: string; imageAlt?: string; imageWidth?: number; imageHeight?: number }, context: z.RefinementCtx) {
  if (data.image && (!data.imageAlt || !data.imageWidth || !data.imageHeight)) {
    context.addIssue({ code: "custom", message: "An image requires alt text, width, and height." });
  }
}

export function validateEditorialEntry(
  data: {
    slug?: string;
    image?: string;
    imageAlt?: string;
    imageWidth?: number;
    imageHeight?: number;
    trustStatus?: "personal-experience" | "checked-on-location" | "official-information" | "research-in-progress" | "reconfirm-before-travel";
    lastPersonallyChecked?: Date;
    published?: Date;
    recordStatus?: "draft" | "published";
    relatedPlaces?: Array<{ id: string }>;
    relatedPeople?: Array<{ id: string }>;
    relatedStories?: Array<{ id: string }>;
    relatedRoutes?: Array<{ id: string }>;
    relatedPlaceIds?: string[];
    relatedPersonIds?: string[];
    relatedStoryIds?: string[];
    relatedRouteIds?: string[];
    relatedKnowledgeIds?: string[];
    relatedGuideIds?: string[];
  },
  context: z.RefinementCtx,
) {
  validateEditorialImage(data, context);
  if (data.recordStatus === "published" && !data.published) context.addIssue({ code:"custom", path:["published"], message:"Published content requires a publication date." });
  for (const field of ["relatedPlaces", "relatedPeople", "relatedStories", "relatedRoutes"] as const) {
    const seen = new Set<string>();
    for (const reference of data[field] ?? []) {
      if (seen.has(reference.id)) context.addIssue({ code: "custom", path: [field], message: `Duplicate related content ID: ${reference.id}` });
      seen.add(reference.id);
    }
  }
  for (const field of ["relatedPlaceIds", "relatedPersonIds", "relatedStoryIds", "relatedRouteIds", "relatedKnowledgeIds", "relatedGuideIds"] as const) {
    if (new Set(data[field] ?? []).size !== (data[field]?.length ?? 0)) context.addIssue({ code:"custom", path:[field], message:`Duplicate stable relationship ID in ${field}.` });
  }
  if (data.trustStatus === "checked-on-location" && !data.lastPersonallyChecked) {
    context.addIssue({
      code: "custom",
      path: ["lastPersonallyChecked"],
      message: "A checked-on-location article requires a date personally confirmed by Jeff.",
    });
  }
}
