# Phase 1D Batch 1 Source Verification Workspace

**Prepared:** 2026-07-15  
**Scope:** Four unpublished Phase 1D Batch 1 knowledge articles  
**Publication action:** None. Article Markdown, `recordStatus`, and `trustStatus` remain unchanged.

This workspace maps claims to evidence requirements. It does not verify a claim merely because a source appears in an article. Existing sources are marked as **candidate only** until someone reads them and records exactly what they support.

## How to use this workspace

For each claim:

1. open the candidate source, if one exists;
2. confirm the source's complete bibliographic details;
3. record the page, section, or passage that supports the claim;
4. decide whether the source supports the wording and level of certainty used;
5. narrow or remove the claim later if the evidence is insufficient;
6. keep Jeff's confirmed firsthand observations separate from published evidence.

Claim types used here:

- **scientific** — biodiversity, ecology, natural systems, or research;
- **historical** — change over time, continuity, or historical development;
- **cultural** — practices, knowledge, identity, relationships, or community life;
- **agricultural** — tea growing, farm work, plants, land, or production;
- **visitor guidance** — visitor behavior, access, respect, or interpretation;
- **firsthand observation** — a statement explicitly confirmed as Jeff's own observation.

No current Batch 1 article contains a factual statement explicitly attributed to Jeff as a confirmed firsthand observation.

## 1. Natural Heritage: Why Wuyishan Is Important for Nature and Science

File: `src/content/knowledge/natural-heritage-wuyishan.md`

### Existing source register

None. The frontmatter `sources` array is empty.

### Claim mapping

| ID | Claim | Claim type | Required evidence type | Existing source mapping | Missing source fields |
| --- | --- | --- | --- | --- | --- |
| NH-01 | Plants, animals, water, climate, and human activities form a connected living system in Wuyishan. | scientific | An authoritative ecological description or suitable scientific study of the Wuyishan environment. | None. | Complete source title, responsible publication or institution, URL, access date, and supporting section or page. |
| NH-02 | Wuyishan's landscape includes red cliffs, winding rivers, green forests, and changing mountain views. | scientific | An authoritative landscape, geology, or heritage description; confirmed local observation may support only what Jeff has personally seen. | None. | Source or confirmed observation attribution, verification date, and scope of the description. |
| NH-03 | Forests, streams, and changes in elevation can create different habitats in the Wuyishan context. | scientific | Ecological or habitat research appropriate to the region. | None. | Full citation, URL, access date, and passage supporting the Wuyishan-specific application. |
| NH-04 | Wuyishan has a subtropical forest environment. | scientific | An authoritative natural-heritage or scientific classification of the regional environment. | None. | Full citation, classification wording, URL, access date, and supporting passage. |
| NH-05 | Conditions and forest characteristics differ across parts or elevations of the mountain. | scientific | Regional ecology, vegetation, climate, or elevation research. | None. | Full citation, study area, relevant elevation or habitat scope, URL, and supporting passage. |
| NH-06 | Questions about these natural differences have made Wuyishan a place of scientific interest. | historical | Documented research history or authoritative account of scientific work connected with Wuyishan. | None. | Source title, author or institution, publication date, URL, relevant period, and supporting passage. |
| NH-07 | Forest trees, plants, insects, animals, water, soil, climate, and other organisms interact as a system. | scientific | A reliable ecology source; a general ecology source must be clearly separated from Wuyishan-specific evidence. | None. | Source title, publication or institution, URL, access date, and claim scope. |
| NH-08 | Researchers study species diversity, ecological relationships, environmental change, and natural history in landscapes such as Wuyishan. | scientific | Research records or scientific publications showing the subjects actually studied in Wuyishan. | None. | Full citation, research subject, study location, URL or DOI, and supporting section. |
| NH-09 | People have grown tea, built communities, and used local resources within the Wuyishan landscape. | historical | Reliable regional history, cultural-landscape documentation, or separately attributed local evidence. | None. | Full citation or confirmed observation/interview attribution, time period, geographic scope, and supporting passage. |
| NH-10 | Wuyishan is home to diverse forms of life and remains a place where people learn about nature. | scientific | Authoritative biodiversity evidence and documented current or historical research activity. | None. | Separate sources for biodiversity and research activity, with dates and supporting passages. |
| NH-11 | Protecting biodiversity can help protect ecosystems, scientific knowledge, cultural connections, and future discovery. | scientific | Conservation evidence appropriate to each part of the statement; interpretive wording must not exceed the evidence. | None. | Source for each linked outcome, publication details, URL, and supported scope. |

