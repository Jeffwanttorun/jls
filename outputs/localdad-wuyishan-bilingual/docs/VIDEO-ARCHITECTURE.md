# Video Asset Architecture

## Publishing boundary

Videos are independent content assets loaded from automatically discovered JSON files in `src/data/video-sources/` and exposed through the typed `src/data/videos.ts` registry. Adding video metadata does not create a public page, embed, sitemap entry, or navigation item. A reviewed page must explicitly query and render a published video.

Do not add a record until the title, URL, platform, language, content type, publication date, thumbnail rights, relationships, and permission to publish have been confirmed. Draft records may remain incomplete, but a published record requires a description, publication date, thumbnail with alt text and dimensions, and at least one reviewed knowledge relationship.

## Record fields

Each `VideoRecord` supports:

- a stable `slug` and title;
- `youtube` or `instagram` as the controlled platform;
- a platform URL that is checked against the selected platform;
- an English or Chinese language code;
- a controlled content type: explanation, place visit, route, interview, or story;
- description, publication and update dates;
- a thumbnail with source path, alt text, width, and height;
- an optional transcript, either reviewed text or one transcript/caption URL;
- optional social title, description, and image overrides;
- explicit relationships to topics, places, routes, people, and stories;
- draft or published status.

Use one record for both languages when the video itself has one language. A separately edited or narrated version in another language is a separate video asset and may share the same relationships.

## Knowledge-network relationships

Relationships use controlled target types and stable target IDs. `videosForRelationship` finds published videos for any topic, place, route, person, or story. `buildReverseVideoIndex` provides the reverse index used by future related-video sections. The location registry already validates place and topic targets; route, people, and story target validation will become authoritative when those registries contain real records.

Relationships are editorial claims and must be reviewed. Do not connect a video to a topic merely because a keyword appears in its title.

## Reusable display components

- `VideoCard.astro` renders a thumbnail, platform, title, description, and external link.
- `VideoEmbed.astro` creates a lazy YouTube privacy-enhanced or Instagram embed from the reviewed platform URL and can expose transcript text or a transcript link.
- `RelatedVideos.astro` renders a labeled group of video cards and outputs nothing when its array is empty.
- `VideoMetadata.astro` displays the platform, video language, controlled content type, publication date, and transcript availability. Its labels and date-display locale come from the calling page.

All visitor-facing labels are component inputs. Future Chinese pages must provide reviewed Chinese interface copy rather than reuse machine-generated labels.

External embeds send requests to third-party platforms. Before using an embed publicly, review privacy behavior, regional availability, cookie behavior, consent requirements, and the page's loading cost. A normal external link remains the safest fallback.

## Platform rules

Video URLs must use HTTPS and match the declared platform. YouTube supports normal watch, short, live, embed, and `youtu.be` URLs. Instagram supports post, reel, and Instagram TV URL forms. Do not store redirect links, tracking links, unrelated profile links, or a URL from one platform under another platform label.

YouTube embeds use the privacy-enhanced `youtube-nocookie.com` host. This reduces initial YouTube cookie use but does not make an external embed private or remove the need for a regional privacy review. Instagram embeds use Instagram's official embed path. Neither platform is assumed to be available in every region.

## Creator profiles

Confirmed creator profiles belong in the initially empty `src/data/creator-profiles.ts` registry. Each record has a stable ID, creator ID, YouTube or Instagram platform, HTTPS profile URL, reviewed public label, and publishing status. Validation rejects duplicate platform profiles and video/post URLs entered as creator profiles.

`CreatorProfiles.astro` can later render a small labeled profile-link section. It outputs nothing when no confirmed profiles are supplied. `creatorProfileUrls` prepares confirmed profile URLs for a future Person `sameAs` field. Do not add these links to About Jeff, the homepage, navigation, or structured data until Jeff confirms ownership and the exact public URLs.

Social profiles support the website; they do not replace the website's Wuyishan knowledge structure.

## English descriptions

Write a video title and description for an English-speaking visitor, not as a literal translation of a Chinese platform caption. State what the video explains or shows and how it connects with Wuyishan. Keep the wording factual and specific.

Do not use engagement language, keyword stuffing, unsupported superlatives, or social-platform clichés. Do not claim that a video proves a relationship merely because a place or topic appears briefly. A translated transcript or English summary must be reviewed as English writing before publication; never publish machine-generated wording merely to fill a field.

## SEO and social metadata

`videoRecordSchema` converts a reviewed record into `VideoObject` data with its public platform URL, privacy-aware embed URL, description, absolute thumbnail URL, publication date, language, and text transcript when available. Use it only on a public page where the video is a meaningful part of the page.

`getVideoSocialMetadata` resolves the video title, description, image, and language for a future page to pass into `BaseLayout`. The thumbnail remains the default social image unless reviewed social overrides exist. No metadata is generated from an empty record.

`BaseLayout` accepts the Open Graph type `video.other` for a future dedicated video page. A normal article or place page containing a related video should keep its own page-level Open Graph type.

## Future publishing workflow

1. Confirm the platform URL and publication permission.
2. Use `npm run content:new` to add an automatically discovered draft with reviewed metadata.
3. Add only confirmed relationship IDs.
4. Supply a publishable thumbnail with accurate dimensions and alt text.
5. Add a transcript or caption file only after it has been reviewed in its stated language.
6. Run the build and relationship validation.
7. Render the video from an existing page or a future reviewed video route.
8. Check keyboard access, iframe title, mobile sizing, privacy behavior, structured data, and social preview before publishing.
