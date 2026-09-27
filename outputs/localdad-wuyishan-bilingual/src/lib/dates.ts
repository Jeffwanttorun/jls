import type { Locale } from "../i18n/config";

export function getEditorialDate(published: Date, updated?: Date) {
  return updated ?? published;
}

export function getEditorialDateLabel(updated?: Date) {
  return updated ? "Updated" : "Published";
}

export function formatEditorialDate(date: Date, lang: Locale = "en") {
  return date.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year:"numeric", month:"long", day:"numeric" });
}
