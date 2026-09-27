# Pillar Page Architecture

The future public hierarchy is defined in `src/data/pillars.ts`:

1. Why Wuyishan
2. Explore Wuyishan
3. Stories of Wuyishan
4. About Jeff

Each definition records a stable pillar ID, public label, editorial purpose, and the content systems that supply its sections.

`src/layouts/PillarLayout.astro` is the reusable shell for pillar pages. `src/components/PillarSection.astro` provides consistent sections with optional real links and clearly labeled future direction. Empty link arrays render no empty directory or card area.

The public architecture now uses:

- `/why-wuyishan`
- `/explore-wuyishan`
- `/stories-of-wuyishan`
- `/about`

The first three routes may explain their intended scope before every future content type has entries, but they must not invent examples, expose empty child routes, or render empty content grids. Links must point only to existing public pages.

Existing guide, location, family, tea, and article URLs remain in place. The pillar pages organize them rather than replacing them.
