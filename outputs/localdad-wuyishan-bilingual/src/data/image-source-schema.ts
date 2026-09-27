import { z } from "astro:content";
import { topicIds } from "./topics";

const stableId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const publicImagePath = z.string().startsWith("/images/library/");

const imageVariantSchema = z.object({
  src:publicImagePath,
  format:z.enum(["jpeg", "webp", "avif"]),
  width:z.number().int().positive(),
  height:z.number().int().positive(),
  bytes:z.number().int().positive(),
});

export const imageSourceSchema = z.object({
  id:stableId,
  filename:z.string().min(1).refine((value) => !value.includes("/") && !value.includes("\\"), "Use the original base filename only."),
  alt:z.string().trim().min(1, "Every managed image requires useful alt text."),
  caption:z.string().trim().min(1).optional(),
  source:z.string().trim().min(1).optional(),
  credit:z.string().trim().min(1).optional(),
  creditSource:z.string().trim().min(1).optional(),
  copyrightStatus:z.enum(["owned", "licensed", "permission-granted", "public-domain", "unconfirmed"]),
  photographer:z.string().trim().min(1).optional(),
  photoLocation:z.string().trim().min(1).optional(),
  photoDate:z.coerce.date().optional(),
  relatedPlaceId:stableId.optional(),
  captureDate:z.coerce.date().optional(),
  originalWidth:z.number().int().positive(),
  originalHeight:z.number().int().positive(),
  originalBytes:z.number().int().positive(),
  src:publicImagePath,
  srcset:z.string().min(1),
  avifSrcset:z.string().min(1),
  webpSrcset:z.string().min(1),
  width:z.number().int().positive(),
  height:z.number().int().positive(),
  variants:z.array(imageVariantSchema).min(3),
  relatedPlaceIds:z.array(stableId).default([]),
  relatedTopicIds:z.array(z.enum(topicIds)).default([]),
  relatedArticles:z.array(z.object({ type:z.enum(["knowledge", "route", "story"]), id:stableId })).default([]),
  relatedVideoIds:z.array(stableId).default([]),
  recordStatus:z.enum(["draft", "published"]).default("draft"),
}).superRefine((record, context) => {
  if (record.photoDate && record.captureDate && record.photoDate.getTime() !== record.captureDate.getTime()) {
    context.addIssue({ code:"custom", path:["photoDate"], message:"photoDate and legacy captureDate must match when both are present." });
  }
  for (const field of ["relatedPlaceIds", "relatedTopicIds", "relatedVideoIds"] as const) {
    if (new Set(record[field]).size !== record[field].length) context.addIssue({ code:"custom", path:[field], message:`Duplicate relationship in ${field}.` });
  }
  const articles = record.relatedArticles.map((item) => `${item.type}:${item.id}`);
  if (new Set(articles).size !== articles.length) context.addIssue({ code:"custom", path:["relatedArticles"], message:"Duplicate related article." });
  const variants = record.variants.map((variant) => `${variant.format}:${variant.width}`);
  if (new Set(variants).size !== variants.length) context.addIssue({ code:"custom", path:["variants"], message:"Duplicate image format and width variant." });
  if (record.recordStatus === "published" && record.copyrightStatus === "unconfirmed") {
    context.addIssue({ code:"custom", path:["copyrightStatus"], message:"A published image requires confirmed publication rights." });
  }
  if (record.recordStatus === "published" && ["licensed", "permission-granted", "public-domain"].includes(record.copyrightStatus) && !record.source && !record.creditSource) {
    context.addIssue({ code:"custom", path:["source"], message:"A published third-party image requires source information." });
  }
  if (record.recordStatus === "published" && ["licensed", "permission-granted", "public-domain"].includes(record.copyrightStatus) && !record.credit && !record.creditSource) {
    context.addIssue({ code:"custom", path:["credit"], message:"A published third-party image requires credit information." });
  }
});
