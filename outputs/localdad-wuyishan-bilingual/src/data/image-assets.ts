import type { ImageAssetRecord } from "../types/image";
import { imageSourceSchema } from "./image-source-schema";

const sourceModules = import.meta.glob<unknown>("./image-sources/*.json", { eager:true, import:"default" });

export const imageDatabase: readonly ImageAssetRecord[] = Object.entries(sourceModules).map(([path, source]) => {
  const result = imageSourceSchema.safeParse(source);
  if (!result.success) throw new Error(`Invalid image source ${path}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  return result.data as ImageAssetRecord;
});

const ids = new Set<string>();
const filenames = new Set<string>();
for (const image of imageDatabase) {
  if (ids.has(image.id)) throw new Error(`Duplicate managed image ID: ${image.id}`);
  if (filenames.has(image.filename.toLowerCase())) throw new Error(`Duplicate original image filename: ${image.filename}`);
  ids.add(image.id);
  filenames.add(image.filename.toLowerCase());
}

export const publishedImages = imageDatabase.filter((image) => image.recordStatus === "published");
export const imagesById = Object.fromEntries(imageDatabase.map((image) => [image.id, image])) as Record<string, ImageAssetRecord>;
