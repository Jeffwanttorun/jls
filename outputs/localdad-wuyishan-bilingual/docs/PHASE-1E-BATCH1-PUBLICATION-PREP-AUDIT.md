# Phase 1E Batch 1 Publication Preparation Audit

**Prepared:** 2026-07-15  
**Scope:** Four Phase 1D Batch 1 knowledge articles  
**Action taken:** Audit document only. No article, status, relationship, page, route, or deployment configuration was changed.

## Articles reviewed

- `src/content/knowledge/natural-heritage-wuyishan.md`
- `src/content/knowledge/tea-culture-wuyishan.md`
- `src/content/knowledge/tea-garden-wuyishan.md`
- `src/content/knowledge/villages-wuyishan.md`

## Executive recommendation

Publish all four articles in one coordinated release after completing the small metadata and discovery tasks in this audit.

A staged release offers little editorial benefit now that all four have completed source verification and final minor adjustments. A coordinated release gives **Why Wuyishan** useful Natural Heritage, Tea Heritage, and Living Heritage entry points at the same time. It also avoids a relationship-order problem: Tea Garden currently references Tea Culture, so Tea Garden cannot safely become public before Tea Culture has a public URL.

This recommendation does not authorize publication. All four articles remain Draft.

## 1. Publication order recommendation

### Recommended release: one coordinated Batch 1 publication

Publish in one production build, with this presentation order:

1. **Natural Heritage: Why Wuyishan Is Important for Nature and Science**
2. **Tea Culture in Wuyishan: More Than a Cup of Tea**
3. **Visiting a Tea Garden: Understanding Where Wuyi Tea Begins**
4. **Villages of Wuyishan: Places Where Landscape and Life Meet**

The order follows the website's visitor path:

- understand the natural landscape;
- understand tea as heritage and knowledge;
- move from tea context to a carefully bounded visitor experience;
- understand villages as living communities within the landscape.

### Why all four should be released together

#### Why Wuyishan structure

- Natural Heritage receives its first focused Batch 1 article.
- Tea Heritage receives one knowledge article and one visitor-oriented article.
- Living Heritage receives its first focused Batch 1 article.
- Cultural Heritage remains an honest future direction; no empty or invented page is needed.

#### Visitor usefulness

- Natural Heritage explains why the protected landscape matters.
- Tea Culture supplies context before a visitor reads about gardens or tea experiences.
- Tea Garden clearly states that no specific garden is confirmed as publicly accessible.
- Villages supplies community and privacy context before future place or story content is added.

#### Internal relationships

- Natural Heritage, Tea Culture, and Villages point to the published Why Wuyishan overview.
- Tea Garden points to the overview and to Tea Culture.
- Publishing the whole batch makes every `relatedKnowledgeIds` target linkable in the same build.
- Existing guide targets are already published.

#### SEO entry points

The batch creates four distinct search entry points:

- Wuyishan natural heritage and science;
- Wuyishan tea culture;
- visiting or understanding a Wuyi tea garden;
- Wuyishan villages and living heritage.

Publishing all four together creates a small topic cluster instead of four isolated sitemap entries.

### If staging becomes operationally necessary

Use this dependency-safe order:

1. Natural Heritage, Tea Culture, and Villages;
2. Tea Garden only after Tea Culture is public.

Do not publish Tea Garden while Tea Culture remains Draft. The public article route resolves `relatedKnowledgeIds` into linkable URLs; a Draft Tea Culture record has no public `href`, so that order can fail the production build.

## 2. Status transition review

### Current state

All four articles currently use:

```yaml
recordStatus: "draft"
trustStatus: "research-in-progress"
```

None currently has a `published` date.

### Recommended publication transition

For each article:

```yaml
published: "ACTUAL-PUBLICATION-DATE"
recordStatus: "published"
trustStatus: "research-in-progress"
```

Use the actual first public release date. Do not reuse a build date, earlier draft date, or planned date.

### Trust-status recommendation

Keep `trustStatus: research-in-progress` after publication.

Reasons:

- The articles combine official information, academic research, visitor interpretation, and editorial explanation.
- `official-information` would imply a narrower source type than the articles actually use.
- `personal-experience` is not appropriate because these articles are not presented as Jeff's confirmed firsthand accounts.
- `checked-on-location` is not appropriate and would require a real `lastPersonallyChecked` date.
- `reconfirm-before-travel` is designed for changing practical travel details, not the overall trust model of these knowledge articles.
- The public knowledge layout already turns `research-in-progress` into the calm **About this article** note rather than a warning badge.

### Date handling

- Add `published` only when the articles actually become public.
- Change `updated` only when a meaningful editorial or metadata edit is made.
- Never use the publication, build, or deployment date as `lastPersonallyChecked`.

