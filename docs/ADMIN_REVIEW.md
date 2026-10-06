# Admin implementation and review

Date: 2026-10-04. Source: CommerceOS Engineering Specification, Sections 3-5, API/BR rules and Section 10 acceptance criteria. The confidential PDF stays outside the public repository.

## Delivered blocks and evidence

| Area                              | Implementation and verification                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard, AC-DASH-01/02          | Revenue from paid/shipped/completed orders, all-order count, new customers, paid-order AOV; equal-length previous-period comparisons; UTC 30/90-day SVG revenue chart, status distribution, top products, recent orders, low stock and inventory summary. Integration tests compare known sale totals.                                                                      |
| Products, AC-ADMP-01..04          | Create/edit/duplicate/archive/delete, strict fields, SKU/slug conflicts, HTML allowlist, options/matrix, stable IDs, specification/SEO/media ordering/primary/alt, publish validation. Browser creates six variants, uploads three images, publishes and buys the persisted product.                                                                                        |
| Categories                        | CRUD, explicit slug editing, two-level hierarchy, transactional parent/product fences, conflicts for deleting categories with products/children. Integration tests cover depth, deletion and slug changes.                                                                                                                                                                  |
| Uploads, BR-11/12                 | Admin-only multipart endpoint, 10-file/5-MB limits, extension/MIME/magic-byte checks, UUID local storage abstraction, no SVG/HTML uploads, nosniff and public upload proxy. Tests cover genuine PNG, spoofed executable and oversized files.                                                                                                                                |
| Inventory, AC-INV-01/02, BR-14    | Paginated SKU search, low/out filters, atomic nonnegative adjustments and movement entries, stock history and dashboard low-stock links. Concurrent decrements have one winner; stale editor cannot overwrite adjusted stock/audits.                                                                                                                                        |
| Orders, AC-ADMO-01..04            | Search/date/status filters with counts, details/customer/totals/snapshots, append-only internal notes, legal payment/shipping/completion/cancellation/refund controls and confirmations. Tests cover COD sequence, invalid transitions, private notes, refund and once-only restock. Existing checkout suite covers transaction rollback, last-unit orders and idempotency. |
| Customers, AC-ADMC-01, AC-RBAC-04 | Search/name/email, joined/orders/spent sorting, profile/address/order history/LTV, role and active/disabled changes. Admin locking protects the last admin, including concurrent cross-demotions; self disable/demotion rejected, disabled customer access immediately rejected.                                                                                            |
| Discounts                         | CRUD, immutable code, percentage/fixed constraints, dates/scopes/usage limits, computed statuses and redemption totals. Historical redeemed codes cannot be recreated after deletion. Checkout revalidates discounts from MongoDB.                                                                                                                                          |
| Analytics, AC-ANA-01/02           | MongoDB match/group/dateTrunc/lookup pipelines for revenue/orders/AOV, product revenue/units, categories, new/returning customers and discount usage. Date/granularity/sort filters, paginated metric tables, filtered order/product CSV with formula-safe escaping.                                                                                                        |
| Settings, AC-SET-01/02            | Database store identity/contact/logo, currency code/symbol/decimals, tax, shipping methods, stock threshold, colours, prefix and feature flags. Browser changes HALDEN to Northline and verifies the storefront CSS theme. Historical orders retain snapshots. Payment/email/storage provider abstractions remain intact.                                                   |
| RBAC and validation, BR-15        | Router-level authentication/admin authorization before request processing, explicit shared DTOs, strict Zod inputs and endpoint-specific query allowlists. All admin route identities are enumerated for 401/403 tests. Unknown fields/operators, malformed IDs and pagination are rejected.                                                                                |

## Confirmed issues fixed during review

- Multi-variant transactional movement creation needed ordered insertion under Mongoose.
- Partial Zod schemas inherited defaults and could reset fields during a patch; defaults are explicitly removed from optional patch fields.
- Mongoose nested SEO needed explicit DTO mapping rather than object spread.
- Full product and individual variant edits now reject stale updatedAt revisions, preserving concurrently sold/adjusted stock.
- Category editing queried only the first page; it now looks up the target ID directly and returns 404 when missing.
- Settings/product edit forms wait for initial data before enabling edits, preventing an initial response from overwriting changes. Settings success waits for the storefront refresh.
- Optional blank branding fields now agree across request and database validation; discarded theme previews restore saved settings.
- Product-card priority images also supplied loading, causing Angular NG02952 and incomplete rendering. Angular now controls loading automatically.
- Independent browser workflows shared the real authentication quota; each suite now starts a fresh API/replica set without weakening application limits.
- Async filtered lists now ignore superseded responses, duplicate mutation submissions are blocked, and stale success feedback clears on failure.
- Admin grids use minmax(0, 1fr) and panels can shrink; this fixes mobile overflow after deferred charts render. Layout tests wait for the chart and browser resizing to settle.
- Uploaded media is proxied by both development and Nginx servers. CSV cells escape formula prefixes. API docs use explicit error refs and no YAML alias explosion.

## Verification

- `npm run lint`: passed with unchanged rules.
- `npm run build`: passed; initial Angular bundle 292.51 kB, estimated transfer 82.96 kB. Admin routes are lazy.
- `npm test`: 75 API tests / 9 suites and 17 Angular tests / 6 suites passed. API line coverage 90.99%; new admin services exceed 80% line coverage. No coverage threshold lowered.
- `npm audit --omit=dev`: zero production vulnerabilities.
- OpenAPI parsed with default YAML protections; all local schema refs resolve (61 paths).
- Browser workflows: all three passed. Customer discover/purchase/order and declined-card/COD/cancellation; Admin create/stock/sell/fulfil/analyse, saved brand/theme and 360/768/1024/1440 px dashboard checks.
- Full demo seed integration: 40 customers, 120 dated orders, ten child categories, two draft products and one archived product; coherent totals/history, stock movements sum to stock, no negative inventory, idempotent rerun and customer lifetime statistics.

## Optimization and remaining release gates

OnPush/lazy admin components, SVG charts, parallel independent dashboard queries, aggregation rather than client-calculated totals, paginated lists/CSV batches, request race protection and optimized image loading keep the app responsive. This is not a measured p95 or Lighthouse claim.

Docker CLI is unavailable on this machine, so container build/start and clean-clone verification remain unverified. Full Lighthouse, a11y audit, query-plan/p95 benchmarks, complete review seed and the Phase 8 reviews/moderation module remain open specification gates in IMPLEMENTATION_CHECKLIST.md. The four requested admin blocks are implemented; these notes do not declare every release requirement complete.

Payments use the specified mock provider/COD. A future real payment provider needs provider idempotency/compensation around MongoDB transaction retries; external money transfers cannot join a database transaction. Currency changes are denomination/display changes, not FX conversion. No commits, pushes or release tags are created.

Browser suite scratch directories live under ignored `node_modules/.cache/commerceos-e2e` and are removed after each suite. This avoids leaked temporary MongoDB data exhausting the system drive on Windows.
