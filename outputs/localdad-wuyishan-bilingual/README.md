# Local Dad Jeff in Wuyishan

A static Astro website for Jeff’s English-language Wuyishan guides. It is designed to stay fast and manageable as the library grows beyond 50 pages.

## Start the website locally

You need Node.js 20 or newer. In Terminal:

```bash
cd /Users/xiaorong/local-dad-jeff
npm install
npm run dev
```

Open the local address shown in Terminal, normally `http://localhost:4321`.

Before publishing, run:

```bash
npm run build
```

A successful build reports zero errors and creates the final static website in `dist/`. Never edit `dist/`; Astro recreates it.

For local production metadata checks, set the public site URL:

```bash
SITE_URL=https://local-dad-jeff.vercel.app npm run build
```

`SITE_URL` can override the canonical domain for a controlled deployment. The production fallback has one source of truth in `site.config.mjs`. It controls canonical URLs, Open Graph URLs, structured data, robots.txt, and the sitemap. Do not set it to a preview deployment URL.

## Where content lives

| Content | Location |
| --- | --- |
| Homepage | `src/pages/index.astro` |
| Existing main guides | `src/content/guides/` |
| Location facts and publishing status | `src/data/locations/` |
| Location personal narratives | `src/content/locations/` |
| Future travel routes | `src/content/routes/` |
| Future people and interviews | `src/content/people/` |
| Future tea culture articles | `src/content/tea-culture/` |
| Future family guides | `src/content/family-guides/` |
| Future local stories | `src/content/local-stories/` |
| Future Why Wuyishan knowledge articles | `src/content/knowledge/` |
| Controlled heritage topics | `src/data/topics.ts` |
| Future pillar definitions | `src/data/pillars.ts` |
| Future video records | `src/data/videos.ts` |
| Automatically discovered place drafts | `src/data/place-sources/` |
| Automatically discovered video drafts | `src/data/video-sources/` |
| Video model and publishing rules | `docs/VIDEO-ARCHITECTURE.md` |
| Future confirmed creator profiles | `src/data/creator-profiles.ts` |
| Future interactive-map routes | `src/data/map-routes.ts` |
| Future map filters | `src/data/map-filters.ts` |
| Map-to-content relationships | `src/lib/place-network.ts` |
| Legacy reference templates | `content-templates/` |
| About and contact pages | `src/pages/about.md`, `src/pages/contact.md` |
| Images | `public/images/` |
| New image originals | `media/originals/` |
| Managed image metadata | `src/data/image-sources/` |

Read `docs/ENGLISH-CONTENT-STYLE.md` and `CONTENT-GUIDE.md` before writing. The style guide defines the permanent English editorial method; the content guide defines Jeff’s voice and the language the site avoids. `CONTENT_REVIEW.md` lists facts that still need Jeff’s confirmation.

Future content directories are intentionally empty and contain only `.gitkeep`. Starter structures remain in `content-templates/`, outside the editorial collections, so templates can never become public pages by accident.

## Edit an existing guide

Open its Markdown file in `src/content/guides/`. Text below the second `---` line is the article body.

- Use `##` for main sections and `###` for subsections.
- Do not add a `#` heading; the page already creates one H1.
- Keep personal claims limited to experiences Jeff has confirmed.
- Recheck changing information such as schedules, tickets, transport, access, and safety rules.
- Run `npm run build` after editing.

## Add future content safely

Use the authoring commands instead of copying or registering files by hand:

```bash
npm run content:help
npm run content:new -- --type TYPE [required options]
npm run content:status
npm run content:quality
npm run content:check
```

Every future article starts as:

```yaml
recordStatus: draft
```

The command requires real titles and descriptions and refuses to overwrite an existing file. Drafts are validated but are not published. Change the status to `published` only after the facts, English copy, metadata, images, and relationships have been reviewed. Published entries automatically receive a static page, canonical URL, Article structured data, breadcrumb structured data, and sitemap entry.

See `docs/AUTHORING-WORKFLOW.md` for the required options and safe publishing sequence.

The future URL sections are:

- `/routes/<slug>`
- `/people/<slug>`
- `/tea-culture/<slug>`
- `/family-guides/<slug>`
- `/local-stories/<slug>`
- `/why-wuyishan/<slug>`

## Add a location

Existing locations retain their original typed records. New locations use an automatically discovered place source:

1. Run `npm run content:new` with `--type place` and the required reviewed fields.
2. Edit shared facts in `src/data/place-sources/<slug>.json`.
3. Write the English narrative in `src/content/locations/<slug>/en.md`.
4. Add `zh.md` only when a reviewed Chinese narrative is available.

No registry code edit is required. Unknown fields stay absent. The build stops for duplicate slugs, missing published narratives, invalid fields or relationships, and images without alt text and dimensions. See `LOCATION_DATABASE.md` for the complete workflow.

