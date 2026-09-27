import { localizedPath, type Locale } from "../i18n/config";

export interface LocalizedEntry {
  id: string;
  data: { slug: string; lang: Locale; translationKey: string };
}

export function validateLocalizedEntries(entries: readonly LocalizedEntry[], collectionName: string) {
  const identities = new Set<string>();
  for (const entry of entries) {
    const identity = `${entry.data.translationKey}:${entry.data.lang}`;
    if (identities.has(identity)) throw new Error(`Duplicate ${collectionName} translation: ${identity}`);
    identities.add(identity);
  }
}

export function editorialPath(sectionPath: string, slug: string, lang: Locale) {
  return localizedPath(`/${sectionPath}/${slug}`, lang);
}

export function editorialRouteParams(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const section = segments.shift();
  if (!section || segments.length === 0) throw new Error(`Invalid editorial path: ${pathname}`);
  return { section, slug: segments.join("/") };
}

export function alternateEditorialPaths(entries: readonly LocalizedEntry[], current: LocalizedEntry, sectionPath: string) {
  return entries
    .filter((entry) => entry.data.translationKey === current.data.translationKey)
    .map((entry) => ({ lang: entry.data.lang, path: editorialPath(sectionPath, entry.data.slug, entry.data.lang) }));
}
