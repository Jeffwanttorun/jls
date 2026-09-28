import { topicRegistry, type TopicGroup, type TopicId } from "./topics";

export const publicMapFilterIds = ["water", "scenery", "nature", "museum", "food", "camping"] as const;
export type PublicMapFilterId = (typeof publicMapFilterIds)[number];

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
