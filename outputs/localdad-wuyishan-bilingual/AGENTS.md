# AGENTS.md

This file applies to the entire repository.

## Project purpose

Local Dad Jeff is a static, English-first guide to Wuyishan, China. It should feel like Jeff is helping one curious visitor understand his hometown: personal, calm, practical, and honest. It is not a tourism-bureau site, travel agency, or booking product.

The site must remain lightweight, mobile-first, accessible, SEO-friendly, and able to grow beyond 50 pages. The architecture must also allow Chinese content to be added later without rewriting the English site.

## Communication with the owner

- Write progress updates and technical explanations to Jeff in Chinese unless he asks for another language.
- Keep public website copy in natural American English.
- Make safe, reversible implementation decisions independently. Ask only when a choice would remove content, invent a fact, require a paid service, or materially change the product.
- Report what was actually implemented and verified. Never say a change is deployed until it is visible on the public production URL.

## Non-negotiable content rules

- Never invent Wuyishan facts, personal experiences, routes, times, seasons, transportation details, prices, safety advice, family suitability, or official policies.
- Leave unknown location fields empty. Reusable location components will display `To be confirmed by Jeff.` where appropriate.
- Separate Jeff's personal observations from factual or official information.
- Use `lastPersonallyChecked` only when Jeff personally checked the place on location. A page edit, build, or deployment date is never a field-check date.
- Do not add testimonials, reviews, ratings, visitor counts, or unsupported claims.
- Do not imply that Jeff currently offers private English guiding. The accurate wording is that he is improving his English and preparing to guide international visitors in the future.
- Do not publish an email address, form, social account, or other contact method until Jeff confirms that it works.
- Do not generate generic tourism articles or add facts merely to make a page look complete.

Read `CONTENT-GUIDE.md` and `docs/ENGLISH-CONTENT-STYLE.md` before editing public English copy, and consult `CONTENT_REVIEW.md` for facts that still need confirmation.

## English writing principles

This website is written for English-speaking visitors, not for Chinese speakers reading translated English. The goal is for a native English speaker to feel, “This was written by someone who lives in Wuyishan and naturally communicates in English,” not, “This is Chinese content translated into English.”

- Prioritize natural American English over literal translation.
- Preserve meaning, Jeff's personality, and cultural context rather than word-for-word accuracy.
- Never translate Chinese expressions, identities, internet phrases, cultural concepts, word order, or literal metaphors mechanically. Adapt the meaning into natural English communication.
- Avoid Chinese-style sentence structures, textbook English, unnatural tourism language, corporate language, and generic AI travel copy.
- Use conversational American English, everyday verbs, and concrete descriptions.
- Before adding or editing English copy, ask: `Would a native American English speaker actually say this in this situation?` If not, rewrite it.
- When a Chinese concept has no direct English equivalent, choose the closest natural expression or explain the meaning briefly in context. Do not force a word-for-word translation into quotation marks.
- Do not force `奶爸` into a literal English identity label. Depending on context, use `dad`, `father`, `a father exploring Wuyishan with his family`, or another natural expression.
- `Local Dad Jeff` may remain as the brand name, but do not repeatedly use `local dad` as a normal self-introduction or sentence structure.
- Preferred introduction: `I'm Jeff — a dad, coffee-cart owner, and licensed tour guide living in Wuyishan, China.`
- Avoid: `I'm Jeff — a local dad...`
- Apply these principles to all website copy, page titles, SEO descriptions, navigation labels, buttons, metadata, future articles, and location pages.
- Never use `slowly`. Do not use `slow` as generic brand language or a travel slogan.
- Avoid brochure language and clichés including `Top 10`, `must-see`, `must-visit`, `hidden gem`, `paradise`, `breathtaking`, `ultimate guide`, `bucket list`, and `world-famous scenic wonder`.
- Use verified Chinese place names beside English names when they already exist in project data. Never guess a Chinese name or romanization.

## Content architecture

- Main editorial guides: `src/content/guides/`
- Location facts and publishing state: `src/data/locations/`
- Location narratives: `src/content/locations/`
- Future routes: `src/content/routes/`
- Future tea articles: `src/content/tea-culture/`
- Future family guides: `src/content/family-guides/`
- Future local stories: `src/content/local-stories/`
- Future Why Wuyishan knowledge articles: `src/content/knowledge/`
- Controlled heritage topics: `src/data/topics.ts`
- Future video records: `src/data/videos.ts`
- Future managed image records: `src/data/image-sources/`
- Automatically discovered future place sources: `src/data/place-sources/`
- Automatically discovered future video sources: `src/data/video-sources/`
- Future confirmed creator profiles: `src/data/creator-profiles.ts`
- Future interactive-map route geometry: `src/data/map-routes.ts`
- Future pillar definitions: `src/data/pillars.ts`
- Reusable UI: `src/components/`
- Layouts and metadata composition: `src/layouts/`
- Schemas and types: `src/content.config.ts`, `src/content/schema.ts`, and `src/types/`
- Shared site and editorial data: `src/data/`

