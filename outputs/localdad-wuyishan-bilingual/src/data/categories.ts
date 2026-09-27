export const categories = {
  plan: { label: "Plan Your Trip", description: "The practical basics: where Wuyishan is, when to come, transportation, neighborhoods, and trip length." },
  outdoors: { label: "Mountains & Outdoors", description: "Walking routes, peaks, time by the river, weather, photography, and realistic trail notes." },
  tea: { label: "Wuyi Rock Tea", description: "Tea varieties, local customs, growing areas, tastings, and the people behind the cup." },
  family: { label: "Family Travel", description: "Parent-to-parent advice on pacing, food, easy activities, rest stops, and rainy days." },
  "local-life": { label: "Everyday Wuyishan", description: "Food, coffee, neighborhoods, people, and daily life beyond the scenic area." },
} as const;

export type CategoryKey = keyof typeof categories;
