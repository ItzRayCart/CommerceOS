# CommerceOS implementation checklist

Status as of 2026-10-03: foundation, authentication, storefront Batches A/B/C and checkout/orders have implementation and test coverage. Full Phase 0–3 and global release gates remain open until every required check passes. Checkout evidence and its acceptance mapping are in docs/CHECKOUT_REVIEW.md. Source: CommerceOS Engineering Specification v1.0, September 2026, especially Sections 0–12 and Appendix A. The specification's MUST and SHOULD scope remains in force; COULD work follows completed MUST/SHOULD work.

## Rules for every phase

- [ ] Work in Section 12 order. Keep the repository runnable at each commit; use a phase branch, Conventional Commits, and a phase completion tag after its exit gate passes.
- [ ] Keep TypeScript strict in `apps/api`, `apps/web`, and `packages/shared`; satisfy Section 9 naming, formatting, layering, and import rules.
- [ ] For every new endpoint: strict Zod body/query/params validation, typed DTO mapping, standard success/error envelope, request ID, OpenAPI request/response/error schemas, and integration coverage.
- [ ] For every business rule BR-01 through BR-15: at least one unit test; add integration and concurrency tests where the rule crosses documents or requests.
- [ ] For every data screen: API-backed data, pagination for lists, skeleton loading, useful empty state, retryable error state, keyboard support, responsive layout, and URL-synced filters where specified.
- [ ] Protect secrets and customer data: router-level admin authorization, ownership checks, no raw Mongoose responses, input sanitization, structured redacted logging.
- [ ] Before exiting a phase: lint, typecheck/build, relevant unit/integration/E2E tests and coverage gate pass; OpenAPI and README are current; seed remains usable; no dead code or untracked TODOs.
- [ ] Append a dated `DECISIONS.md` phase report with shipped scope, deviations, and deferrals. Defer only COULD items. Tag only after the actual exit gate is met.

## Phase 0 — Foundation (Section 12)

Implementation sequence requested by the project owner:

- [x] Establish npm workspaces at root for `apps/api`, `apps/web`, `packages/shared`; root scripts and lockfile (commit pending phase exit).
- [x] Scaffold the Angular standalone app with storefront/admin lazy shells, initial design tokens, and typed `ApiClient`.
- [x] Scaffold Express 4 API with `createApp()` separate from the listener, `/api/v1` routing, and module layout.
- [x] Set `strict: true` in all three TypeScript projects; configure path aliases, ESLint and Prettier per Section 9.
- [x] Add the Mongoose 8 connection and graceful shutdown code for MongoDB 7 replica set operation.
- [x] Add dependency-free shared enums and DTO interfaces; wire package imports.
- [x] Validate environment with Zod at boot; provide `.env.example`, `.nvmrc`, and no embedded secrets or URLs.
- [x] Add Pino/Pino HTTP structured logging, redaction, and correlation/request ID middleware.
- [x] Add `AppError` hierarchy, standard error handler, not-found handler, Zod `validate`, `asyncHandler`, and pagination helper.
- [x] Add Dockerfiles, nginx configuration, Docker Compose single-node `rs0` for mongo/api/web. Live startup and seed wiring remain to be verified/completed in the phase exit gate.
- [x] Add `/health` with DB ping, OpenAPI 3.1 and Swagger UI at `/api/docs`, one sample validated route with tests.
- [x] Add Husky, lint-staged, commitlint, GitHub Actions CI, root build/lint/format/test/dev/docker scripts, and initial documentation.
- [ ] Exit: clean `docker compose up` works, `/health` succeeds, `/api/docs` renders, sample route validation/tests pass, and CI lint/build/test passes.

## Phase 1 — Auth and users

- [x] Model users, refresh tokens, password resets, addresses, indexes, password policy, and hashed tokens.
- [x] Implement register/login/refresh/logout/me, forgot/reset password, profile/password/address endpoints, opaque refresh rotation and family reuse detection.
- [x] Enforce auth and rate limits; router-level admin RBAC; permission map; customer ownership/IDOR safeguards for the account resources that exist.
- [x] Build Angular auth/account pages, memory-only AuthStore, bootstrap refresh, single-flight retry interceptor, guards, and form states.
- [ ] Test AC-AUTH-01..07, applicable AC-RBAC-01..04, and E2E journeys 1 and 6. Track order ownership and admin-account mutations for the phases that create those resources (see dependencies below).
- [ ] Exit: Phase 1 endpoints and UI pass API/E2E gates; RBAC behavior implemented for the resources that exist.

