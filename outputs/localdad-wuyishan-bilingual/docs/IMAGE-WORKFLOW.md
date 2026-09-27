# Image Asset Workflow

## Purpose

New photography uses one managed record per original image. The record keeps descriptive, rights, date, relationship, and dimension metadata together. Optimized files are generated from that record's original; they are not prepared by hand.

Existing public images remain on the legacy path until Jeff supplies reviewed replacements. Do not migrate or rename them during unrelated work.

## Prepare an image

1. Rename the original with a unique, lowercase English filename using hyphens.
2. Put it in `media/originals/`.
3. Confirm who took it and whether the website has permission to publish it.
4. Run:

```bash
npm run image:prepare -- \
  --file original-filename.jpg \
  --id stable-image-id \
  --alt "A factual description of what the image shows" \
  --copyright-status owned
```

Accepted rights values are `owned`, `licensed`, `permission-granted`, `public-domain`, and `unconfirmed`. An image with `unconfirmed` rights may remain a draft but cannot be published.

Optional flags are `--caption`, `--source`, `--credit`, `--photographer`, `--photo-location`, `--photo-date`, `--related-place`, `--related-places`, `--related-topics`, `--related-articles`, and `--related-videos`. `source` records where an image came from; `credit` records the public attribution wording. Keep them separate. Use `relatedPlaceId` for the primary photographed place and `relatedPlaceIds` for any additional place relationships. Relationship lists use comma-separated stable IDs. Related articles use `type:id`, where type is `knowledge`, `route`, or `story`. The legacy `captureDate` field remains supported for existing records, but new records should use `photoDate`.

The command refuses to overwrite an image ID or reuse an original filename. It generates responsive JPEG, WebP, and AVIF variants at suitable widths under `public/images/library/<image-id>/`, then writes one draft metadata record to `src/data/image-sources/<image-id>.json`.

## Validate images

Run:

```bash
npm run image:check
```

This checks:

- missing or empty alt text;
- unreadable or mismatched pixel dimensions;
- missing generated variants;
- variants whose recorded format, dimensions, or byte size do not match the file;
- originals over 30 MB and public files over 2 MB;
- duplicate managed IDs, original filenames, and public filenames;
- unconfirmed rights on a published image;
- invalid relationship IDs through the shared content registry during the full build.

`npm run build` runs this image validation automatically before Astro builds the site.
Managed image drafts also appear in `npm run content:status`, alongside other content assets.

## Render a managed image

`ManagedImage.astro` accepts a validated image record and emits an AVIF source, a WebP source, responsive JPEG fallback, explicit width and height, lazy loading by default, and the reviewed caption, credit, and source. Set `loading="eager"` and `priority={true}` only for an image visible at the top of the page.

Do not publish an image merely because optimization succeeds. Rights, alt text, caption, identity, and relationships still require editorial review.
