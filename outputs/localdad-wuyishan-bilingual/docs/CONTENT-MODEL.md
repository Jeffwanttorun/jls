# Scalable Content Model

This project keeps content in files so the public website remains static, fast, and easy to deploy. New material starts as a draft and is published only after Jeff has supplied or confirmed the source material.

## Supported content categories

Canonical category IDs are defined once in `src/data/content-categories.ts`. The public editorial groups are `why-wuyishan`, `natural-heritage`, `tea-heritage`, `cultural-heritage`, `living-heritage`, `visitor-experience`, and `practical-travel`. Collection-specific IDs remain available for places, people, routes, stories, tea culture, and family travel. Frontmatter must use these IDs rather than a manually typed display label.

| Category | Content location | Future URL |
| --- | --- | --- |
| Why Wuyishan knowledge | `src/content/knowledge/` | `/why-wuyishan/<slug>` |
| Places | `src/data/place-sources/` plus `src/content/locations/` | `/locations/<slug>` |
| People and interviews | `src/content/people/` | `/people/<slug>` |
| Routes | `src/content/routes/` | `/routes/<slug>` |
| Stories | `src/content/local-stories/` | `/local-stories/<slug>` |
| Tea culture | `src/content/tea-culture/` | `/tea-culture/<slug>` |
| Family travel | `src/content/family-guides/` | `/family-guides/<slug>` |
| Video records | `src/data/video-sources/` | No public route until a reviewed use case requires one |

Future collections remain genuinely empty until real source material is available. Empty collections are skipped without creating placeholder records or public pages. Their schemas and reusable page route are already prepared.

## Shared editorial fields

The schemas in `src/content/schema.ts` support:

- page title, optional English name, and verified Chinese name;
- category-specific metadata;
- a short introduction, optional historical context, and optional personal-experience note;
- structured practical-information rows;
- photos with alt text and pixel dimensions;
- linked videos and their relationships to places, people, stories, topics, or routes;
- stable related knowledge, guide, place, person, story, route, and topic IDs;
- sources for knowledge articles;
- publication, update, and personally checked dates;
- source or trust status;
- author name, role, and profile link.

Empty optional fields do not create empty sections on a public page.

Pillar definitions live in `src/data/pillars.ts`. Their shared public shell is `src/layouts/PillarLayout.astro`, with reusable sections in `src/components/PillarSection.astro`. See `docs/PILLAR-PAGES.md`. Pillar pages organize existing content, while collection records still control whether individual articles and entries become public.

## Add a knowledge article

Use `npm run content:new` with the knowledge type and assign one reviewed structural category: `overview`, `natural-heritage`, `cultural-heritage`, `tea-heritage`, or `living-heritage`. Use `overview` only for a cross-theme introduction to Why Wuyishan; it is not a fifth heritage theme. `heritageCategories` records every heritage theme covered by the article, while `heritageCategory` provides its primary editorial classification. Natural Heritage uses the same collection as the other three heritage categories. The controlled `contentCategory` is `why-wuyishan` for an overview and the matching heritage category ID for a theme article. Knowledge articles require a reviewed summary and real draft creation and update dates. They support historical context, Markdown body content, related knowledge articles, places, people, stories, routes, controlled topics, videos, sources, and editorial dates. Keep the record as a draft until every claim and source has been reviewed.

## Controlled topics

Canonical topic IDs and English labels live in `src/data/topics.ts`. Content stores IDs such as `biodiversity`, `zhu-xi`, or `global-tea-history`; templates and components resolve the public label from the registry. Do not type a new topic label into frontmatter. Add a reviewed registry entry first.

The registry groups topics under Natural, Cultural, Tea, or Living Heritage. `buildReverseTopicIndex` prepares topic-to-content lookup without publishing topic pages. Topic labels are displayed as text until real pillar pages exist, so the architecture does not create links to empty destinations.

Why Wuyishan is the primary content pillar. Explore content explains ways to experience the place, while Stories provides supporting human context. See `docs/CONTENT-STRATEGY.md` before deciding where a future article belongs.