## Phase 2 — Catalogue

- [ ] Model settings, categories, products, variants, visibility, unique SKU/slug rules, denormalized price/stock/rating fields, and required indexes.
- [x] Implement public settings/category/product/list/suggest/related endpoints with search relevance, allow-listed sort, filters, facets, and pagination.
- [x] Build idempotent catalogue seed: category tree, approximately 30 products, variant and stock cases, branded local images, descriptive copy, initial settings.
- [x] Build home, catalogue, search, category, and product pages with URL state, variant deep links, gallery, metadata, and responsive states.
- [ ] Test AC-CAT-01..06, AC-PDP-01..03, BR-08/12/15, index-backed `explain()` without COLLSCAN, and Home/PDP Lighthouse targets.
- [ ] Exit: all catalogue/PDP criteria pass, `explain()` gate passes, desktop Lighthouse Performance/Accessibility/Best Practices >= 90 on Home and PDP.

## Phase 3 — Cart and wishlist

- [x] Model server carts and wishlists; implement guest `/cart/price`, cart item/merge/discount endpoints and wishlist endpoints.
- [x] Reprice from database on read; report stock and price changes; cap quantities to stock and 10; keep guest cart local and merge on sign-in.
- [x] Build CartStore, WishlistStore, cart drawer/page, coupon UI, wishlist page, and live header counts.
- [ ] Test AC-CART-01..04, AC-WISH-01, BR-02/09, guest-to-user merge and unavailable-line behavior.
- [ ] Exit: cart and wishlist acceptance and tests pass.

## Phase 4 — Checkout and orders

- [x] Implement shipping, tax and discount calculations with integer minor units and one half-up tax rounding; cover every BR-07 failure reason.
- [x] Implement quote, order placement, idempotency, atomic conditional stock changes, stock movement audit, snapshots, counters, discount redemption, stats and cart clearing in transactions.
- [x] Add mock card tokenization/provider, COD, MailProvider/local transport, customer history/detail/cancel, and order confirmation.
- [x] Build four-step checkout, success page, order history/detail and status timeline.
- [x] Test AC-CHK-01..08, AC-ORD-01, AC-DISC-01..04, BR-01..07/14, failure rollback, concurrent last-unit orders, and E2E journeys 2 and 3.
- [ ] Exit: all Phase 4 criteria and required global gates pass. COD mark-paid backend is tested now; the full admin sales UI and E2E journey 4 remain Phase 6 work. Do not tag or claim earlier/global phase gates complete.

## Phase 5 — Admin catalogue

- [ ] Build admin shell, category CRUD, product list/create/edit/duplicate/archive/delete and variant matrix editor.
- [ ] Add upload storage provider, MIME/magic-byte/size checks, image ordering/primary/alt text, and stock adjustment/movement history.
- [ ] Build inventory filters and low-stock handling with atomic updates.
- [ ] Test AC-ADMP-01..04, AC-INV-01..02, relevant BR-11/12/14, and E2E journey 5.
- [ ] Exit: admin catalogue and inventory gates pass. AC-INV-02 dashboard panel is finished with Phase 7; inventory-side behavior passes here.

## Phase 6 — Admin sales

- [ ] Implement admin orders list/detail/status transitions, shipping, refund/restock, internal notes, customers list/detail/status/role changes, discount code administration.
- [ ] Enforce state machine, self/last-admin protection, ownership policy and transactional side effects.
- [ ] Build admin orders/customers/discount pages with URL-backed filters, counts, forms, and legal action controls.
- [ ] Test AC-ADMO-01..04, AC-ADMC-01, discount admin behavior, delayed AC-CHK-06 and AC-RBAC-03/04, and E2E journey 4.
- [ ] Exit: admin sales criteria and cross-phase acceptance items pass.

## Phase 7 — Insight and settings