## 3. Relationship and public-surface impact

### Homepage

The homepage does not automatically list published knowledge articles. Its four heritage cards link to anchors on `/why-wuyishan`.

**Required homepage change:** None, provided the Why Wuyishan pillar page receives direct article links in the same release.

The existing homepage flow remains appropriate:

`Homepage heritage card → Why Wuyishan section → published article`

### Why Wuyishan pillar page

The pillar page currently hardcodes only the overview article. Natural Heritage, Tea Heritage, and Living Heritage contain explanatory text but no Batch 1 links.

**Required publication change:** Update `src/pages/why-wuyishan.astro` in the publication commit:

- Natural Heritage → Natural Heritage article;
- Tea Heritage → Tea Culture, then Tea Garden;
- Living Heritage → Villages;
- Cultural Heritage → remain unchanged until verified cultural content is ready.

Without this change, the four new URLs would exist and appear in the sitemap but would have no natural inbound link from their primary pillar page.

### Explore Wuyishan

Publishing the articles does not automatically change `/explore-wuyishan`.

**Recommended publication change:** Add Tea Garden to the existing Tea Experiences links after it becomes public. Tea Culture can also be linked there when useful, but its primary home remains Why Wuyishan.

Do not move Villages into the location database or present it as a place page. It is a knowledge article about living heritage, not a verified village listing.

### Related content rendering

After all four are published:

| Article | Public related knowledge | Public related guide |
| --- | --- | --- |
| Natural Heritage | Why Wuyishan Matters | Main Scenic Area |
| Tea Culture | Why Wuyishan Matters | Wuyi Rock Tea |
| Tea Garden | Why Wuyishan Matters; Tea Culture | Wuyi Rock Tea |
| Villages | Why Wuyishan Matters | None |

No Draft-only target remains in these public relationships if the complete batch is released together.

The current relationship direction is article → guide. Publishing an article does not automatically add a reverse link to an existing guide page.

### Sitemap and route generation

Current verified baseline:

- generated HTML files: 22;
- sitemap URL entries: 22;
- Batch 1 public URLs present: 0;
- Draft preview URLs in production: 0.

After a coordinated publication, the expected result is:

- four new static article pages;
- four new sitemap entries;
- approximately 26 generated HTML files and 26 sitemap entries, assuming no unrelated route changes;
- no `/draft-preview/` URLs in the production build or sitemap.

Expected public URLs:

- `/why-wuyishan/natural-heritage-wuyishan`
- `/why-wuyishan/tea-culture-wuyishan`
- `/why-wuyishan/tea-garden-wuyishan`
- `/why-wuyishan/villages-wuyishan`

The project uses `trailingSlash: "never"`; do not introduce alternate trailing-slash URL rules.

## 4. SEO and metadata review

### Metadata summary

| Article | Title | Description | Slug / translation key | Result |
| --- | --- | --- | --- | --- |
| Natural Heritage | Unique and accurate | Valid length and relevant | Matching, stable | Ready with one SEO-title recommendation |
| Tea Culture | Unique and accurate | Strong and specific | Matching, stable | Ready |
| Tea Garden | Unique and accurate | Valid but too general | Matching, stable | Needs minor metadata improvement |
| Villages | Unique and accurate | Specific after final adjustment | Matching, stable | Ready |

### Title behavior

The layout adds `| Local Dad Jeff` and shortens long titles at the first colon when the complete title would exceed 70 characters.

- Tea Culture fits with the brand suffix.
- Villages retains `Wuyishan` in its compact title.
- Natural Heritage would compact to `Natural Heritage | Local Dad Jeff`, losing `Wuyishan`.
- Tea Garden would compact to `Visiting a Tea Garden | Local Dad Jeff`, also losing `Wuyishan`.

**Recommended before publication:** Add concise `seoTitle` values for Natural Heritage and Tea Garden so their public `<title>` elements retain Wuyishan context while remaining under 70 characters. Do not change the visible article titles.

### Description review

- Natural Heritage: valid, clear, and within the configured range.
- Tea Culture: valid, specific, and within the configured range.
- Tea Garden: valid at 62 characters but does not explain Wuyishan, working landscapes, permission, or the article's educational purpose. Improve it before publication using only existing article meaning.
- Villages: valid, specific, and within the configured range.

### Summary review

- All summaries are present and distinct.
- Natural Heritage still uses the broader phrase `natural systems`; consider aligning it with the article's more specific forest-community and biodiversity language during the final metadata pass.
- Tea Culture, Tea Garden, and Villages summaries match their current body scope.

### Slug and translation-key review

