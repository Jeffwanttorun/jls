# Bilingual Map Architecture

## Technology choice

The future interactive map uses Leaflet. For a planned library of dozens or a few hundred places, Leaflet provides markers, polylines, bounds, popups, and filter interaction with a smaller client footprint and simpler maintenance than a full vector-map framework.

Leaflet is the interface library, not the map-data or tile provider. `MapExplorer` requires an explicit tile URL and attribution. Do not publish the map until a tile service has been reviewed for licensing, usage limits, privacy, performance, and accessibility from the intended regions. The project does not assume that the public OpenStreetMap tile server is an unrestricted production service.

Every coordinate explicitly records its coordinate system. The Leaflet dataset currently requires WGS84. A future provider using GCJ-02 or BD-09 needs a reviewed conversion layer; never mix coordinate systems or relabel converted coordinates without verification.

## Shared data model

There is one location database in `src/data/locations/`. Coordinates, categories, heritage topic IDs, route relationships, story relationships, and video relationships are language-independent and stored once.

Existing English fields remain the primary content. The optional `localizations` object in the same record can hold a reviewed Chinese summary and language-specific practical-information rows. A missing Chinese value remains missing; the system does not translate or invent it.

`buildMapDataset` converts the shared records into an English or Chinese map view. It receives an explicit routing mode, so the same data can support the current unprefixed English URLs or a future `/en/` and `/zh/` structure without duplicating the location database. A Chinese view may use a verified Chinese place name while reporting `translationStatus: partial` if its Chinese summary is unavailable.

## Content network

`buildPlaceContentNetwork` is the shared connection point between a map marker and its place record, controlled topics, routes, stories, and registered videos. It uses stable IDs for topics and internal references. Central video relationships can add a video to a place without copying the video record into the location file.

The unified site content registry validates targets and provides reverse lookup for places, topics, routes, stories, people, and videos. The map adapter uses that registry to resolve stable IDs into locale-ready labels and URLs instead of maintaining a second relationship index.

The intended path is:

`map marker → place page → topics → routes → stories → videos`

## Map capabilities

`MapExplorer` is prepared for:

- circle markers for places with verified coordinates;
- controlled filters for Natural Heritage, Cultural Heritage, Tea Heritage, Living Heritage, Family, and Outdoor;
- verified route polylines;
- popups with localized names, summaries, and related content;
- related routes, stories, and videos;
- keyboard-operable filter buttons;
- a non-map list of place links as progressive fallback;
- multiple instances with caller-supplied UI labels.

Heritage filters are derived from controlled topic IDs. Family and Outdoor require explicit `mapExperienceFilters` on a verified location record; the system never infers them from prose or audience labels.

`ExploreMapSection` is the future section wrapper. `MapFilterControls` supplies keyboard-operable filter buttons. Neither component creates a route or renders publicly by itself.

The component is not imported by a public page, so it adds no map JavaScript or CSS to the current production pages.

## Mobile, keyboard, and loading behavior

Leaflet loads through a dynamic import only when the map approaches the viewport. The list fallback remains normal HTML and is available before JavaScript loads. Scroll-wheel zoom is disabled. On coarse-pointer devices, drag and pinch interaction begin disabled so the map does not trap page scrolling; a labeled button enables map gestures and moves focus to the map. Filters use native buttons and `aria-pressed`, and the map region has a keyboard focus target and accessible label.

Before publication, test real devices with VoiceOver and TalkBack. Leaflet's canvas and marker behavior does not replace the linked list fallback for screen-reader navigation.

## Routes

Verified route geometry belongs in the initially empty `src/data/map-routes.ts` registry. A route needs a stable ID, localized names when available, at least two verified coordinates, existing related-place IDs, and optional heritage topics. Validation rejects duplicate route IDs, incomplete geometry, and unknown place IDs.

## Language switching

The map receives a locale and a fully resolved dataset. A future language control should rebuild or replace the dataset rather than maintain separate map databases. UI labels and filter labels must be supplied from reviewed interface copy; the component does not generate translations. Do not expose `/en/` or `/zh/` links until those public destinations exist.

Do not add a public language switch until corresponding Chinese routes and enough reviewed Chinese place content exist.

## Publishing boundary

No public map page or navigation link exists. Before publication, confirm:

- every marker and route coordinate;
- every Chinese name and Chinese summary;
- tile-provider terms and attribution;
- mobile performance with the real dataset;
- whether Chinese location detail URLs are ready;
- map keyboard, screen-reader, and reduced-motion behavior in a rendered page.
