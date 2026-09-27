# Bilingual Content Architecture

English is the primary international-facing language. Chinese content is added only when a reviewed Chinese version exists.

Each language uses a separate Markdown file backed by the same shared records and relationship IDs. A translated pair shares one `translationKey` and has a different `lang` value.

## Routing modes

`src/i18n/config.ts` defines two explicit routing modes:

- `current`: English keeps its existing unprefixed URL and Chinese uses `/zh/`;
- `locale-prefixed`: English uses `/en/` and Chinese uses `/zh/`.

All public pages currently use `current`. This preserves every existing URL and does not create `/en/` or Chinese pages. Future bilingual entry points, including map datasets, may opt into `locale-prefixed` only as part of a reviewed migration with redirects, canonicals, alternate-language links, and complete public routes.

In the current mode:

- `lang: en` uses the normal unprefixed section URL;
- `lang: zh` uses the matching `/zh/` URL.

Do not use the prefixed mode to generate a link until its destination page exists. A route prefix is infrastructure, not a translation fallback.

The title, summary, description, metadata, and Markdown body belong to the language of that file. Named entities may also use `englishName` and a verified `chineseName`; these fields do not replace a properly written page translation.

The route validates that a collection does not contain two records with the same language and translation key. When both reviewed versions exist, canonical pages receive alternate-language metadata. A missing translation does not create an empty page or a machine-generated fallback.

Do not copy Chinese sentence structure into English. English copy follows `CONTENT-GUIDE.md` and `AGENTS.md`: natural American English, context and evidence first, no invented facts, and no literal translation of Chinese identities or cultural expressions.
