export const topicIds = [
  "biodiversity",
  "natural-history",
  "plant-research",
  "scientific-exploration",
  "zhu-xi",
  "neo-confucianism",
  "historical-culture",
  "wuyi-rock-tea",
  "oolong-tea",
  "black-tea",
  "global-tea-history",
  "communities",
  "villages",
  "traditional-practices",
] as const;

export type TopicId = (typeof topicIds)[number];
export type TopicGroup = "natural-heritage" | "cultural-heritage" | "tea-heritage" | "living-heritage";

export interface TopicDefinition {
  id: TopicId;
  label: string;
  group: TopicGroup;
}

export const topicRegistry: Record<TopicId, TopicDefinition> = {
  biodiversity: { id: "biodiversity", label: "Biodiversity", group: "natural-heritage" },
  "natural-history": { id: "natural-history", label: "Natural History", group: "natural-heritage" },
  "plant-research": { id: "plant-research", label: "Plant Research", group: "natural-heritage" },
  "scientific-exploration": { id: "scientific-exploration", label: "Scientific Exploration", group: "natural-heritage" },
  "zhu-xi": { id: "zhu-xi", label: "Zhu Xi", group: "cultural-heritage" },
  "neo-confucianism": { id: "neo-confucianism", label: "Neo-Confucianism", group: "cultural-heritage" },
  "historical-culture": { id: "historical-culture", label: "Historical Culture", group: "cultural-heritage" },
  "wuyi-rock-tea": { id: "wuyi-rock-tea", label: "Wuyi Rock Tea", group: "tea-heritage" },
  "oolong-tea": { id: "oolong-tea", label: "Oolong Tea", group: "tea-heritage" },
  "black-tea": { id: "black-tea", label: "Black Tea", group: "tea-heritage" },
  "global-tea-history": { id: "global-tea-history", label: "Global Tea History", group: "tea-heritage" },
  communities: { id: "communities", label: "Communities", group: "living-heritage" },
  villages: { id: "villages", label: "Villages", group: "living-heritage" },
  "traditional-practices": { id: "traditional-practices", label: "Traditional Practices", group: "living-heritage" },
};

export function getTopic(id: TopicId) {
  return topicRegistry[id];
}

export function buildReverseTopicIndex<T extends { slug: string; relatedTopics?: readonly TopicId[]; relatedThemes?: readonly TopicId[] }>(records: readonly T[]) {
  const index = Object.fromEntries(topicIds.map((id) => [id, [] as T[]])) as Record<TopicId, T[]>;
  for (const record of records) {
    const recordTopics = new Set([...(record.relatedTopics ?? []), ...(record.relatedThemes ?? [])]);
    for (const topicId of recordTopics) index[topicId].push(record);
  }
  return index;
}
