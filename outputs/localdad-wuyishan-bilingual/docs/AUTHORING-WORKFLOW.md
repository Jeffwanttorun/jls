# Solo Creator Authoring Workflow

## Safe commands

Run these commands from the project folder:

```bash
npm run content:help
npm run content:new -- --type TYPE [required options]
npm run content:status
npm run content:missing
npm run content:quality
npm run content:relationships
npm run content:check
npm run preview:drafts
```

`content:new` creates a draft only and refuses to overwrite an existing file. It does not add a publication date, change navigation, or create a public route. `content:status` lists future records, their publishing state, and a local preview path for each draft. `content:missing` performs a quick inventory check. `content:quality` reports missing knowledge sources and summaries, unsupported placeholder markers, likely untranslated Chinese paragraphs in English Markdown, prohibited pace language, and common tourism-marketing phrases. It never rewrites copy. `content:relationships` runs the production build and authoritative registry validation. `content:check` performs the full production build, image checks, schema checks, relationship validation, link checks, sitemap checks, inventory check, and content-quality check.

## Create a draft

Before drafting English, read `docs/ENGLISH-CONTENT-STYLE.md` and `CONTENT-GUIDE.md`. Decide the page's content type and primary editorial job before writing; do not combine a knowledge article, place page, personal story, video description, and practical guide into one unfocused draft.

Every draft requires `--type`, `--slug`, `--title`, and `--description`. The description must contain 50–180 characters. Slugs use lowercase letters, numbers, and hyphens. English is the default language; use `--lang zh` only for reviewed Chinese editorial content.

Additional required options:

- Knowledge article: `--heritage-category` and `--summary`.
- Place: `--summary` and a comma-separated `--categories` value. `--english-name` is optional when the public title and English place name are the same.
- Route: no additional identity field.
- Person/interview: `--person-name` and `--introduction`.
- Story: `--story-type`.
- Tea article and family guide: no additional identity field.
- Video: `--platform`, `--url`, and `--content-type`.

The command reports a missing or invalid option without writing a partial record. Enter real reviewed wording; do not use filler text merely to satisfy a required field.

## Edit a draft

Knowledge articles, routes, people, and stories are Markdown files in their existing content folders. Facts and metadata are between the opening `---` lines; the narrative begins after the second `---` line.

Knowledge articles use `whyItMatters` for a short visitor-focused explanation and `keyIdeaIds` for a short list drawn from the controlled topic registry. Keep `relatedTopics` as the complete relationship set; use `keyIdeaIds` only for the small public learning overview. The reusable production template is `docs/templates/KNOWLEDGE-ARTICLE-TEMPLATE.md`, and the publication gates and current production order are in `docs/PHASE-1D-PUBLICATION-WORKFLOW.md`.

`learningNotes` supports `learningLevel`, `readingFocus`, `keyVocabulary`, `usefulSentences`, `speakingTopic`, `speakingPractice`, and `guideUsage`. Learning levels may use the existing plain-language values or the reviewed CEFR guidance values `A2`, `A2-B1`, `B1`, `B1-B2`, and `B2`. Keep each `readingFocus` label short and specific. `guideUsage` records ways Jeff can reuse the article language in future visitor conversations or guiding explanations. Learning notes remain non-public until a future editorial decision explicitly enables them.

Future routes use `routeName`, the normal editorial `description`, optional `distance`, optional `estimatedDuration`, optional `transportationType`, `highlights`, and the ordered `routeLocations` list. Use stable place IDs in `routeLocations`. Related stories and topics use the shared relationship fields. A related video is connected from its video record with a typed `route` relationship, so the relationship is not entered twice.

New places use:

- `src/data/place-sources/<place-id>.json` for shared facts, coordinates, verification state, categories, topic IDs, and relationship IDs;
- `src/content/locations/<place-id>/en.md` for the English narrative;
- `src/content/locations/<place-id>/zh.md` only after a reviewed Chinese narrative exists.

The JSON file is discovered automatically. Do not edit `src/data/locations/index.ts`. Existing places remain in their legacy TypeScript files until a separate reviewed migration is authorized.

New videos use one automatically discovered JSON file in `src/data/video-sources/`. Keep the record in draft state until its thumbnail, publication date, description, rights, transcript status, and relationships have been reviewed.

## Preview a draft locally

Run `npm run content:status` and copy the draft's `Local preview` path. Then start:

```bash
npm run preview:drafts
```

Open the reported path on the local address printed by Astro. Draft previews support established guides, knowledge and tea articles, family guides, routes, people/interviews, stories, places, and videos. Each preview displays a yellow Draft Preview notice and uses `noindex` metadata.

Preview routes exist only while Astro is running in development mode. A production build returns no preview paths. Public article, guide, location, video, directory, and sitemap logic independently filters for `recordStatus: published`. `npm run preview` shows the production build and therefore does not show drafts.

Do not send a local preview URL to visitors. It works only on Jeff's computer.

## Content development flow

A useful long-term flow is:

```text
Research
  ↓
Knowledge article
  ↓
Place
  ↓
Route
  ↓
Video
  ↓
Story
  ↓
Map relationship
```

This order is not mandatory. Real material may begin with a place visit, interview, photograph, or video. Whatever the starting point, use stable IDs and keep the relationships consistent so each published item remains part of the same knowledge system. Do not create an empty record merely to complete the sequence.

Before publication, use `docs/CONTENT-REVIEW-CHECKLIST.md` together with the English style guide and the relevant content-type instructions.

## Stable relationships

New editorial records use stable ID arrays:

- `relatedPlaceIds`
- `relatedPersonIds`
- `relatedStoryIds`
- `relatedRouteIds`
- `relatedTopics`

Do not repeat a public label or URL. The unified registry resolves the correct locale-ready label and URL from the stable ID. Legacy `relatedPlaces`, `relatedPeople`, `relatedStories`, and `relatedRoutes` objects remain supported for existing files only.

Routes list their ordered place IDs in `routeLocations`. Videos use typed relationships whose target is a topic, place, route, person, or story ID. A relationship is entered once; reverse lookups are generated automatically.

The build rejects duplicate IDs, duplicate locale labels, duplicate relationships, missing targets, and relationships that cannot resolve to a public label and URL where a page renders them.

## Publish safely

Before changing `recordStatus` to `published`:

1. Review the English against `docs/ENGLISH-CONTENT-STYLE.md` and `CONTENT-GUIDE.md`, including the read-aloud check.
2. Confirm every factual claim and source.
3. Confirm image and video permission.
4. Run `npm run image:check` and confirm all managed image metadata.
5. Add a real publication date.
6. Check relationship IDs.
7. Run `npm run content:check`.
8. Review the draft through `npm run preview:drafts` on mobile and desktop.
9. Change the record to `published`, run `npm run content:check` again, and inspect the production preview build.
10. Deploy only after Jeff approves the public result.

Drafts never enter public routes or the sitemap.
