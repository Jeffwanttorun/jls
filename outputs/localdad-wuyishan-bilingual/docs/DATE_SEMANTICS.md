# Date Semantics

The website uses three different date concepts. They must not be substituted for one another.

## Published

`published` is the date an article was first published editorially. If an article has no `updated` value, the page displays “Published.”

## Updated

`updated` is the date the page content was last meaningfully edited. A build, deployment, formatting-only operation, or cache refresh does not change this date. The page displays “Updated” only when this explicit metadata value exists.

The shared logic lives in `src/lib/dates.ts` and is used by visible article metadata and Article structured data.

## Personally checked

`lastPersonallyChecked` records the date Jeff personally checked a location or an article’s practical information on site. It is independent from publication and editing dates. It may be added only from Jeff’s direct confirmation. The field is optional in both location records and editorial content; when it is absent, article metadata does not show a field-check date.

The build validates that the `checked-on-location` trust status cannot be used without a `lastPersonallyChecked` date. Build and deployment dates are never converted into field-check dates.