- [ ] Implement dashboard and analytics aggregation pipelines, indexed time series, KPIs/deltas, category/product/customer/discount metrics, and filtered CSV exports.
- [ ] Implement full settings edit/public projection, runtime CSS theme, store identity, currency/tax/shipping behavior and feature toggles.
- [ ] Complete idempotent seed with approximately 40 customers, 120 coherent historical orders, 40 reviews, all specified discount states, and audit/aggregate consistency.
- [ ] Build dashboard, analytics and settings pages; include low-stock dashboard panel.
- [ ] Test AC-DASH-01..02, AC-ANA-01..02, AC-SET-01..02 and delayed AC-INV-02.
- [ ] Exit: insight/settings gates pass against the full seed.

## Phase 8 — Polish and release

- [ ] Implement SHOULD reviews and moderation, including verified purchase rule, rating aggregates, PDP display and admin hide/unhide.
- [ ] Audit every page for accessible keyboard operation, focus, reduced motion, 360/768/1024/1440 px layouts, and loading/empty/error/retry behavior.
- [ ] Complete SEO, image optimization, security headers/CSP, sanitization, upload protection, rate limits, logging redaction, p95 latency and index review.
- [ ] Complete README, DECISIONS, OpenAPI catalogue, E2E journeys, coverage, `npm audit --omit=dev`, and Docker/local clean-clone checks.
- [ ] Exit: every Section 10 feature criterion and G1-G10 passes; all MUST and SHOULD work complete; tag `v1.0.0`.

## Cross-phase dependencies and gate conflicts

1. Each numbered phase depends on the previous phase's runnable/tested foundation. Phase 0 must establish transactional MongoDB before order work; shared DTOs, validation, logging, error handling and OpenAPI conventions precede domain endpoints.
2. Auth (1) enables authenticated cart (3), checkout (4), customer/admin routes (5-7). Catalogue (2) supplies cart product/variant references (3); cart and settings supply checkout quote/order inputs (4).
3. Order history, status changes and stock movements (4) supply admin sales (6), customer metrics and analytics (7), and verified reviews (8). Product/category CRUD (5) affects storefront visibility (2) and inventory/analytics (7).
4. Phase 1 names all `AC-RBAC-*`, but AC-RBAC-03 requires orders built in Phase 4 and AC-RBAC-04 requires admin customer mutations built in Phase 6. Preserve these criteria; test the policy where possible in Phase 1 and complete the resource-specific tests when those resources exist.
5. Phase 4 names all `AC-CHK-*`, but AC-CHK-06 requires the admin mark-paid action listed in Phase 6. Finish its order/payment behavior in Phase 4 and its end-to-end admin assertion in Phase 6.
6. Phase 5 names all `AC-INV-*`, but AC-INV-02 requires the low-stock dashboard panel listed in Phase 7. Finish the inventory view in Phase 5 and the dashboard assertion in Phase 7.
7. Phase 2 requires Home/PDP Lighthouse >= 90 before Phase 8's full performance pass. Treat the earlier score as a real gate and repeat it at release.

## Risks and specification tensions to verify during implementation

- Strict unknown-field rejection (Sections 8.1/9.2) conflicts with AC-AUTH-01's supplied `role: admin` and AC-CHK-05's tampered prices/totals being ignored. Use explicit compatibility fields that are accepted then discarded, while all other unknown fields remain rejected; test both security and acceptance behavior.
- Section 5.7 places payment charge inside a MongoDB transaction. The mock provider can follow this exactly, but a future real provider could charge before a transaction aborts; do not imply real-payment atomicity in the provider contract.
- Card test numbers appear in acceptance journeys, while Section 5.4 forbids PAN/CVC reaching API/database. The browser-side mock tokenization boundary must be demonstrated by network and log tests.
- Section 4.4 asks for a unique multikey index on `variants.sku`. Verify MongoDB uniqueness behavior for duplicate SKUs within a single product as well as across documents; enforce both in validation and tests.
- Sections 4.4 and 5.7 require denormalized `totalStock`/`minPrice` consistency. Atomic stock updates, variant edits, refunds and seeding must update these values within the relevant transaction.
- Settings-driven brand and prices require a usable default settings document before catalogue and checkout flows; Docker seed/bootstrap must be idempotent.
- Phase tags, phase branches, Docker CI, replica-set memory tests, browser E2E and Lighthouse require working external runtimes. Validate these gates explicitly; do not mark a phase complete merely because code builds.