## Add a new place

1. Run `npm run content:new` with the place type and reviewed identity fields.
2. Edit the automatically discovered JSON facts in `src/data/place-sources/`.
3. Write the English narrative in `src/content/locations/<slug>/en.md`.
4. Put verified coordinates in `coordinates: { latitude, longitude }` only when the exact point is known.
5. Add nearby places as labels or internal links. Do not guess proximity.
6. Keep `recordStatus: "draft"` until the facts, names, safety notes, images, and source status have been reviewed.
7. Run `npm run build`.

See `LOCATION_DATABASE.md` for location-specific rules.

## Add a person or interview

1. Run `npm run content:new` with the person type and confirmed identity fields.
2. Edit the generated draft in `src/content/people/`.
3. Record the person’s name and short introduction. Add a Chinese name only when verified.
4. Add interview date, location, theme, and video only when they come from the real interview record.
5. Use canonical topic IDs in `relatedThemes` only for reviewed connections to larger heritage themes.
6. Put the reviewed interview or story below the frontmatter.
7. Leave the entry as `recordStatus: draft` until the person’s identity, wording, media permission, and publication permission are confirmed.
8. Run `npm run build` before changing the status to `published`.

## Add a route

1. Run `npm run content:new` with the route type.
2. Use only route details Jeff has personally supplied or a named source has confirmed.
3. Add referenced location slugs to `routeLocations` and confirmed transport notes to `transportNotes`.
4. Keep changing details clearly marked for rechecking.
5. Publish only after every route connection, time estimate, access note, and safety statement has been reviewed.

## Add a story

1. Run `npm run content:new` with the story type.
2. Choose the existing `storyType` that matches the source material.
3. Use first person only for Jeff’s confirmed experience. Use attributed reporting for another person’s words or experience.
4. Confirm names, quotations, image rights, and publication permission before publishing.

Tea and family articles follow the same draft-and-review workflow using their matching templates.

## Photos and videos

Every photo needs `src`, accurate `alt`, `width`, and `height`. A caption is optional. Never publish an image without permission.

Independent video assets use automatically discovered JSON records in `src/data/video-sources/`. Supported platforms are YouTube and Instagram. Records include language, controlled content type, thumbnail, publication date, transcript support, social metadata, publishing status, and explicit relationships to places, people, stories, topics, or routes.

New editorial relationships store stable IDs only. The unified registry resolves labels and URLs, validates targets, and prepares reverse lookup. Existing object references remain supported for legacy content.

A relationship records how content is connected; it does not automatically make a factual claim. Verify every relationship before publishing. See `docs/VIDEO-ARCHITECTURE.md` for the complete model, validation rules, reusable components, SEO behavior, and publishing workflow.

## English writing rules

Read `AGENTS.md`, `docs/ENGLISH-CONTENT-STYLE.md`, and `CONTENT-GUIDE.md` before editing English. Write natural American English for international visitors. Adapt Chinese concepts instead of translating them word for word. Keep `Local Dad Jeff` as the brand name, not a repeated literal identity label.

## Language records

English and Chinese use separate reviewed Markdown records joined by `translationKey`. This allows each title, summary, description, metadata, and body to be written naturally in its own language. See `docs/BILINGUAL-CONTENT.md`; never insert an unreviewed translation merely to complete a language pair.

## Verification rules

- Never fill a blank field by guessing.
- Keep new entries as drafts while facts or permissions are incomplete.
- Use `personal-experience` only for confirmed personal experience.
- Use `checked-on-location` only with a `lastPersonallyChecked` date confirmed by Jeff.
- Use `official-information` only when the official source is identifiable.
- Use `research-in-progress` for published knowledge articles whose sources and editorial boundaries remain visible while the project develops.
- Use `reconfirm-before-travel` for details that may change.
- `published` and `updated` are editorial dates; they are not field-check dates.
- Run `npm run build` and fix every relevant error before deployment.
