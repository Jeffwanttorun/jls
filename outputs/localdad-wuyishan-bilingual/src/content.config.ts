import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { editorialFields, validateEditorialEntry } from "./content/schema";
import { topicIds } from "./data/topics";
import { knowledgeContentCategoryIds } from "./data/content-categories";
import { hasMarkdownFiles } from "./lib/content-files";
import "./data/map-routes";
import "./data/creator-profiles";
import "./data/image-assets";

function markdownLoader(base: string) {
  return hasMarkdownFiles(base) ? glob({ pattern: "**/*.md", base }) : async () => [];
}

const guides = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/guides" }),
  schema: z.object({
    ...editorialFields,
    category: z.enum(["plan", "outdoors", "tea", "family", "local-life"]),
    order: z.number().default(99),
    featured: z.boolean().default(false),
  }).superRefine(validateEditorialEntry),
});

const locations = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/locations" }),
  schema: z.object({
    recordKey: z.string(),
    lang: z.enum(["en", "zh"]).default("en"),
  }),
});

const routes = defineCollection({
  loader: markdownLoader("./src/content/routes"),
  schema: z.object({
    ...editorialFields,
    contentCategory: z.literal("route").default("route"),
    routeName: z.string().min(1),
    distance: z.string().min(1).optional(),
    estimatedDuration: z.string().min(1).optional(),
    transportationType: z.enum(["walking", "cycling", "driving", "public-transport", "mixed", "other"]).optional(),
    highlights: z.array(z.string().min(1)).default([]),
    routeLocations: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).default([]),
    transportNotes: z.array(z.string()).default([]),
  }).superRefine((data, context) => {
    validateEditorialEntry(data, context);
    if (new Set(data.routeLocations).size !== data.routeLocations.length) context.addIssue({ code:"custom", path:["routeLocations"], message:"A route cannot repeat a place ID." });
  }),
});

const teaArticles = defineCollection({
  loader: markdownLoader("./src/content/tea-culture"),
  schema: z.object({ ...editorialFields, contentCategory: z.literal("tea-culture").default("tea-culture"), teaNames: z.array(z.string()).default([]) }).superRefine(validateEditorialEntry),
});

const familyGuides = defineCollection({
  loader: markdownLoader("./src/content/family-guides"),
  schema: z.object({ ...editorialFields, contentCategory: z.literal("family-travel").default("family-travel"), familyConsiderations: z.array(z.string()).default([]) }).superRefine(validateEditorialEntry),
});

const localStories = defineCollection({
  loader: markdownLoader("./src/content/local-stories"),
  schema: z.object({ ...editorialFields, contentCategory: z.literal("story").default("story"), storyType: z.enum(["people", "work", "food", "tea", "family", "daily-life"]) }).superRefine(validateEditorialEntry),
});

const people = defineCollection({
  loader: markdownLoader("./src/content/people"),
  schema: z.object({
    ...editorialFields,
    contentCategory: z.literal("person").default("person"),
    personName: z.string().min(1),
    personChineseName: z.string().min(1).optional(),
    shortIntroduction: z.string().min(1),
    interviewDate: z.coerce.date().optional(),
    interviewLocation: z.string().min(1).optional(),
    interviewTheme: z.string().min(1).optional(),
    relatedThemes: z.array(z.enum(topicIds)).default([]),
  }).superRefine(validateEditorialEntry),
});

const knowledgeArticles = defineCollection({
  loader: markdownLoader("./src/content/knowledge"),
  schema: z.object({
    ...editorialFields,
    created: z.coerce.date(),
    updated: z.coerce.date(),
    contentCategory: z.enum(knowledgeContentCategoryIds).default("why-wuyishan"),
    heritageCategory: z.enum(["overview", "natural-heritage", "cultural-heritage", "tea-heritage", "living-heritage"]),
    heritageCategories: z.array(z.enum(["natural-heritage", "cultural-heritage", "tea-heritage", "living-heritage"])).min(1),
    summary: z.string().min(1),
  }).superRefine((data, context) => {
    validateEditorialEntry(data, context);
    if (new Set(data.heritageCategories).size !== data.heritageCategories.length) {
      context.addIssue({ code:"custom", path:["heritageCategories"], message:"Duplicate heritage category." });
    }
    if (data.heritageCategory !== "overview" && !data.heritageCategories.includes(data.heritageCategory)) {
      context.addIssue({ code:"custom", path:["heritageCategories"], message:"Heritage categories must include the article's primary category." });
    }
  }),
});

export const collections = { guides, locations, routes, teaArticles, familyGuides, localStories, people, knowledgeArticles };
