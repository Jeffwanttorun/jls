export const experienceCategoryIds = ["first-time-visitors", "family-travelers", "nature-lovers", "tea-lovers", "outdoor-explorers"] as const;
export type ExperienceCategoryId = (typeof experienceCategoryIds)[number];
export const experienceTargetIds = ["main-scenic-area", "family-travel", "natural-heritage", "tea-heritage", "tea-experiences", "hiking-and-rivers", "local-wuyishan", "practical-travel"] as const;
export type ExperienceTargetId = (typeof experienceTargetIds)[number];

export interface ExperienceTargetDefinition {
  id: ExperienceTargetId;
  label: string;
  href: string;
}

export interface ExperienceCategoryDefinition {
  id: ExperienceCategoryId;
  label: string;
  targetIds: ExperienceTargetId[];
}

export const experienceTargets: Record<ExperienceTargetId, ExperienceTargetDefinition> = {
  "main-scenic-area": { id:"main-scenic-area", label:"Main Scenic Area", href:"/main-scenic-area" },
  "family-travel": { id:"family-travel", label:"Family Travel", href:"/family-travel" },
  "natural-heritage": { id:"natural-heritage", label:"Natural Heritage", href:"/why-wuyishan#natural-heritage" },
  "tea-heritage": { id:"tea-heritage", label:"Tea Heritage", href:"/why-wuyishan#tea-heritage" },
  "tea-experiences": { id:"tea-experiences", label:"Tea-related experiences", href:"/wuyi-rock-tea" },
  "hiking-and-rivers": { id:"hiking-and-rivers", label:"Hiking and Rivers", href:"/explore-wuyishan#hiking-and-rivers" },
  "local-wuyishan": { id:"local-wuyishan", label:"Local Wuyishan", href:"/explore-wuyishan#local-wuyishan" },
  "practical-travel": { id:"practical-travel", label:"Practical Travel", href:"/explore-wuyishan#practical-travel" },
};

export const experienceCategories: readonly ExperienceCategoryDefinition[] = [
  { id:"first-time-visitors", label:"First-time visitors", targetIds:["practical-travel", "main-scenic-area"] },
  { id:"family-travelers", label:"Family travelers", targetIds:["family-travel"] },
  { id:"nature-lovers", label:"Nature lovers", targetIds:["natural-heritage", "hiking-and-rivers"] },
  { id:"tea-lovers", label:"Tea lovers", targetIds:["tea-heritage", "tea-experiences"] },
  { id:"outdoor-explorers", label:"Outdoor explorers", targetIds:["hiking-and-rivers", "local-wuyishan"] },
];

const categoryIds = new Set<ExperienceCategoryId>();
for (const category of experienceCategories) {
  if (categoryIds.has(category.id)) throw new Error(`Duplicate experience category: ${category.id}`);
  categoryIds.add(category.id);
  if (new Set(category.targetIds).size !== category.targetIds.length) throw new Error(`Duplicate experience target on category: ${category.id}`);
  for (const targetId of category.targetIds) if (!experienceTargets[targetId]) throw new Error(`Unknown experience target: ${targetId}`);
}
