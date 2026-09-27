import type { LocationRecord } from "../types/location";
import { placeSourceSchema } from "./place-source-schema";

const sourceModules = import.meta.glob<unknown>("./place-sources/*.json", { eager:true, import:"default" });

export const authoredLocationRecords: LocationRecord[] = Object.entries(sourceModules).map(([path, source]) => {
  const result = placeSourceSchema.safeParse(source);
  if (!result.success) throw new Error(`Invalid place source ${path}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  return result.data as LocationRecord;
});
