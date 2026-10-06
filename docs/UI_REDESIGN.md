# CommerceOS UI redesign - 2026-10-06

The existing design brief remains authoritative: restrained, product-first, dynamic store branding, Angular/Express/MongoDB, keyboard access and responsive layouts. No commerce or administration features were removed.

## Store research

These are design assessments of published pages, not user-study or conversion-rate claims. Live browser reference inspection was unavailable; research used the official published page content.

| Reference                                  | Useful pattern                                                                                                          | Tradeoff to improve on in CommerceOS                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Apple Store](https://www.apple.com/store) | Recognisable category navigation, distinct new-product/accessory sections, product/price information together.          | Numerous offer/finance/support sections increase page length and compete with shopping; keep CommerceOS discovery focused.                         |
| [Bellroy](https://bellroy.com/)            | Navigation by activity (work/travel/outdoor) alongside products, specific merchandising stories and product categories. | Many parallel category/activity/collection entry points increase choice density; keep a single readable category row and focused product sections. |
| [Nothing](https://nothing.tech/)           | Strong product naming, concise product-led campaigns and an identifiable visual voice.                                  | Promotional presentation needs clear shopping context; keep price, stock, variant selection and the purchase action easy to locate.                |

## Implementation

- Two-row desktop header separates search/account/cart from category navigation. Mobile retains search and labelled icon controls; the category menu supports Escape. Consistent SVG icons replace mixed text symbols.
- Light editorial home hero with a real featured-product image, name and price; sharper hierarchy and quieter merchandising/category cards.
- Locally hosted Inter/Space Grotesk WOFF2 with SIL OFL licenses, font-display swap and system fallbacks. Latin subsets total approximately 191 KB; no runtime font service or new app dependency.
- Shared control typography, spacing, textarea treatment, focus and checked states. Product variants make the current choice clear; cart/checkout retain server pricing and existing payment/session behavior.
- Authentication cards, account panels, admin sidebar/tables/KPIs/dialogs and save bars share the same visual language.
- Scoped styles extracted into SCSS files to keep Angular component logic readable. CSS colours reference tokens and settings; no brand name is hardcoded in UI components.

## Verification

Run npm run lint, npm run build, npm test and npm run test:e2e. The browser runner gives customer/admin/UI suites fresh APIs and replica sets with cleaned project-local scratch directories. UI tests capture Home/Catalogue/Product/Register desktop/mobile images, check overflow at 360/768/1024/1440 px, exercise guest cart and API-error Retry, and reject Angular runtime errors.

The UI revamp does not close unverified Docker, Lighthouse or full release gates. See IMPLEMENTATION_CHECKLIST.md and ADMIN_REVIEW.md.

Verification results: lint and production build passed; 17 Angular tests and four real-browser workflows passed during the redesign review. Initial application bundle: 301.25 KB (below the unchanged 500 KB warning budget). Font downloads are separate, locally served assets. Visual review found and fixed mobile cart grid overflow, kept text hover contrast, and uses muted text rather than low-contrast brass for small labels. Product descriptions render through Angular's normal HTML sanitizer without bypassing it.

Visual review also caught retained scroll position on new pages. Imperative pathname changes now reset to the top; query-only variant/filter changes preserve position and native browser back/forward restoration remains enabled. A real guest-cart regression checks both behaviors.
