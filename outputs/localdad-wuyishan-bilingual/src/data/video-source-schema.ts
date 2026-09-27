import { z } from "astro:content";
import { photoSchema, videoRelationshipSchema } from "../content/schema";

export const videoSourceSchema = z.object({
  slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title:z.string().min(1),
  platform:z.enum(["youtube", "instagram"]),
  url:z.string().url(),
  language:z.enum(["en", "zh"]),
  contentType:z.enum(["explanation", "place-visit", "route", "interview", "story"]),
  description:z.string().min(1).optional(),
  thumbnail:photoSchema.optional(),
  transcript:z.object({
    language:z.enum(["en", "zh"]),
    format:z.enum(["text", "captions"]),
    text:z.string().min(1).optional(),
    url:z.string().min(1).optional(),
  }).optional(),
  social:z.object({ title:z.string().min(1).optional(), description:z.string().min(1).optional(), image:photoSchema.optional() }).optional(),
  published:z.coerce.date().optional(),
  updated:z.coerce.date().optional(),
  relationships:z.array(videoRelationshipSchema).default([]),
  recordStatus:z.enum(["draft", "published"]).default("draft"),
});
