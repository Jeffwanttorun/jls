export const pillarIds = ["why-wuyishan", "explore-wuyishan", "stories-of-wuyishan", "about-jeff"] as const;
export type PillarId = (typeof pillarIds)[number];

export interface PillarSectionDefinition {
  id: string;
  label: string;
  contentSource: string;
}

export interface PillarDefinition {
  id: PillarId;
  label: string;
  purpose: string;
  sections: readonly PillarSectionDefinition[];
}

export const pillarRegistry: Record<PillarId, PillarDefinition> = {
  "why-wuyishan": {
    id: "why-wuyishan",
    label: "Why Wuyishan",
    purpose: "Explain why Wuyishan matters globally.",
    sections: [
      { id: "landscape", label: "Landscape", contentSource: "knowledgeArticles" },
      { id: "tea", label: "Tea", contentSource: "knowledgeArticles" },
      { id: "culture", label: "Culture", contentSource: "knowledgeArticles" },
      { id: "nature", label: "Nature", contentSource: "knowledgeArticles" },
    ],
  },
  "explore-wuyishan": {
    id: "explore-wuyishan",
    label: "Explore Wuyishan",
    purpose: "Help visitors understand how to experience Wuyishan.",
    sections: [
      { id: "places", label: "Places", contentSource: "locations" },
      { id: "routes", label: "Routes", contentSource: "routes" },
      { id: "family-travel", label: "Family Travel", contentSource: "familyGuides" },
      { id: "outdoor-experiences", label: "Outdoor Experiences", contentSource: "guides" },
    ],
  },
  "stories-of-wuyishan": {
    id: "stories-of-wuyishan",
    label: "Stories of Wuyishan",
    purpose: "Use real people and local stories to support larger Wuyishan themes.",
    sections: [
      { id: "people", label: "People", contentSource: "people" },
      { id: "interviews", label: "Interviews", contentSource: "people" },
      { id: "local-stories", label: "Local Stories", contentSource: "localStories" },
    ],
  },
  "about-jeff": {
    id: "about-jeff",
    label: "About Jeff",
    purpose: "Explain who created the website and how Jeff connects international visitors with Wuyishan.",
    sections: [],
  },
};
