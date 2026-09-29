# Knowledge map data sources

The public `KnowledgePlace` record is currently assembled from several reviewed sources. This document records the canonical source for each field until place editing is unified behind one maintained record.

| Public field | Current canonical source | Notes |
| --- | --- | --- |
| `id`, coordinates, public approval | `src/data/wuyishan-public-map.json` | Preserve the `WY-xxxx` identifier and reviewed coordinates. |
| Chinese name, region, summary, facilities, theme assignment, legacy family flag, photo filename | `src/data/visitor-runtime.json` | Generated from the maintained visitor store by `scripts/sync-visitor-content.mjs`. Do not hand-edit the generated file. |
| `shortNameZh`, `labelPriority`, public category | `src/data/map-place-labels.ts` | Controls progressive map labels and collision priority. |
| English name, English-name review status, English summary, English region | `src/data/knowledge-places.ts` | Add names only after human review; do not batch translate pending places. |
| `familySuitability`, `familyNotes` | `src/data/knowledge-places.ts` adapter | `familySuitability` is the public canonical value. The runtime boolean is a legacy import input only. |
| Route membership, role, stage, geometry relationship | `src/data/knowledge-routes.ts` | Route pages and core-stop previous/next relationships read this shared structure. |
| Nearby places and nearby services | `src/data/knowledge-places.ts` relationship builder | Manual IDs take priority, then same stage, same route, and global distance fallback. Services remain separate. |
| Trust status | Owner/human confirmation in the public map plus explicit managed status | Public UI shows editorial meaning only, not internal workflow state. |
| Videos, stories, research, detailed notes | `KnowledgePlace` fields | Leave empty until verified content and permission are available. Empty sections do not render. |

Future consolidation should let an editor update one place without knowing which source file supplies each field. That work should preserve coordinates, IDs, review status, and route relationships rather than replacing them with generated content.
