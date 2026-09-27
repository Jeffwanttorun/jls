# Phase 1E Batch 1 Production Pre-check

**Checked:** 2026-07-15  
**Deployment performed:** No  
**Result:** Ready for Production deployment when explicitly authorized.

## Scope note

The current working tree is a cumulative, uncommitted Phase 1B–1E website update. Before this report was created, Git showed:

- 31 modified tracked paths;
- 23 untracked paths or directories;
- branch: `main`;
- current HEAD: `4444340`.

The changes are broader than the four Batch 1 article status edits. They also include the previously requested editorial layout, Draft preview, content schemas, relationship registry, validation scripts, pillar navigation, guide metadata, styles, and Phase 1B–1E documentation. These are expected parts of the completed website and editorial workflow work.

No unrelated application, generated `dist` output, secret key, environment file, or deployment credential was found in the Git change list. `git diff --check` passed.

**Deployment implication:** A Vercel deployment from this working directory will include the complete accumulated website foundation and editorial changes, not an isolated four-file patch. This matches the completed project work, but it should remain explicit in the deployment handoff.

## 1. Publication records

The four articles contain the intended publication fields:

```yaml
published: 2026-07-15
recordStatus: "published"
trustStatus: "research-in-progress"
```

Verified articles:

- `src/content/knowledge/natural-heritage-wuyishan.md`
- `src/content/knowledge/tea-culture-wuyishan.md`
- `src/content/knowledge/tea-garden-wuyishan.md`
- `src/content/knowledge/villages-wuyishan.md`

Their stable slugs, translation keys, relationships, sources, bodies, learning notes, and created dates remain in place.

## 2. Build and validation

The required commands completed successfully:

| Command | Result |
| --- | --- |
| `npm run content:check` | Passed |
| `npm run build` | Passed |
| `npm run content:relationships` | Passed |
| `npm run validate:site` | Passed |

Final build results:

- 55 Astro/project files checked;
- 0 errors;
- 0 warnings;
- 0 hints;
- 26 generated HTML files;
- 0 bytes of generated JavaScript files;
- all generated internal links validated;
- content inventory and content quality checks passed;
- relationship validation passed.

## 3. Production routes

The production build generated all four expected static routes:

- `/why-wuyishan/natural-heritage-wuyishan`
- `/why-wuyishan/tea-culture-wuyishan`
- `/why-wuyishan/tea-garden-wuyishan`
- `/why-wuyishan/villages-wuyishan`

Each generated HTML file exists and is non-empty.

## 4. Sitemap

The generated sitemap contains 25 unique public URLs. The build creates 26 HTML files because `404.html` is not a sitemap entry.

Verified:

- each of the four Batch 1 URLs appears exactly once;
- no sitemap URL is duplicated;
- no `/draft-preview/` URL appears;
- sitemap URLs use the production origin and no trailing slash.

## 5. SEO output

### Natural Heritage

- Title: `Wuyishan Natural Heritage | Local Dad Jeff`
- Description: `Wuyishan is known for its mountains, rivers, and forests, but its importance goes beyond scenery.`
- Canonical: `https://local-dad-jeff.vercel.app/why-wuyishan/natural-heritage-wuyishan`
- `og:url`: matches canonical

### Tea Culture

- Title: `Tea Culture in Wuyishan: More Than a Cup of Tea | Local Dad Jeff`
- Description: `Tea offers one way to understand Wuyishan through the mountain environment, specialist skills, local knowledge, and tea-making traditions.`
- Canonical: `https://local-dad-jeff.vercel.app/why-wuyishan/tea-culture-wuyishan`
- `og:url`: matches canonical

### Tea Garden

- Title: `Visiting a Tea Garden in Wuyishan | Local Dad Jeff`
- Description: `Learn how Wuyishan tea gardens connect landscape, tea knowledge, and working practices, with clear guidance about access and visitor boundaries.`
- Canonical: `https://local-dad-jeff.vercel.app/why-wuyishan/tea-garden-wuyishan`
- `og:url`: matches canonical

### Villages

- Title: `Villages of Wuyishan | Local Dad Jeff`
- Description: `Documented Wuyishan communities show how landscape and living heritage connect, with guidance for visitors approaching village life respectfully.`
- Canonical: `https://local-dad-jeff.vercel.app/why-wuyishan/villages-wuyishan`
- `og:url`: matches canonical

All four titles and descriptions are unique. Canonical and Open Graph URLs use the expected production route.

## 6. Navigation and relationships

The generated `/why-wuyishan` page contains one link to each Batch 1 article:

- Natural Heritage under Natural Heritage;
- Tea Culture and Tea Garden under Tea Heritage;
- Villages under Living Heritage.

The generated `/explore-wuyishan` page contains one Tea Garden link under Tea Experiences.

Relationship checks confirmed:

- Tea Garden → Tea Culture resolves to the public Tea Culture route;
- all four articles link safely to Why Wuyishan Matters;
- the existing related guide links resolve;
- no broken relationship or Draft-only target was found.

## 7. Deployment readiness

Phase 1E Batch 1 is ready for a Production deployment.

Before deploying:

- do not make additional content or status changes;
- deploy the verified working tree as one coordinated release;
- use an explicit Production deployment command only after owner authorization;
- after deployment, inspect the canonical Production URL rather than only the Vercel deployment alias;
- verify all four public pages, Why Wuyishan, Explore Wuyishan, and the public sitemap.

No deployment was performed during this pre-check.
