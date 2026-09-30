# CommerceOS Visual Design Brief

Source: CommerceOS Engineering Specification v1.0, Sections 1.2, 7.1-7.5, 9.3 and 10 (G10, AC-UI-*).
Audience: Codex (implementing agent). Follow this alongside the full specification. Where this brief is silent, the specification governs.

## 1. Design direction

Premium, restrained, product-first. Generous whitespace, large product imagery, sharp typography, subtle motion.

- The storefront and admin console share one Angular app and one design system.
- The admin console uses a **dark sidebar with a light content canvas**.
- The UI must feel like shipped client software: consistent tokens, no lorem ipsum, no placeholder buttons that do nothing.
- Reference brand is HALDEN (tagline: "Considered electronics"). Copy tone is confident, minimal and specific, with no hype words and no exclamation marks.

### Brand is data, not code

- Store name, tagline, logo, currency, tax, theme colours and feature toggles live in the `settings` collection and are editable in Admin > Settings.
- No component may hard-code "HALDEN" or any brand colour.
- Theme colours (`theme.primary`, `theme.accent`) are applied at runtime through CSS custom properties. The values below are only defaults.

## 2. Colour tokens

Define these as CSS custom properties on `:root`. Components use tokens only, never raw hex values.

| Token             | Default           | Usage                                        |
| ----------------- | ----------------- | -------------------------------------------- |
| `--color-ink`     | `#0E1116`         | Primary text, primary buttons, admin sidebar |
| `--color-accent`  | `#B08D57` (brass) | Highlights, badges, focus accents            |
| `--color-bg`      | `#FAFAF8`         | Page background                              |
| `--color-surface` | `#FFFFFF`         | Cards, panels, tables                        |
| `--color-muted`   | `#5B6470`         | Secondary text. Must keep >= 4.5:1 contrast  |
| `--color-border`  | `#E3E6EA`         | Dividers, inputs                             |

Status colours (order status badges, stock states, toasts):

| Status  | Hex       |
| ------- | --------- |
| Success | `#12805C` |
| Warning | `#B54708` |
| Danger  | `#B42318` |
| Info    | `#175CD3` |

Rules:

- Colour must never be the sole carrier of meaning. Pair status colours with an icon or text label.
- The overall look is near-black ink on warm off-white, with the brass accent used sparingly.

## 3. Typography

- **Display:** Sora or Space Grotesk.
- **UI / body:** Inter.
- **Fallback:** `system-ui` stack.
- Self-host fonts, or fall back gracefully when offline.
- **Scale:** 12 / 14 / 16 / 20 / 24 / 32 / 48 px.

## 4. Spacing, radius, elevation, motion

| Aspect         | Value                                                   |
| -------------- | ------------------------------------------------------- |
| Spacing        | 4 px base grid                                          |
| Radius         | 6 / 10 / 16 px. Cards 10 px, buttons 8 px, pills 999 px |
| Elevation      | Two shadow levels only                                  |
| Motion         | 150-250 ms ease-out (hover, drawers, toasts)            |
| Reduced motion | Honour `prefers-reduced-motion`                         |

## 5. Layout

### 5.1 Storefront (mobile-first)

Breakpoints: **480 / 768 / 1024 / 1280**. Touch targets >= 44 px. No horizontal scroll at 360 px width. The nav collapses to a menu drawer on mobile.

| Screen                 | Must contain                                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**               | Announcement bar (from settings), sticky header (logo, category mega-menu, search, account, wishlist, cart with live count), hero, featured rail, category tiles, new arrivals, best sellers, value props, footer with store contact            |
| **Catalogue**          | Left filter panel on desktop, bottom sheet on mobile. Active-filter chips, sort select, result count, grid/list toggle (COULD), pagination with page-size select, skeleton grid while loading                                                   |
| **Product page**       | Two-column layout on desktop, sticky purchase panel, variant chips/swatches, stock message, trust row, tabs for Description / Specs / Reviews, related rail, recently viewed (COULD)                                                            |
| **Cart drawer + page** | Line items with image, variant label, per-unit and line price, stepper, remove. Warnings (price changed, low stock, unavailable). Coupon input with inline error. Summary. Checkout button. Empty state with suggestions                        |
| **Checkout**           | Stepper (Address, Shipping, Payment, Review). Saved address picker plus new address form. Shipping method radio cards with ETA and price. Payment step (mock card form or COD). Review step with edit links. Sticky order summary. Success page |

### 5.2 Admin console

Dark sidebar (`--color-ink`) with a light content canvas. Admin feature components use the `adm-` selector prefix.

