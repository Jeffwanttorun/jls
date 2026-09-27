import type { VideoPlatform } from "./content";

export interface CreatorProfile {
  id: string;
  creatorId: string;
  platform: VideoPlatform;
  url: string;
  label: string;
  recordStatus: "draft" | "published";
}
