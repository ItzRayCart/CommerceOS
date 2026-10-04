# Checkout and order adversarial review

Review date: 2026-10-03. Source of truth: the supplied engineering specification, especially Sections 4.7–4.9, 5.4–5.7, 6.4, 7.5 and 10.2. The confidential PDF is kept outside this repository.

## Implementation boundaries

The browser sends an address or owned saved-address ID, a shipping-method code, an optional server-generated quote fingerprint and a token-only payment object. The order consumes the authenticated user's MongoDB cart. It accepts and discards `price`, `prices`, `total` and `totals` solely for AC-CHK-05; every other unknown field is rejected. No client amount reaches pricing, payment charging or the order snapshot.

A read-only transaction gives each quote a coherent snapshot. Placement reloads the cart, user, products, active categories, settings and discount inside a snapshot transaction. Cart version writes serialize submissions for one cart. Conditional variant updates prevent negative stock. Settings/category writes prevent a concurrent configuration/visibility edit from being silently missed; this deliberately favors correctness over maximum checkout throughput. Discount writes serialize global and per-user redemption checks. A unique user/key index and transactional annual counter protect submission and order-number uniqueness.

Mock payments are deterministic and have no external charge side effects, so transaction retries are safe. A real payment provider needs the separate compensation/idempotency design already recorded in DECISIONS.md. Email is emitted after commit and is best effort.

## Business rule review

| Rule  | Applicability and evidence                                                                                                                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-01 | Exact BigInt intermediate percentage/tax arithmetic, safe integer amounts, one half-up tax rounding. `money.test.ts` covers fractional tax rates, half cents, large values and invalid amounts.                            |
| BR-02 | Quote/order amounts come from MongoDB. Tampered price/total compatibility fields are discarded; arbitrary extra fields rejected. API integration and browser payload assertions cover this.                                |
| BR-03 | Conditional stock >= quantity updates and all-or-nothing transaction. Last-unit concurrency has one 201 and one 409 with available=0. Payment/persistence failures leave stock unchanged.                                  |
| BR-04 | Annual counter increment in the transaction; unique order-number index; concurrent successful orders have different numbers.                                                                                               |
| BR-05 | Item, address, shipping, discount and currency snapshots are mapped explicitly. Later product/address changes do not change order history.                                                                                 |
| BR-06 | Chosen active shipping, post-discount free threshold, untaxed shipping and exact tax. Express, standard, free threshold, zero eligible remainder and half-up cases tested.                                                 |
| BR-07 | All eight ordered failure reasons tested at placement; eligible-category/capped percentage/fixed limits, final global redemption race, and cancellation release tested.                                                    |
| BR-08 | Checkout rejects inactive products, categories/parents and variants through the shared visibility check; transaction fences visibility edits.                                                                              |
| BR-09 | Server-cart quantities must be integers 1–10 and fit stock. Duplicate persisted variants are rejected. Checkout requires a resolved guest merge. Existing cart tests cover quantity/availability flags.                    |
| BR-10 | Review writing is outside checkout scope. Order status/snapshots provide the future verified-purchase evidence; no review module was added.                                                                                |
| BR-11 | No user/product/category deletion endpoint was added. Order snapshots and product references are retained for later admin archive enforcement.                                                                             |
| BR-12 | Catalogue SKU/slug generation is unchanged. Order numbers have their own unique index; no checkout operation edits SKU or slug.                                                                                            |
| BR-13 | Existing authentication tests remain in the full suite; auth limits are preserved in E2E.                                                                                                                                  |
| BR-14 | Placement, cancellation and refund-restock movements are inserted in the same transaction as stock changes. Failure and concurrent cancellation tests prove rollback/no double restock. No audit mutation endpoint exists. |
| BR-15 | Existing product stock display remains unchanged; checkout reports insufficient quantities and prevents placement.                                                                                                         |

## Acceptance coverage

