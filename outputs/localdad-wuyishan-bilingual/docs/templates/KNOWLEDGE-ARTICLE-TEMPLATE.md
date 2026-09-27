# Knowledge Article Production Template

This internal template defines the complete package for a future Why Wuyishan knowledge article. Copy its structure into a draft created with `npm run content:new`; do not place this template itself in `src/content/knowledge/`.

Angle-bracket instructions are editorial prompts, not article copy. Replace them only with reviewed material. A draft remains unpublished until every publication gate in `docs/PHASE-1D-PUBLICATION-WORKFLOW.md` is satisfied and Jeff approves it.

## Frontmatter template

```yaml
---
title: "<approved public title>"
seoTitle: "<concise search title when the public title is too long>"
slug: "<stable lowercase slug>"
description: "<50–180 character reviewed SEO description>"
eyebrow: "Why Wuyishan · <approved category label>"
lang: "en"
translationKey: "<stable content ID>"
audience: ["International visitors"]
contentCategory: "<why-wuyishan or controlled heritage category ID>"
summary: "<short visitor-facing summary>"
whyItMatters: "<short explanation of why an international visitor should care>"
keyIdeaIds: ["<controlled topic ID>"]
created: <real draft creation date>
updated: <real last meaningful editorial edit date>
heritageCategory: "<overview or controlled heritage category ID>"
heritageCategories: ["<controlled heritage category ID>"]
trustStatus: "research-in-progress"
recordStatus: "draft"
relatedPlaceIds: []
relatedPersonIds: []
relatedStoryIds: []
relatedRouteIds: []
relatedKnowledgeIds: []
relatedGuideIds: []
relatedTopics: ["<controlled topic ID>"]
videos: []
sources:
  - title: "<source title>"
    publisher: "<institution or publication>"
    url: "<source URL when available>"
    accessed: <real access date>
learningNotes:
  learningLevel: "<reviewed level>"
  readingFocus: ["<reading skill or subject focus>"]
  speakingTopic: "<one practical speaking topic>"
  keyVocabulary:
    - term: "<useful English term>"
      meaning: "<plain-English meaning when needed>"
  usefulSentences: ["<reviewed sentence copied or adapted from the approved article language>"]
  speakingPractice: []
  guideUsage: ["<specific future visitor or guiding situation where this language is useful>"]
---
```

Do not add `published` until the article is approved for publication. Never use a build date as `created`, `updated`, `published`, or `lastPersonallyChecked`.

## Public visitor section

The layout renders the frontmatter fields in this order before and around the Markdown body:

1. **Title** — the approved public title.
2. **Summary** — a concise orientation for a reader who may know nothing about Wuyishan.
3. **Why this matters** — a short visitor-focused reason to continue reading.
4. **Key ideas** — a small set resolved from controlled topic IDs.
5. **Main article body** — the complete reviewed article, using descriptive headings that fit the subject.
6. **Sources and further reading** — titled sources with institution or publication and link where available.
7. **Continue exploring Wuyishan** — a short set of validated relationships to published material only.

### Main article body

```markdown
## <First descriptive section heading>

<Reviewed visitor-facing prose.>

## <Next descriptive section heading>

<Reviewed visitor-facing prose.>

## <Closing section heading when the subject requires one>

<Reviewed visitor-facing prose.>
```

The body must not contain drafting instructions, source reminders, learning exercises, Chinese meanings, internal status notes, or a generic heading such as `Main article body`.

## English learning section

English-learning material belongs in `learningNotes`, not in the visitor body.

- **Learning level:** reviewed difficulty guidance, not a formal certification.
- **Reading focus:** the concepts or reading skills Jeff should practice.
- **Speaking topic:** one clear subject Jeff can explain aloud.
- **Key vocabulary:** useful words from the approved article, with a plain-English meaning only when needed.
- **Useful sentences:** natural sentences Jeff can understand, say, and reuse; they must not introduce new facts.
- **Guide usage:** specific situations in which the language may help explain Wuyishan to an international visitor.

Chinese meanings must remain non-public. Add them only if a deliberate private learning field is introduced later; do not place them in the visitor body or overload the public English metadata.

## Editorial requirements

Before an article can move to final review, confirm that it:

- uses natural American English written directly for international visitors;
- avoids tourism marketing clichés, official-brochure language, textbook phrasing, and generic AI copy;
- supports important historical, scientific, cultural, and practical claims with appropriate sources;
- separates evidence, interpretation, and Jeff’s confirmed firsthand observations;
- preserves historical complexity rather than using simple origin stories or hero narratives;
- explains Chinese terms, institutions, and cultural concepts in context instead of translating them word for word;
- defines specialist vocabulary in plain English at first use;
- remains clear and natural when read aloud;
- links only to real, published related content through validated stable IDs.

This template does not authorize publication or deployment.
