import { topicRegistry, type TopicGroup, type TopicId } from "./topics";
import type { Locale } from "../i18n/config";

export const publicMapFilterIds = ["water", "scenery", "nature", "museum", "food", "camping"] as const;
export type PublicMapFilterId = (typeof publicMapFilterIds)[number];

export const publicMapFilterRegistry:Record<PublicMapFilterId,{zh:string;en:string}> = {
  water:{zh:"玩水",en:"Waterside"},
  scenery:{zh:"风景",en:"Scenery"},
  nature:{zh:"自然",en:"Nature"},
  museum:{zh:"茶与展馆",en:"Tea & Exhibitions"},
  food:{zh:"吃的",en:"Food"},
  camping:{zh:"床车过夜",en:"Sleeping in Your Vehicle"},
};

export const publicMapCategoryAliases:Record<string,PublicMapFilterId> = {
  exhibitions:"museum",
  "tea-exhibitions":"museum",
  "car-camping":"camping",
};

export function canonicalPublicMapFilter(value:string):PublicMapFilterId|undefined {
  if(publicMapFilterIds.includes(value as PublicMapFilterId))return value as PublicMapFilterId;
  return publicMapCategoryAliases[value];
}

export function localizedPublicMapFilterLabels(locale:Locale){
  return Object.fromEntries(publicMapFilterIds.map((id)=>[id,publicMapFilterRegistry[id][locale]])) as Record<PublicMapFilterId,string>;
}

export const mapExperienceFilterIds = ["family", "outdoor"] as const;
export type MapExperienceFilterId = (typeof mapExperienceFilterIds)[number];
export type MapFilterId = TopicGroup | MapExperienceFilterId | PublicMapFilterId;

export const mapFilterIds: readonly MapFilterId[] = [
  ...publicMapFilterIds,
  "natural-heritage",
  "cultural-heritage",
  "tea-heritage",
  "living-heritage",
  ...mapExperienceFilterIds,
];

export function mapFiltersForTopics(topicIds: readonly TopicId[]) {
  return [...new Set(topicIds.map((topicId) => topicRegistry[topicId].group))];
}
