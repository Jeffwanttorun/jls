# Wuyishan Location Database

The location section is a static, typed database designed for 50 or more places. It does not require a paid database service or a server.

## How one location is stored

Existing locations have two files:

1. `src/data/locations/<slug>.ts` contains names, localized map summaries and practical rows when available, coordinates, categories, topics, relationships, verification status, dates, media, SEO text, publishing status, and ordering.
2. `src/content/locations/<slug>.md` contains Jeff’s first-person local introduction and observations.

The data registry at `src/data/locations/index.ts` controls which records exist. A location with `recordStatus: "draft"` stays out of the public directory and sitemap. A record with `recordStatus: "published"` must have a matching Markdown file or the production build fails.

New locations use an automatically discovered JSON source in `src/data/place-sources/` plus language-specific Markdown under `src/content/locations/<slug>/`. The English narrative is `en.md`; a future reviewed Chinese narrative is `zh.md`. Adding a new source does not require editing the TypeScript registry.

## Information rules

- Do not fill an unknown field by guessing. Leave it out and the page will show “To be confirmed by Jeff.”
- Use `checked-on-location` only when Jeff provides a personal check date.
- Keep practical facts in the TypeScript record and personal observations in Markdown.
- Use verified Chinese names only.
- Keep English and Chinese map content in the same record. Never create a second location database for Chinese.
- Leave `localizations.chineseSummary` and Chinese practical rows absent until reviewed Chinese wording exists.
- Every slug must be unique. The build stops if a duplicate is added.

## Adding a location

1. Run `npm run content:new` with `--type place` and the required reviewed fields.
2. Edit the generated JSON source in `src/data/place-sources/`.
3. Write the English narrative in the generated `en.md` file.
4. Keep the record as `draft` until the supplied information and page copy are ready.
5. Run `npm run build`; the route, directory entry, canonical URL, structured data, and sitemap are generated automatically.

## Coordinates and relationships

- Store a verified map point with latitude, longitude, and an explicit coordinate system. The current Leaflet dataset requires WGS84.
- Use `nearbyPlaces` for confirmed nearby locations; labels may remain unlinked until a related page exists.
- Use `videos` for confirmed video links and their place, person, or story relationships.
- Use canonical IDs from `src/data/topics.ts` in `relatedTopics`.
- Use `relatedStories` for published internal story links. Each reference needs a stable story ID, reviewed label, and working internal path.
- New JSON sources use `relatedRouteIds` and `relatedStoryIds`; the unified registry supplies locale-ready labels and URLs.
- Leave coordinates and relationships empty when they have not been confirmed.

## Interactive map data

`buildMapDataset` reads this database and includes only published places with coordinates. `MapExplorer` is the future Leaflet presentation component, while `MapSection` remains the current lightweight single-place embed. See `docs/MAP-ARCHITECTURE.md` before adding a place to an interactive map.

Map relationships use `relatedTopics`, `relatedRoutes`, `relatedStories`, and registered video relationships. Use stable IDs and verified internal URLs. Optional `mapExperienceFilters` may contain only the controlled `family` or `outdoor` IDs, and only when Jeff or an approved source has confirmed the classification. Heritage filters are derived from controlled topics rather than entered twice.

Related videos are declared once in the central video source through a place relationship. Do not copy video metadata into a new place source.

Coordinates must identify their source coordinate system. The current Leaflet dataset accepts only WGS84. Do not paste GCJ-02 or BD-09 coordinates into a WGS84 record, and do not convert or round coordinates without recording and reviewing that transformation.
