import type { LocationRecord } from "../../types/location";
import { jiuquStream } from "./jiuqu-stream";
import { riversideTeaPathManshuiBridge } from "./riverside-tea-path-manshui-bridge";
import { validateLocationRecords } from "../../lib/location";
import { authoredLocationRecords } from "../place-sources";

const records: LocationRecord[] = [jiuquStream, riversideTeaPathManshuiBridge, ...authoredLocationRecords];

validateLocationRecords(records);

export const locationDatabase = records.sort((a, b) => a.order - b.order);
export const publishedLocations = locationDatabase.filter((record) => record.recordStatus === "published");
export const structuredLocationData = Object.fromEntries(locationDatabase.map((record) => [record.slug, record])) as Record<string, LocationRecord>;

export function getLocation(slug: string) {
  return structuredLocationData[slug];
}