### Article-level missing source fields

- [ ] `sources[].title`
- [ ] `sources[].publisher`
- [ ] `sources[].url`
- [ ] `sources[].accessed`
- [ ] Claim IDs supported by each source
- [ ] Supporting page, section, or passage
- [ ] Verification status and reviewer date
- [ ] Firsthand-observation attribution, if Jeff later confirms any local description

## 2. Tea Culture in Wuyishan: More Than a Cup of Tea

File: `src/content/knowledge/tea-culture-wuyishan.md`

### Existing source register

- **TC-S1 — Mount Wuyi**  
  Publisher: UNESCO World Heritage Centre  
  URL: `https://whc.unesco.org/en/list/911/`  
  Status: Candidate only; exact claim support has not been recorded.
- **TC-S2 — The Taste of Tea: Material, Embodied Knowledge and Environmental History in Northern Fujian, China**  
  Publisher: *Journal of Material Culture*  
  URL: `https://doi.org/10.1177/1359183516633901`  
  Status: Candidate only; bibliographic details and exact claim support require verification.

### Claim mapping

| ID | Claim | Claim type | Required evidence type | Existing source mapping | Missing source fields |
| --- | --- | --- | --- | --- | --- |
| TC-01 | Tea culture in Wuyishan connects tea with people, knowledge, relationships, and everyday life. | cultural | Scholarly cultural research, documented local accounts, or clearly attributed firsthand observation. | TC-S2 is a candidate based on its recorded title; support is unverified. TC-S1 may provide general context only. | Supporting section or page, scope within northern Fujian or Wuyishan, access date, and verification result. |
| TC-02 | Visitors often begin their experience of Wuyishan tea through aroma, flavor, and tea names. | visitor guidance | Visitor research or confirmed observation with a clear source and limited scope. | None mapped. | Evidence source or Jeff attribution, observation context, date, and scope. |
| TC-03 | Tea in Wuyishan is connected with landscape, local knowledge, and relationships between people. | cultural | Scholarly cultural or environmental-history evidence. | TC-S2 is a candidate; TC-S1 is a candidate for general place context only. | Exact supporting passage, publication details, access date, and wording limits. |
| TC-04 | In many tea communities around Wuyishan, tea may be part of welcoming guests, meeting friends, discussing business, and family time. | cultural | Local ethnographic, sociological, or interview evidence; alternatively, separately attributed confirmed firsthand observations. | No existing source has been mapped to these four activities. | Source or observation attribution for each practice, community scope, date, and supporting passage. |
| TC-05 | A tea table can be a place for conversation and connection. | cultural | Cultural research, interview evidence, or confirmed firsthand observation. | TC-S2 is a possible candidate; support is unverified. | Exact passage or observation attribution, scope, and verification date. |
| TC-06 | Visitors may approach a tea conversation through questions about origin, production, and local preferences. | visitor guidance | Editorial guidance confirmed as appropriate by Jeff; factual answers would require their own evidence. | None required for the suggested questions themselves; no source is mapped to local preference claims. | Jeff review status and date; sources for any future factual answers. |
| TC-07 | Wuyi tea involves knowledge of growing plants, seasons, processing leaves, and recognizing tea characteristics. | agricultural | Tea-production research, practitioner documentation, or verified interviews. | TC-S2 is a candidate; exact coverage is unverified. | Supporting passage, production stage covered, geographic scope, access date, and verification result. |
| TC-08 | Tea makers may learn through observation and by working with more experienced people. | cultural | Practitioner interviews, ethnographic research, or documented training practices. | TC-S2 is a candidate; support is unverified. | Exact passage or interview attribution, date, place, and scope. |
| TC-09 | The mountain environment forms part of the setting where tea grows, while people use learned techniques to make tea. | agricultural | Regional growing-environment and tea-processing evidence. | TC-S2 is a candidate; TC-S1 may support only broad landscape context. | Separate evidence for environment and processing, supporting passages, and scope. |
| TC-10 | Tea culture changes as farmers, makers, families, and businesses work, learn, and share tea. | historical | Evidence of continuity and change over time from research, interviews, or local records. | TC-S2 may be a candidate for historical or material-knowledge context; support is unverified. | Time period, groups covered, supporting passage, and verification date. |