Use the authoring commands and existing collection schemas. Do not create a one-off page when an existing content collection or reusable component fits.

The long-term content hierarchy is defined in `docs/CONTENT-STRATEGY.md`: Why Wuyishan, Explore Wuyishan, Stories of Wuyishan, and About Jeff. Why Wuyishan is the primary pillar. Explore answers how visitors can experience the place; Stories supplies supporting human context. Do not add empty public sections or change navigation merely to expose future architecture.

### Location records

A location is split into typed facts and personal narrative:

For a new place, use `npm run content:new` so its JSON facts and English narrative are created as an automatically discovered draft. Existing typed locations keep their current workflow until a migration is explicitly authorized.

Follow `LOCATION_DATABASE.md`. Keep unknown values absent rather than filling them with assumptions. Preserve trust status, source status, editorial dates, image dimensions, and accurate alt text.

### Publishing status

- New articles should begin as `recordStatus: draft` unless the owner explicitly supplies verified, publication-ready material.
- Change a record to `published` only after its facts, English copy, metadata, images, and links have been reviewed.
- Do not edit generated files in `dist/` or Astro cache files in `.astro/`.

## Design and implementation

- Preserve the established calm, nature-oriented visual identity unless the task explicitly requests a redesign.
- Design mobile-first and prioritize readability, whitespace, clear hierarchy, and large real photography.
- Prefer semantic HTML and progressive enhancement. Keep client-side JavaScript close to zero.
- Reuse existing components for cards, articles, locations, galleries, maps, video embeds, breadcrumbs, metadata, and trust labels.
- Use `npm run image:prepare` for new managed photography. Do not hand-write responsive image variants or publish an image whose rights remain unconfirmed.
- Avoid new dependencies unless they provide a clear benefit that cannot be achieved with Astro, TypeScript, HTML, or CSS already in the project.
- Keep TypeScript strict and use typed data rather than unvalidated page-local objects.
- Preserve keyboard access, visible focus states, reduced-motion preferences, screen-reader behavior, and sufficient color contrast.
- Every content image needs accurate alt text, explicit width and height, appropriate loading behavior, and permission to publish.

## SEO and dates

- Every public page needs a unique, useful title and meta description.
- Preserve canonical URLs, Open Graph metadata, structured data, sitemap generation, robots.txt, breadcrumbs, and heading hierarchy.
- Use Wuyishan and Wuyi Mountain terms naturally; never stuff keywords or repeat them mechanically.
- `published` is the original publication date.
- `updated` is the last meaningful editorial edit date.
- `lastPersonallyChecked` is exclusively an in-person field-check date confirmed by Jeff.
- Follow `docs/DATE_SEMANTICS.md`. Do not use build or deployment dates as editorial or field-check dates.

## Required verification

Use Node.js 20 or newer. Before handing off code changes, run:

```bash
npm run build
```

The command runs Astro diagnostics, creates the static site, and validates generated output. Fix relevant errors and warnings rather than hiding them. For layout or interaction changes, inspect both mobile and desktop rendering and test keyboard navigation.

Also check, as relevant to the change:

- internal links and current-page navigation state;
- headings, metadata, canonical URLs, and structured data;
- image paths, dimensions, alt text, and loading behavior;
- prohibited brand language and accidental literal translations;
- the absence of invented or unconfirmed claims.

## Deployment

The production site is `https://local-dad-jeff.vercel.app`.

- Deploy only when the user explicitly asks for deployment or when deployment is an explicit acceptance criterion of the active task.
- Run a successful clean production build first.
- Deploy explicitly to Production with `npx vercel --prod`; use `--force` when a clean, uncached production build is required.
- Verify the canonical production URL after deployment, not only the temporary deployment URL.
- Open or request the changed public pages and confirm the new content is present and major navigation still works.
- Report the production URL and commit hash. Do not report completion before the public pages show the intended result.

## Git and repository safety

- Preserve unrelated user changes in a dirty worktree.
- Do not use destructive commands such as `git reset --hard` or discard files you did not create.
- Keep changes scoped to the request; do not add major features during cleanup, audit, or copy-editing tasks.
- Use concise commits that describe the completed work. Do not commit deployment artifacts, `dist/`, `.astro/`, or secrets.
- Never expose Vercel tokens, environment secrets, private owner information, or unconfirmed contact details in source, logs, or public copy.

## Key documentation

- `README.md` — setup, editing, images, and deployment
- `CONTENT-GUIDE.md` — voice and permanent brand-language rules
- `docs/ENGLISH-CONTENT-STYLE.md` — permanent English editorial style, content-type boundaries, cultural adaptation, and speakable writing
- `CONTENT_REVIEW.md` — claims awaiting Jeff's confirmation
- `LOCATION_DATABASE.md` — location database workflow
- `PHOTO-CHECKLIST.md` — real-photo replacement status
- `docs/ARCHITECTURE.md` — project structure and validation
- `docs/PERFORMANCE.md` — performance notes
- `docs/DATE_SEMANTICS.md` — date definitions and implementation
