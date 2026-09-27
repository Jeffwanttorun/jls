import type { Locale } from "../i18n/config";
import type { ContentReference } from "../types/content";

export type ContentNodeType = "knowledge" | "guide" | "place" | "route" | "person" | "story" | "topic" | "video" | "image";

export interface ContentRelationship {
  targetType: ContentNodeType;
  targetId: string;
}

export interface ContentNodeInput {
  type: ContentNodeType;
  id: string;
  labels: Partial<Record<Locale, string>>;
  hrefs?: Partial<Record<Locale, string>>;
  relationships?: readonly ContentRelationship[];
}

export interface ContentNode extends ContentNodeInput {
  relationships: ContentRelationship[];
}

export interface ReverseRelationship {
  sourceType: ContentNodeType;
  sourceId: string;
}

export interface ContentRegistry {
  nodes: ReadonlyMap<string, ContentNode>;
  reverse: ReadonlyMap<string, readonly ReverseRelationship[]>;
  get(type: ContentNodeType, id: string): ContentNode | undefined;
  relatedTo(type: ContentNodeType, id: string): readonly ReverseRelationship[];
}

export function contentNodeKey(type: ContentNodeType, id: string) {
  return `${type}:${id}`;
}

export function buildContentRegistry(inputs: readonly ContentNodeInput[]): ContentRegistry {
  const nodes = new Map<string, ContentNode>();

  for (const input of inputs) {
    if (!input.id.trim()) throw new Error(`Content registry received an empty ${input.type} ID.`);
    const key = contentNodeKey(input.type, input.id);
    const existing = nodes.get(key);
    if (!existing) {
      nodes.set(key, { ...input, labels:{ ...input.labels }, hrefs:{ ...input.hrefs }, relationships:[...(input.relationships ?? [])] });
      continue;
    }

    for (const locale of Object.keys(input.labels) as Locale[]) {
      if (existing.labels[locale]) throw new Error(`Duplicate ${key} label for locale: ${locale}`);
      existing.labels[locale] = input.labels[locale];
    }
    for (const locale of Object.keys(input.hrefs ?? {}) as Locale[]) {
      if (existing.hrefs?.[locale]) throw new Error(`Duplicate ${key} URL for locale: ${locale}`);
      existing.hrefs = { ...existing.hrefs, [locale]:input.hrefs?.[locale] };
    }
    const relationshipKeys = new Set(existing.relationships.map((relationship) => contentNodeKey(relationship.targetType, relationship.targetId)));
    for (const relationship of input.relationships ?? []) {
      const relationshipKey = contentNodeKey(relationship.targetType, relationship.targetId);
      if (!relationshipKeys.has(relationshipKey)) existing.relationships.push(relationship);
      relationshipKeys.add(relationshipKey);
    }
  }

  const reverse = new Map<string, ReverseRelationship[]>();
  for (const node of nodes.values()) {
    const seen = new Set<string>();
    for (const relationship of node.relationships) {
      const targetKey = contentNodeKey(relationship.targetType, relationship.targetId);
      if (seen.has(targetKey)) throw new Error(`Duplicate relationship on ${contentNodeKey(node.type, node.id)}: ${targetKey}`);
      seen.add(targetKey);
      if (!nodes.has(targetKey)) throw new Error(`${contentNodeKey(node.type, node.id)} references missing content: ${targetKey}`);
      reverse.set(targetKey, [...(reverse.get(targetKey) ?? []), { sourceType:node.type, sourceId:node.id }]);
    }
  }

  return {
    nodes,
    reverse,
    get:(type, id) => nodes.get(contentNodeKey(type, id)),
    relatedTo:(type, id) => reverse.get(contentNodeKey(type, id)) ?? [],
  };
}

export function resolveContentReferences(registry: ContentRegistry, targetType: ContentNodeType, ids: readonly string[], locale: Locale): ContentReference[] {
  return [...new Set(ids)].map((id) => {
    const node = registry.get(targetType, id);
    if (!node) throw new Error(`Cannot resolve missing content: ${contentNodeKey(targetType, id)}`);
    const label = node.labels[locale] ?? node.labels.en;
    const href = node.hrefs?.[locale] ?? node.hrefs?.en;
    if (!label || !href) throw new Error(`Content is not linkable in ${locale}: ${contentNodeKey(targetType, id)}`);
    return { id, label, href };
  });
}

export function mergeResolvedReferences(registry: ContentRegistry, targetType: ContentNodeType, legacy: readonly ContentReference[], ids: readonly string[], locale: Locale) {
  const merged = new Map(legacy.map((reference) => [reference.id, reference]));
  for (const reference of resolveContentReferences(registry, targetType, ids, locale)) merged.set(reference.id, reference);
  return [...merged.values()];
}