### Existing source fields requiring completion

For TC-S1:

- [ ] `accessed`
- [ ] Claim IDs actually supported
- [ ] Supporting section or passage
- [ ] Verification result and reviewer date

For TC-S2:

- [ ] Confirm complete bibliographic details
- [ ] `accessed`
- [ ] Claim IDs actually supported
- [ ] Supporting page, section, or passage
- [ ] Geographic scope and limitations
- [ ] Verification result and reviewer date

For uncovered cultural claims:

- [ ] Complete source title or confirmed firsthand-observation record
- [ ] Responsible author, publication, institution, or named interview source
- [ ] URL or other traceable reference where available
- [ ] Date, place, community scope, and supporting passage or observation note

## 3. Visiting a Tea Garden: Understanding Where Wuyi Tea Begins

File: `src/content/knowledge/tea-garden-wuyishan.md`

### Existing source register

- **TG-S1 — Mount Wuyi**  
  Publisher: UNESCO World Heritage Centre  
  URL: `https://whc.unesco.org/en/list/911/`  
  Status: Candidate only; it must not be assumed to support detailed agricultural or access claims.
- **TG-S2 — The Taste of Tea: Material, Embodied Knowledge and Environmental History in Northern Fujian, China**  
  Publisher: *Journal of Material Culture*  
  URL: `https://doi.org/10.1177/1359183516633901`  
  Status: Candidate only; bibliographic details and exact claim support require verification.

### Claim mapping

| ID | Claim | Claim type | Required evidence type | Existing source mapping | Missing source fields |
| --- | --- | --- | --- | --- | --- |
| TG-01 | A cup of Wuyi tea begins with tea plants growing in a mountain setting before processing and preparation. | agricultural | Regional cultivation and production evidence. | TG-S2 is a candidate; exact support is unverified. | Supporting passage, cultivation area, production scope, access date, and verification result. |
| TG-02 | Tea gardens connect mountain environment, plant growth, farming knowledge, and local communities. | agricultural | Regional agricultural, cultural-landscape, or practitioner evidence. | TG-S2 is a candidate; TG-S1 may provide broad place context only. | Evidence for each part of the connection, geographic scope, and supporting passages. |
| TG-03 | A tea garden is a working landscape shaped by natural conditions and human decisions. | agricultural | Agricultural-landscape research or verified practitioner accounts. | TG-S2 is a candidate; support is unverified. | Exact passage or interview attribution, location, date, and scope. |
| TG-04 | Climate, rainfall, sunlight, soil conditions, and surrounding vegetation are relevant conditions to observe in a tea garden. | scientific | Regional agronomy, ecology, or cultivation evidence covering the listed factors. | No existing source is confirmed to support the complete list. | Source title, publisher, URL or DOI, study area, factor-by-factor support, and access date. |
| TG-05 | Tea-garden work may involve observing weather, leaf condition, seasonal timing, and plant needs. | agricultural | Practitioner documentation, interviews, or cultivation research. | TG-S2 is a possible candidate; support is unverified. | Supporting passage or named practitioner account, season, location, and verification date. |
| TG-06 | Decisions about growing and processing tea draw on knowledge and experience. | agricultural | Production research or practitioner evidence. | TG-S2 is a candidate; exact support is unverified. | Supporting passage, production stage, geographic scope, and verification result. |
| TG-07 | A tea-garden visit can help visitors understand where tea begins and how people care for plants. | visitor guidance | Verified visitor access context and an appropriate local example; no access should be inferred. | None mapped. | Confirmed access conditions, place or program if later named, source or owner permission, and check date. |
| TG-08 | A tea garden is a workplace, and access should not be assumed. | visitor guidance | Property or operator guidance where a specific garden is discussed; general respectful-travel principle may remain editorial guidance. | None mapped. | Jeff review, any applicable owner or site guidance, location scope, and check date. |
| TG-09 | Visitors should ask permission, use permitted paths, and avoid touching plants unless invited. | visitor guidance | Jeff editorial confirmation plus site-specific rules if a place is later named. | None mapped. | Reviewer confirmation, location-specific authority if applicable, date, and scope. |
| TG-10 | Environmental and community needs can affect the future care of working tea landscapes. | agricultural | Sustainability, land-use, or community research appropriate to the regional context. | No existing source is confirmed to support this framing. | Full citation, study area, supporting passage, and evidence limitations. |
| TG-11 | Mountain environment, tea plants, human knowledge, and communities are connected in the story of Wuyi tea. | cultural | Evidence that supports the combined cultural-landscape interpretation without overstating uniformity. | TG-S2 is a candidate; TG-S1 may support general heritage context only. | Supporting passages for each connection, scope, and verification result. |

