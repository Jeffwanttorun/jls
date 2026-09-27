# Performance Audit

Originally measured on July 12, 2026, and rechecked against a clean static build on July 13, 2026. The “before” values came from the production deployment immediately before the original audit. The “after” values reflect the current build.

| Metric | Before | After | Result |
| --- | ---: | ---: | --- |
| Raw shared CSS | 19,085 B | 18,439 B | 646 B smaller |
| Compressed shared CSS | 4,735 B | 4,589 B | 146 B smaller |
| Home HTML, compressed | 2,830 B | 3,223 B | 393 B larger due to responsive-image metadata, structured data, and mobile-menu accessibility code |
| Wuyishan Guide HTML, compressed | — | 3,441 B | Static article output including metadata and structured data |
| Client JavaScript files | 0 B | 0 B | No bundle or hydration added |
| Inline navigation script | 0 B | 553 B maximum per page | Added only for menu labels, Escape-to-close, and `aria-expanded` synchronization |
| Mobile river hero candidate | 136,842 B | 63,767 B | 53% smaller |
| Mobile tea image candidate | 272,778 B | 121,349 B | 56% smaller |

## Implementation notes

- Hero images retain eager loading, `fetchpriority="high"`, explicit dimensions, and async decoding.
- Mobile visitors receive 640px or 960px image candidates through `srcset` and `sizes`.
- Below-the-fold and directory images remain lazy-loaded.
- The site uses system fonts, so there are no font files, font requests, or `font-display` delays.
- Astro renders static HTML. No component hydration or client framework bundle is shipped.
- Reduced-motion preferences disable smooth scrolling.

## Core Web Vitals risk review

- **LCP:** responsive hero candidates reduce mobile transfer size while preserving high loading priority.
- **CLS:** content images have explicit width and height; hero and gallery containers have stable dimensions.
- **INP:** there is no hydrated application runtime. The only interaction code is the small navigation enhancement.

A local Lighthouse executable and compatible Chrome binary were not present, and the PageSpeed Insights endpoint returned a quota error during the July 13 recheck. This project deliberately does not install Lighthouse or a browser as permanent dependencies. No synthetic score is recorded. The figures above are directly measured build output and image sizes; responsive behavior, accessible navigation state, and console output were also checked in a real browser.
