# Phase 1D Publication Workflow

Phase 1D turns approved editorial topics into complete, reviewable English knowledge articles. This document prepares the workflow only. It does not create article bodies, approve claims, change record status, publish pages, or authorize deployment.

Use this workflow with:

- `docs/PHASE-1C-EDITORIAL-AUDIT.md` for current gaps;
- `docs/templates/KNOWLEDGE-ARTICLE-TEMPLATE.md` for the article package;
- `docs/ENGLISH-CONTENT-STYLE.md` for permanent English rules;
- `docs/CONTENT-REVIEW-CHECKLIST.md` for final editorial review.

## Production stages

### 1. Research package

Collect the material required by the Phase 1C audit. Separate:

- authoritative or primary sources;
- scholarly interpretation;
- official or institutional information;
- Jeff’s confirmed firsthand observation;
- claims that remain unresolved.

Do not draft around a missing fact. Narrow the planned claim or keep the article in research.

### 2. Complete Draft

Create or update the Draft with the reusable template. The article package must contain every public visitor and English-learning field. `recordStatus` remains `draft`, and no `published` date is added.

### 3. Source verification

Check each important historical, scientific, cultural, or practical claim against its cited source. A source list at the end is not enough: the source must actually support the wording and level of certainty used in the body.

### 4. English editorial review

Review the complete body as English communication, not translated Chinese content. Confirm natural American syntax, adequate context for first-time international readers, precise explanations of Chinese concepts, and language Jeff can say aloud.

### 5. Learning review

Extract learning material from the approved article language without adding facts. Confirm the learning level, reading focus, speaking topic, key vocabulary, useful sentences, and future guide usage.

### 6. Relationship review

Add controlled topics and only meaningful stable relationships. `Continue exploring Wuyishan` may link only to published content. Do not create an empty article or a draft relationship merely to complete a reading path.

### 7. Ready for review

An article reaches **Ready for review** only when:

- the complete visitor body is present;
- internal draft instructions have been removed because their requirements were resolved;
- important claims have traceable source support;
- all required public and learning fields are complete;
- the English and read-aloud review have passed;
- relationship validation passes;
- the local draft preview works on mobile and desktop;
- `npm run content:check` passes.

Ready for review is not approval to publish.

### 8. Jeff approval and publication preparation

After Jeff approves the final article:

1. add the real `published` date;
2. change `recordStatus` to `published`;
3. run `npm run content:check` again;
4. inspect the production preview, sitemap, metadata, and related links;
5. deploy only when Jeff explicitly requests it.

## Required article package

### Public visitor material

- Title
- Summary
- Why this matters
- Main article body
- Key ideas
- Sources and further reading
- Continue exploring Wuyishan

### Private English-learning material

- Learning level
- Reading focus
- Speaking topic
- Key vocabulary
- Useful sentences
- Guide usage

The learning package remains metadata and is not displayed publicly unless a separate future decision introduces a deliberate learning view.

## Production priority

| Order | Approved topic | Phase 1C starting state |
| --- | --- | --- |
| 1 | Natural Heritage: Why Wuyishan Is Important for Nature and Science | Body and research package required |
| 2 | Tea Culture in Wuyishan: More Than a Cup of Tea | Body and research package required |
| 3 | Visiting a Tea Garden: Understanding Where Wuyi Tea Begins | Body and research package required |
| 4 | Villages of Wuyishan: Places Where Landscape and Life Meet | Body and research package required |
| 5 | Plants, Scientific Research, and the Natural History of Wuyishan | Existing incomplete Draft; historical research and source verification required |
| 6 | Inside Wuyishan’s Forests: How Plants Adapt to Their Environment | Body and research package required |
| 7 | Understanding Wuyi Rock Tea: The Craft Behind the Flavor | Body and research package required |
| 8 | The Journey of Wuyi Tea: From Leaf to Tea Table | Body and research package required |
| 9 | Wuyi Tea: From Local Mountains to Global Tea History | Existing incomplete Draft; source verification and additional research required |
| 10 | Zhu Xi and Wuyishan: A Landscape of Ideas | Existing incomplete Draft; source verification and additional research required |
| 11 | Wuyi Jingshe: A Place Where Ideas Were Studied | Body, source verification, and additional research required |

Do not skip a blocked article by publishing incomplete material. Work may begin on the next research package, but the public order and relationships should be reviewed again when complete bodies exist.

## Permanent editorial rules

- Write natural American English for international visitors.
- Explain Wuyishan; do not promote it.
- Avoid tourism clichés, exaggeration, official-brochure language, and generic AI phrasing.
- Do not invent facts, quotations, stories, field observations, dates, or relationships.
- Preserve disagreement, change over time, and historical complexity where the subject requires it.
- Explain Chinese concepts by function and context. Do not force a literal English label.
- Keep learning metadata useful for speaking, video narration, and future guiding without making Jeff the subject of every article.

No step in this workflow publishes or deploys content automatically.
