# Content Relationships

## Stable references

The authoritative registry uses a typed key made from content type and stable ID. It covers knowledge articles, guides, places, routes, people, stories, topics, and videos. Records with the same stable ID may contribute separate reviewed English and Chinese labels; duplicate labels for one locale fail validation.

New content stores IDs in `relatedKnowledgeIds`, `relatedGuideIds`, `relatedPlaceIds`, `relatedPersonIds`, `relatedStoryIds`, and `relatedRouteIds`. The registry resolves locale-ready labels and URLs. Draft records remain registered for validation but receive no public URL, so a published page cannot resolve a public link to a draft. Existing compatibility references still use three values:

- `id`: the stable lowercase slug used for indexing;
- `label`: reviewed link text shown to visitors;
- `href`: an internal path beginning with `/`.

Collection validation rejects duplicate IDs within one relationship field. Registry validation rejects duplicate nodes, duplicate relationships, and missing targets. Generated-site validation rejects broken internal links on published pages. Reverse relationships are generated from the one declared connection; editors do not add reciprocal links manually.

## Controlled topics

Topics use IDs from `src/data/topics.ts`. Do not enter a topic label manually in content. `TopicList` resolves the approved English label, and `buildReverseTopicIndex` can find records connected with a topic.

## Reverse relationships

`buildSiteContentRegistry` prepares reverse lookup across every registered type. `buildReverseVideoIndex` remains a focused helper for video views. Reverse lookup does not render backlinks automatically; an editor must still confirm that a relationship is meaningful before publication.

For map-connected place records, `buildPlaceContentNetwork` converts the unified relationships into the routes, stories, and videos needed by the map dataset.

Do not use labels as relationship keys. IDs remain stable if a public title or translation changes. New records should not repeat labels or paths in relationship fields.

The unified registry validates place, topic, route, story, person, and video targets together. The map adapter consumes the same registry when stable place relationship IDs need locale-ready labels and URLs.

## Videos

A video record includes a stable slug, title, YouTube or Instagram platform, URL, language, content type, description, thumbnail, transcript support, dates, publishing status, social metadata, and typed relationships. Supported relationship targets are topics, places, people, stories, and routes.

The video database rejects duplicate slugs, duplicate relationships, platform-mismatched URLs, ambiguous transcript sources, incomplete image metadata, and published records without a date or thumbnail. It remains empty until Jeff provides a real video and confirms its relationships. See `docs/VIDEO-ARCHITECTURE.md`.

Consumers query by target type and stable ID rather than maintaining separate video lists on topic, place, route, person, and story pages. This keeps one authoritative video record while allowing the same reviewed asset to appear in several meaningful contexts.