## Change images

For new photography, put the original in `media/originals/`. Use a unique lowercase English filename with hyphens. Then run `npm run image:prepare` with the real alt text and confirmed copyright status. The command generates responsive JPEG, WebP, and AVIF versions and creates one draft metadata record. Do not resize or build variant lists by hand.

For each image, record:

- an accurate alt description;
- its pixel width and height;
- its source, photographer, public credit, and copyright status;
- a WebP version when practical;
- whether the image still needs replacement.

Run `npm run image:check` after image changes. The full site build also runs this check. Hero images load eagerly only when they are visible immediately. Gallery and directory images load only when visitors approach them. Never publish an image without permission. See `docs/IMAGE-WORKFLOW.md` for the complete command and metadata rules.

## Preview drafts safely

Run `npm run content:status` to see each draft and its local preview path. Start the local draft server with:

```bash
npm run preview:drafts
```

Draft previews show a clear yellow status notice and work for articles, places, stories, people/interviews, guides, and videos. They exist only in local development. Production routes, directories, and the sitemap include published records only.

## Deploy to Vercel

The project is connected to Vercel. To deploy the checked local version explicitly to Production:

```bash
npx vercel --prod
```

The production website is:

`https://local-dad-jeff.vercel.app`

After deployment, open the production URL and check the homepage, navigation, changed pages, `/robots.txt`, and the sitemap.

## Deploy to a friend's server

The self-hosted release workflow synchronizes the existing visitor content store, validates the complete static website, saves a pre-publication backup, creates an immutable release and only then switches the public site. A failed build leaves the current public release unchanged. See [`docs/SELF-HOSTING.md`](docs/SELF-HOSTING.md) and the templates in `deploy/`.

### Pre-publication checklist

- Confirm every new travel fact with Jeff or a named official source.
- Leave unknown facts empty; never invent them.
- Check titles, descriptions, headings, links, image permission, alt text, and image dimensions.
- Run `npm run image:check`, then review the Draft Preview notice and the page at mobile and desktop widths.
- Confirm `npm run content:status` shows the intended publishing state before changing a draft to `published`.
- Confirm dates: `published` and `updated` are editorial dates; `lastPersonallyChecked` is used only after Jeff confirms an on-location check.
- Run the production build and inspect desktop and mobile layouts.
- Verify canonical and Open Graph URLs use the production domain.

### Roll back a deployment

Open the Vercel project, select **Deployments**, open the last known-good production deployment, and choose **Promote to Production**. This changes the live version without deleting newer source code. Record which Git commit was restored before making the next change.

## Files a non-technical owner should avoid

Unless you understand Astro and TypeScript, do not edit:

- `src/components/`
- `src/layouts/`
- `src/lib/`
- `src/types/`
- `src/content.config.ts`
- `src/styles/global.css`
- `astro.config.mjs`
- `package.json` or `package-lock.json`
- `vercel.json`

Do not edit `.astro`, `.ts`, `.json`, or generated `dist/` files just to change article wording. Ask for technical help when a new content type or field is needed.

## Important project documents

- `CONTENT-GUIDE.md` — writing and brand-language rules
- `docs/ENGLISH-CONTENT-STYLE.md` — permanent English editorial style and content-type boundaries
- `CONTENT_REVIEW.md` — facts awaiting Jeff’s confirmation
- `docs/CONTENT-MODEL.md` — adding places, interviews, routes, stories, media, and relationships
- `docs/CONTENT-STRATEGY.md` — long-term hierarchy, navigation direction, and editorial purpose
- `docs/PILLAR-PAGES.md` — when and how future pillar pages become public
- `docs/RELATIONSHIPS.md` — stable references, topics, reverse lookup, and videos
- `docs/BILINGUAL-CONTENT.md` — separate English and Chinese records and URL behavior
- `docs/MAP-ARCHITECTURE.md` — shared bilingual map data, content relationships, Leaflet integration, tiles, and publishing checks
- `docs/VIDEO-ARCHITECTURE.md` — video assets, relationships, transcripts, display components, and SEO rules
- `docs/AUTHORING-WORKFLOW.md` — draft creation, status checks, stable relationships, and safe publication
- `docs/IMAGE-WORKFLOW.md` — image metadata, responsive optimization, rights, and validation
- `LOCATION_DATABASE.md` — location data workflow
- `PHOTO-CHECKLIST.md` — real-photo replacement list
- `docs/ARCHITECTURE.md` — technical architecture and validation rules
- `docs/PERFORMANCE.md` — recorded performance measurements and Core Web Vitals risk review
- `docs/DATE_SEMANTICS.md` — rules for published, updated, and personally checked dates