### Existing source fields requiring completion

For TG-S1:

- [ ] `accessed`
- [ ] Claim IDs actually supported
- [ ] Supporting section or passage
- [ ] Explicit note that it does not automatically support agricultural or access claims
- [ ] Verification result and reviewer date

For TG-S2:

- [ ] Confirm complete bibliographic details
- [ ] `accessed`
- [ ] Claim IDs actually supported
- [ ] Supporting page, section, or passage
- [ ] Geographic and production scope
- [ ] Verification result and reviewer date

For uncovered agricultural and visitor claims:

- [ ] Complete source or interview title
- [ ] Responsible author, publication, institution, operator, or named practitioner
- [ ] URL or other traceable record where available
- [ ] Location, season or date, and production stage
- [ ] Supporting passage or confirmed observation note
- [ ] Visitor-access authority and last confirmation date where applicable

## 4. Villages of Wuyishan: Places Where Landscape and Life Meet

File: `src/content/knowledge/villages-wuyishan.md`

### Existing source register

- **VW-S1 — Mount Wuyi**  
  Publisher: UNESCO World Heritage Centre  
  URL: `https://whc.unesco.org/en/list/911/`  
  Status: Candidate only; exact claim support has not been recorded.
- **VW-S2 — Research on Cultural Landscapes and Rural Communities**  
  Recorded publisher: `Academic research on cultural landscapes and rural communities.`  
  URL: None  
  Status: Not traceable. This record cannot be treated as a verified publication.

### Claim mapping

