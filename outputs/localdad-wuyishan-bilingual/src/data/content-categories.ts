export const contentCategoryIds = [
  "why-wuyishan",
  "natural-heritage",
  "tea-heritage",
  "cultural-heritage",
  "living-heritage",
  "visitor-experience",
  "practical-travel",
  "place",
  "person",
  "route",
  "story",
  "tea-culture",
  "family-travel",
] as const;

export type ContentCategory = (typeof contentCategoryIds)[number];

export const knowledgeContentCategoryIds = [
  "why-wuyishan",
  "natural-heritage",
  "tea-heritage",
  "cultural-heritage",
  "living-heritage",
] as const satisfies readonly ContentCategory[];

export function isKnowledgeContentCategory(value?: string): value is (typeof knowledgeContentCategoryIds)[number] {
  return knowledgeContentCategoryIds.includes(value as (typeof knowledgeContentCategoryIds)[number]);
}