| Criterion    | Verification                                                                                                                                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-CHK-01    | Successful card order: paid status, stock decrement, cart clearing, confirmation mail invocation, browser success page/order number.                                                                                                                 |
| AC-CHK-02    | Declined/insufficient/invalid tokens return 402 with all transaction writes rolled back; browser decline can be corrected to COD.                                                                                                                    |
| AC-CHK-03    | Two users buying the last unit simultaneously: exactly one order, one movement, no negative stock.                                                                                                                                                   |
| AC-CHK-04    | Same-key concurrent/sequential/changed-payload retries return one order. Browser drops a successful response, then recovers the same order/key; history has one order.                                                                               |
| AC-CHK-05    | Tampered amounts have no authority; stored totals match the independently expected BR-06 calculation.                                                                                                                                                |
| AC-CHK-06    | COD is pending/unpaid. Protected admin status endpoint records paid/paidAt. Full admin sales UI and journey 4 remain Phase 6 work.                                                                                                                   |
| AC-CHK-07    | Concurrent pending cancellation restores stock/releases usage once; shipped/paid customer cancellation rejected; injected cancellation failure rolls back.                                                                                           |
| AC-CHK-08    | Product edits do not change original names/prices; address edits do not change original delivery details.                                                                                                                                            |
| AC-ORD-01    | 25-order fixture has correct newest-first pagination and metadata; browser history/detail show badges and timeline.                                                                                                                                  |
| AC-DISC-01   | 20,000 subtotal/10% code yields 2,000 discount; tax and selected shipping are computed by the backend.                                                                                                                                               |
| AC-DISC-02   | not_found/inactive/not_started/expired/min_subtotal/usage_limit/per_user_limit/not_applicable each return 422 with their reason.                                                                                                                     |
| AC-DISC-03   | Mixed-category eligibility excludes ineligible lines; percentage cap and fixed subtotal cap tested.                                                                                                                                                  |
| AC-DISC-04   | Pending cancellation deletes the redemption and decrements usedCount; code can be used again.                                                                                                                                                        |
| AC-RBAC-03   | Another user's detail/cancel returns 404, including for an owned saved-address reference on another user's checkout.                                                                                                                                 |
| AC-API-01/02 | Strict list pagination/status validation; explicit order DTO excludes hashes, __v, notes and submission keys; error envelopes/request IDs inherited.                                                                                                 |
| AC-SEC-01    | Unknown/raw-card fields rejected; existing NoSQL-operator middleware applies to all new routes.                                                                                                                                                      |
| AC-UI-01/02  | Reactive labelled forms, focus moved to step heading, disabled submission, retry states and address field feedback. Mobile journey runs at 360px and checks horizontal overflow. Full keyboard/screen-reader and Slow-3G release audits remain open. |
| AC-SET-02    | Free shipping is calculated from the post-discount subtotal using the selected active method.                                                                                                                                                        |

## Confirmed findings and fixes

- Concurrent cart add during checkout originally returned 500 when the cart disappeared between optimistic save attempts. The regression test reproduced it. Cart mutations now retry missing/version-conflicted documents and recreate the cart as needed, or return a bounded 409. Successful added quantity is either ordered or remains in the cart.
- Existing seed shipping was $12/$24 and omitted pickup. New seed settings now match the specification's $6/$18/$0. Normal seeding preserves existing merchant settings; reset only a disposable database to replace old defaults.
- Number multiplication could lose precision before discount truncation/tax rounding. BigInt intermediates and safe integer checks remove that risk.
- Changing the reviewed quote could otherwise charge a newly calculated amount without renewed review. The browser supplies a server-generated fingerprint; a mismatch returns QUOTE_CHANGED before stock/payment writes.
- After a lost success response, a new key could create a second purchase once the cart is refilled. The browser retains the exact key/token-only payload for uncertain outcomes and retries it, including across page reloads.
- A compound sparse index would still index historical rows with user present and key absent. A partial unique string-key index preserves optional historical idempotency fields while enforcing every submitted user/key.

## Test commands and limits

`npm run lint`, `npm run build`, `npm test`, `npm run test:e2e`, and `tsc -p e2e/tsconfig.json` verify the implementation. API tests use an actual disposable MongoDB replica set. Browser tests use the real Angular and Express apps with MongoDB, not mocked catalogue/order responses; only the deliberate lost-response test interrupts a committed HTTP response.

Latest local results: lint and production build passed; full API suite passed 54 tests with 88.4% line coverage and Angular passed 12 tests. The subsequent strengthened order suite passed all 31 tests, including mixed-category discounts and historical orders without submission keys. Both real-stack browser journeys passed (2/2): search/filter/sort → discounted card order → lost-response recovery, and mobile declined card → COD → cancellation. OpenAPI local references and the browser test TypeScript/lint checks passed.

Full Docker clean-clone verification, Lighthouse, broader release accessibility/performance auditing, the full admin sales UI, and real SMTP delivery are separate remaining gates. No phase completion tag or GitHub push is performed by the agent.
