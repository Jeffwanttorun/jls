import type { VideoRecord } from "../types/content";
import { videoSourceSchema } from "./video-source-schema";

const sourceModules = import.meta.glob<unknown>("./video-sources/*.json", { eager:true, import:"default" });

export const authoredVideoRecords: VideoRecord[] = Object.entries(sourceModules).map(([path, source]) => {
  const result = videoSourceSchema.safeParse(source);
  if (!result.success) throw new Error(`Invalid video source ${path}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  return result.data as VideoRecord;
});