| Screen           | Must contain                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**    | KPI row, revenue chart with range switch, order-status donut, top products list, low-stock panel with quick-adjust, recent orders, inventory summary       |
| **Product form** | Sectioned form with sticky save bar, option builder plus generated variants table, drag-to-reorder image grid, live validation, preview-on-storefront link |
| **Order detail** | Header with status badge and available actions, items table, customer and address cards, payment card, vertical timeline, internal notes, ship modal       |

### 5.3 Route map

Public: `/`, `/shop`, `/shop/:categorySlug`, `/search?q=`, `/products/:slug`, `/cart`, and a branded 404 (`**`).

`authGuard`: `/wishlist`, `/checkout`, `/checkout/success/:orderNumber`, `/account`, `/account/addresses`, `/account/orders`, `/account/orders/:orderNumber`.

`guestGuard`: `/login`, `/register`, `/forgot-password`, `/reset-password/:token`.

`adminGuard`: `/admin`, `/admin/products` (+ `/new`, `/:id`), `/admin/inventory`, `/admin/categories`, `/admin/orders` (+ `/:id`), `/admin/customers` (+ `/:id`), `/admin/discounts`, `/admin/analytics`, `/admin/settings`.

## 6. Shared component inventory

Button, IconButton, TextField, Select, Checkbox, Radio/Chip group, Switch, Badge, StatusBadge, Card, ProductCard, PriceTag, RatingStars, QuantityStepper, VariantSelector, Gallery, Breadcrumbs, Tabs, Modal, Drawer, BottomSheet, ConfirmDialog, Toast, Tooltip, Skeleton, EmptyState, ErrorState, Pagination, DataTable (server-driven: sortable headers, pagination, row actions, empty/loading/error), FilterBar, FileUploader, KeyValueEditor, Stepper, StatCard, ChartCard, DateRangePicker.

## 7. UX rules for every screen

- **Three states, always:** loading (skeleton, not spinner-only), empty (helpful message plus action), error (message plus Retry).
- **Forms:** typed reactive forms, inline validation on blur/submit, server `details[]` mapped onto matching controls, submit buttons show progress and are disabled while pending, unsaved-changes guard on admin edit forms.
- **Feedback:** every mutation shows a toast. Destructive actions use a ConfirmDialog naming the item.
- **URLs are state:** catalogue filters, admin table filters/sort/page and tab selections sync to query params.
- **Formatting:** currency and dates via `Intl` using store settings. Relative dates with absolute tooltips in admin.
- **Accessibility (WCAG 2.1 AA):** semantic landmarks, visible focus rings, full keyboard operation (menus, dialogs with focus trap, gallery, filters), `aria-live` for cart count and toasts, alt text on all images, labels on all inputs.
- **Performance:** lazy routes, `NgOptimizedImage` with explicit sizes, `@defer` for below-the-fold rails and charts, initial bundle budget 500 kB (warning) / 700 kB (error) in `angular.json`, Lighthouse desktop >= 90 for Performance, Accessibility and Best Practices on Home and Product pages.
- **SEO basics:** per-route `<title>` and meta description, canonical URLs, semantic headings, Open Graph tags on product pages.
- **Images:** seed data ships its own generated SVG/WebP assets. Never hot-link remote images.

## 8. Frontend coding standards that affect design

- Standalone components, `ChangeDetectionStrategy.OnPush` (or zoneless), signals, `inject()`.
- Component-scoped SCSS using design tokens (CSS variables) only. No hard-coded colours or brand strings.
- Mobile-first media queries.
- Class names follow `block__element--modifier`.
- Selector prefix `app-`, admin prefix `adm-`.
- No inline styles. Every interactive element is a real `<button>` or `<a>`. Icon-only controls have `aria-label`.
- Components stay under ~300 lines. One component per file.

## 9. Design acceptance checks

- **G10:** no horizontal scroll and no overlapping UI at 360, 768, 1024 and 1440 px on both storefront and admin.
- **G9:** Lighthouse desktop on Home and a Product page: Performance, Accessibility and Best Practices all >= 90.
- **AC-SET-01:** changing store name, currency symbol, tax rate and theme colour updates the storefront header, price formatting, tax calculation and colours after refresh with no code change.
- **AC-UI-01:** a keyboard-only user can search, filter, add to cart and complete checkout, with visible focus that is trapped in dialogs and drawers.
- **AC-UI-02:** on Slow 3G the UI shows skeletons, never a blank screen. With the API down, every data view shows the error state with Retry.