All four slugs are valid, unique, stable, and match their English `translationKey`. No URL migration or redirect is required.

### Structured data and social metadata

- Published articles will receive Article and Breadcrumb structured data only when a valid `published` date exists.
- Canonical and Open Graph URLs are generated from the production site configuration.
- A default social image is available through the base layout when no article-specific image is supplied.
- Learning Notes remain available in Draft preview only and will not appear on public article pages. This matches the current visitor-first implementation and requires no publication change.

## 5. First publication checklist

### Files to change in the future publication commit

Required:

1. `src/content/knowledge/natural-heritage-wuyishan.md`
   - add actual `published` date;
   - change `recordStatus` to `published`;
   - add a concise Wuyishan-specific `seoTitle`.
2. `src/content/knowledge/tea-culture-wuyishan.md`
   - add actual `published` date;
   - change `recordStatus` to `published`.
3. `src/content/knowledge/tea-garden-wuyishan.md`
   - add actual `published` date;
   - change `recordStatus` to `published`;
   - add a concise Wuyishan-specific `seoTitle`;
   - improve the description using only current article meaning.
4. `src/content/knowledge/villages-wuyishan.md`
   - add actual `published` date;
   - change `recordStatus` to `published`.
5. `src/pages/why-wuyishan.astro`
   - add the four public article links under their correct heritage sections.

Recommended:

6. `src/pages/explore-wuyishan.astro`
   - add Tea Garden under Tea Experiences after its route exists.

No schema, content collection, navigation, homepage, or URL-rule change is required.

### Pre-publication validation commands

Run:

```bash
npm run content:check
npm run build
npm run content:relationships
npm run validate:site
```

Also confirm:

- exactly four new article routes are generated;
- all four appear in the sitemap;
- no Draft article appears in the sitemap;
- no `/draft-preview/` route is present in a production build;
- Tea Garden resolves Tea Culture without a linkability error;
- Why Wuyishan links to all four articles;
- Explore Wuyishan links to Tea Garden only if that recommended change is included;
- every page has one H1, a unique title, a unique description, a canonical URL, Open Graph metadata, and valid JSON-LD;
- mobile article layout and source lists remain readable.

### Deployment precautions

1. Commit the complete publication state, metadata, pillar links, and optional Explore link together.
2. Run a clean production build before deployment.
3. Review the generated sitemap before deploying.
4. Deploy explicitly to Vercel Production only after Jeff authorizes publication.
5. Open the canonical production URL for each article after deployment.
6. Verify the Why Wuyishan and Explore Wuyishan links on desktop and mobile.
7. Confirm that Draft preview URLs are unavailable on Production.
8. Confirm that the public About-this-article note is calm and does not appear as an unfinished-content warning.
9. If any route or relationship fails, stop and fix the release rather than publishing a partial batch.

## 6. Risks and required final steps

### Current risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Publishing Tea Garden before Tea Culture | High | Publish both in the same build or publish Tea Culture first. |
| New articles have no inbound pillar links | High | Update `src/pages/why-wuyishan.astro` in the publication commit. |
| Missing `published` dates | High | Add the actual first-publication date to all four; schema validation requires it. |
| Natural Heritage and Tea Garden compact SEO titles lose `Wuyishan` | Medium | Add explicit, concise `seoTitle` fields. |
| Tea Garden description is too general | Medium | Improve it without adding new claims. |
| Status changed to `official-information` | Medium | Keep `research-in-progress`; the source model is mixed. |
| Build date mistaken for editorial or field-check date | High | Follow the project's date semantics and never populate `lastPersonallyChecked` from a release. |

### Required final steps before publication

1. Jeff explicitly authorizes publication.
2. Apply the metadata changes listed above.
3. Add actual publication dates and change all four `recordStatus` values together.
4. Keep all four `trustStatus` values as `research-in-progress`.
5. Add direct links on Why Wuyishan.
6. Add the recommended Tea Garden link on Explore Wuyishan if desired for the first release.
7. Run the complete validation sequence.
8. Inspect the four rendered pages and their source lists on desktop and mobile.
9. Confirm four new sitemap entries and no Draft leakage.
10. Commit, deploy only with explicit authorization, and verify the canonical production pages.

## 7. Current validation result

The current Draft state was validated without changing any article or status:

- `npm run content:check`: passed;
- `npm run build`: passed;
- `npm run content:relationships`: passed;
- `npm run validate:site`: passed;
- Astro diagnostics: 0 errors, 0 warnings, 0 hints;
- generated HTML files: 22;
- generated JavaScript: 0 bytes;
- Draft leakage: none;
- Batch 1 sitemap entries: none;
- deployment: not performed.
