# Place source files

Future place facts use one JSON file per stable place ID. Files in this folder are discovered automatically; no TypeScript registry edit is required. Localized narratives live under `src/content/locations/<place-id>/` and share the JSON record's `slug` through `recordKey`.

Only the authoring command should create a new source file. New records start as drafts and cannot create a public page until their facts, narrative, relationships, images, and publication date pass validation.