| ID | Claim | Claim type | Required evidence type | Existing source mapping | Missing source fields |
| --- | --- | --- | --- | --- | --- |
| VW-01 | Villages help explain how people live with the Wuyishan landscape and how traditions continue. | cultural | Regional cultural-landscape research, local history, interviews, or confirmed observation with limited scope. | VW-S1 may offer general heritage context. VW-S2 cannot be used until identified. | Traceable source or attribution, community scope, supporting passage, and verification date. |
| VW-02 | Different villages around Wuyishan have different relationships with mountains, rivers, and land. | cultural | Evidence from specific villages or comparative regional research. | No usable source mapped. | Named places or study scope, full citation, supporting passage, and limitations. |
| VW-03 | Geography can influence settlement, work, and local industries. | historical | Regional settlement, economic, geographic, or cultural-landscape evidence; general theory must be separated from Wuyishan-specific application. | VW-S2 was intended as background but is not identifiable. | Exact publication, author or institution, date, URL, study area, and supporting passage. |
| VW-04 | Community choices differ and change over time. | historical | Longitudinal research, local records, or interviews from identified communities. | None mapped. | Time period, place, source or interview attribution, and supporting evidence. |
| VW-05 | Tea connects some villages with the Wuyishan landscape. | agricultural | Evidence from identified tea-growing or tea-making communities. | VW-S1 may provide broad heritage context only; no village-level evidence is mapped. | Named community or study area, full citation, tea activity covered, and supporting passage. |
| VW-06 | People involved with village tea traditions understand land, plants, seasons, and tea making. | agricultural | Practitioner interviews, production research, or community documentation. | No usable source mapped. | Named or responsibly anonymized source, place, date, role, and supporting passage. |
| VW-07 | Tea may be part of work, family life, and local identity in some communities. | cultural | Ethnographic research, interviews, or confirmed firsthand observation with community scope. | No usable source mapped. | Community scope, source or observation attribution, date, and supporting passage. |
| VW-08 | Local food, traditional practices, small businesses, family stories, and routines can help explain village life. | cultural | Specific place records, resident interviews, or confirmed observations; broad examples should not be presented as universal. | None mapped. | Named community or story source, consent or attribution where needed, date, and scope. |
| VW-09 | Villages and communities continue to develop through new businesses and choices made by younger generations. | historical | Current community research, interviews, or local records showing change over time. | None mapped. | Place, time period, interview or publication details, and supporting evidence. |
| VW-10 | Traditional knowledge adapts to new situations. | cultural | Evidence from a specific practice or community; the claim is too broad without scope. | VW-S2 cannot support this unless a real publication is identified and checked. | Identified practice, community, source, date, and supporting passage. |
| VW-11 | Villages should be understood as lived communities rather than theme parks or static pictures of the past. | visitor guidance | Editorial principle confirmed by Jeff; any site-specific rules need local authority or resident guidance. | None mapped. | Jeff review status, date, and site-specific guidance if later added. |
| VW-12 | Visitors should respect private spaces and allow conversations to happen naturally. | visitor guidance | Jeff editorial confirmation plus resident or site guidance when applied to a named village. | None mapped. | Reviewer confirmation, named-place scope if applicable, and check date. |
| VW-13 | Individual residents can have different relationships with the same landscape, and their stories can add context. | cultural | Real interviews or stories with consent and clear attribution. | None mapped; future People and Story content is not evidence yet. | Person or story record, consent and attribution status, interview date and location, and related claim IDs. |
| VW-14 | Wuyishan is home to different communities that continue to change. | historical | Regional demographic, cultural, or community evidence with a defined time frame. | VW-S1 may provide general heritage context only. VW-S2 is unusable in its current form. | Full citation, communities and period covered, supporting passage, and verification result. |

### Existing source fields requiring completion

For VW-S1:

- [ ] `accessed`
- [ ] Claim IDs actually supported
- [ ] Supporting section or passage
- [ ] Scope and limitations
- [ ] Verification result and reviewer date

For VW-S2:

- [ ] Exact title
- [ ] Author or responsible institution
- [ ] Identifiable publisher or publication
- [ ] Publication date
- [ ] URL, DOI, ISBN, archive record, or other traceable reference
- [ ] `accessed`, if available online
- [ ] Claim IDs actually supported
- [ ] Supporting page, section, or passage
- [ ] Study area and limitations
- [ ] Verification result and reviewer date

For uncovered cultural, historical, and visitor claims:

- [ ] Complete source, record, interview, or observation title
- [ ] Responsible author, institution, resident, or interviewer
- [ ] Place and time scope
- [ ] URL or traceable record where available
- [ ] Supporting passage or observation note
- [ ] Consent and attribution status for future resident stories

## Batch verification tracker

- [ ] Every claim ID has either a verified source mapping or a decision to narrow/remove the claim in a separately approved editorial revision.
- [ ] Every source has complete identifying information and an access or review date.
- [ ] Existing source titles have been checked against the actual documents.
- [ ] Source relevance is recorded at the claim level, not only at the article level.
- [ ] General sources are not used as automatic support for specialized claims.
- [ ] Firsthand observations are explicitly attributed to Jeff and dated only after he confirms them.
- [ ] Interviews or resident stories include consent and attribution status before use.
- [ ] Visitor guidance distinguishes general respect principles from changing, place-specific rules.
- [ ] Article Markdown remains Draft until a separate source review and publication decision are complete.

Completing this workspace does not publish or deploy content.
