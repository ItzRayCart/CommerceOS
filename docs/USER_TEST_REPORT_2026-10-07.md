# CommerceOS: shopper and merchant usability review

Date: 2026-10-07 (Asia/Karachi). **This report was written after the baseline browser audit and before application fixes or folder moves.** Baseline evidence is retained in `docs/test-evidence/home-baseline.json` and screenshots in that directory. Implementation results will be appended after verification.

## 1. Method and limits

AI-led simulated personas used the real Angular UI, Express API and a disposable MongoDB replica set. This is a developer usability walkthrough and automated browser regression exercise, **not a study with recruited human participants**. Installed Chrome ran headlessly with its own temporary profile. No personal browser profile, development database, real payment, external email or desktop input was used. Test scratch databases are isolated and cleaned after each suite.

The baseline has 30 seeded active products, six featured products, mock payments and seeded sales counters. Such counters are demo data, not evidence of real market demand. Desktop/mobile widths: 360, 768, 1024 and 1440 px, height 960. Reduced motion was enabled to make layout measurements repeatable. Test setup costs and development-server timings are not production Lighthouse scores or a load-test SLA.

## 2. Multiple-store research

Official pages reviewed: [Apple Store](https://www.apple.com/store), [Bellroy](https://bellroy.com/), [Samsung US](https://www.samsung.com/us/), [Nothing](https://nothing.tech/). Reference analysis used published official page content. The assessments below are design judgments, not measured conversion-rate claims or reproduced usability failures on those companies' sites.

| Store   | Useful pattern                                                                                           | Tradeoff                                                                                     | CommerceOS application                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Apple   | Category navigation and distinct latest/accessory/support collections, with product information grouped. | Numerous offer, finance and support sections increase page length and compete for attention. | Short named merchandising rails, visible browse controls and clear product/price context.  |
| Bellroy | Bestsellers/new releases plus browsing by activity and collection.                                       | Parallel activity/category/collection navigation can increase choice density.                | Three explicit main collections and one category section, with simple View all links.      |
| Samsung | Product-family navigation and clearly separated promotional/product campaigns.                           | Many promotions can compete with the primary shopping task.                                  | One principal hero action; concise supporting copy and consistent collection controls.     |
| Nothing | Concise product naming and distinct campaign identity.                                                   | Brand presentation still needs obvious shopping context.                                     | Larger display text, fewer supporting words, and visible price/stock/purchase information. |

## 3. Persona tasks and results

### A. First-time visitor: discover something worth buying

Steps: open Home; inspect the merchandising headings and API totals; resize to all four widths; search for headphones; open Fold travel headphones; add it to the guest cart and open the cart.

Observed: guest discovery/search/product/cart worked. Home showed four of six featured items and four of 30 best-selling/new-arrival items. The three product grids did not overflow horizontally at any width; they had no horizontal browse controls. Home headings were The considered selection, Shop by category, New arrivals and Best sellers. Premium/Hot sections were absent. Headline sizes were 40 px at 360/768, 46.08 px at 1024, and 48 px at 1440.

Assessment: the layout is orderly but cannot support the requested horizontal browsing or complete collection exploration. Larger headlines and a shorter supporting sentence are a stated design preference, not a defect measured through user interviews.

### B. Merchant with a valid long model name

Setup: create a published test product using the authenticated admin API, with a 134-character valid name, one active zero-stock variant and one inactive stocked variant. Browse it through the public catalogue at 360 px.

Observed: page width grew to **1037 px** on a 360 px viewport; the title occupied **1013 px**. This is a confirmed responsive defect for valid product data.

Positive control: the In stock only API correctly excluded inventory held only by the inactive variant. The stock-filter hypothesis was **not** a bug and must not be weakened or rewritten to trust total stock indiscriminately.

### C. White-label merchant using a zero-decimal currency

Setup: save JPY with zero decimals in Admin Settings; reload the catalogue; enter Min=500; apply filters.

Observed: the UI submitted **minPrice=50000**, although the configured currency requires **500** minor units. The form assumes two decimals independently of settings. Server order pricing is unaffected; this bug misfilters catalogue discovery.

Additional boundary: clear Min, enter Max=0, apply. The maximum was omitted from the URL. A zero maximum was treated as empty because the numeric input returns the number 0 and the code used truthiness.

### D. Shopper during a partial service failure

Setup: fail only the featured-products request while letting new arrivals, best sellers and categories respond.

Observed: the whole Home switched to We could not load the store; **zero product cards remained visible**. Healthy responses could not help the shopper because one Promise.all rejection blocked the whole page.

Assessment: collection-local errors and Retry actions should preserve healthy sections. Total failure still needs a clear global error/retry state.

## 4. Prioritized findings and repair plan

| ID      | Priority   | Finding                                                                                | Proposed fix                                                                                                                                                                                           | Acceptance check                                                                                                                           |
| ------- | ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| UX-01   | High       | Required horizontal displays and Premium/Hot collections absent; four-item truncation. | Reusable native overflow/snap rail with touch/trackpad, previous/next, keyboard arrows/Home/End, disabled end controls, View all and paginated Load more.                                              | Every requested collection scrolls inside its region without horizontal document overflow; every eligible item is reachable.               |
| UX-02   | High       | JPY minimum multiplies by 100; zero maximum disappears.                                | Parse money into configured minor units; synchronize initial query controls after settings load; retain zero, reject excess precision/invalid ranges and disable price entry before currency is known. | Zero/two/three-decimal currencies, 0, invalid precision and initial deep links produce correct requests.                                   |
| UX-03   | High       | A valid long product title expands the mobile page.                                    | Constrain grid items and wrap titles/captions safely.                                                                                                                                                  | Long names remain within cards/PDP/home at all target widths.                                                                              |
| UX-04   | Medium     | One failed collection hides healthy home data.                                         | Independent collection states, local Retry and a global state only for total failure.                                                                                                                  | Partial failure preserves healthy rows; retry succeeds without fabricated data.                                                            |
| UX-05   | Medium     | Header and Home fetch categories twice.                                                | Deduplicate concurrent category requests, without a persistent cache that could hide admin edits.                                                                                                      | Initial Home makes one category request; later visits can fetch fresh data.                                                                |
| UX-06   | Design     | Major text can be stronger; supporting text is wordy.                                  | Larger responsive display headline, short supporting sentence, terse collection introductions, muted readable captions.                                                                                | Merchant tagline remains settings-driven, text wraps at 360 px and no artificial trust claims are added.                                   |
| REPO-01 | Structural | Core app code is under apps/web and apps/api despite the requested organization.       | Move to Frontend and Backend; preserve shared workspace and update npm lock/links, TS/Jest paths, E2E, Docker, environment loading, tools and docs.                                                    | Clean install/link graph, lint/build/tests/browser flows pass at new paths; old app-path references disappear from runnable configuration. |

## 5. Measurements and optimization boundaries

Baseline Home readiness: **2127 ms** in one development-server visit, including browser/Angular/font work. The three product-response completion times were about 539-540 ms in that visit. These single samples are descriptive and are not production p95 measurements.

Three product requests returned 12 product summaries; two category HTTP requests were made. Home product responses already omitted facets, so there is no confirmed unused-facet bug to claim fixed. Keep facets omitted on new home requests. Use bounded initial pages and lazy product images rather than downloading every product up front. Share only concurrent category requests, allowing fresh data after admin mutations.

Folder relocation is organizational, not a claim of faster runtime. npm workspaces, Angular, Express, strict TypeScript, MongoDB, shared DTOs and the existing security/transaction rules must remain intact.

## 6. Collection definitions planned before implementation

- **Premium:** active products selected through the existing featured flag (merchant curation). No claim that a particular price automatically proves quality.
- **Hot:** active products listed in the last 30 days, with recorded ordered units and an available active variant. Order by newest listing; this is not a fabricated live-viewer count or a promise of recent paid-sales ranking.
- **Best Selling:** active products with positive recorded ordered units, ordered by soldCount descending. Pending COD and restock/cancellation semantics follow the existing counter implementation; do not present it as paid revenue.

The server will enforce these predicates. Existing demo fixtures use seeded counters; production uses the order subsystem's recorded counters. View all retains collection filtering, and pagination exposes all eligible items beyond the initial display.

## 7. Verification plan after repairs

Run strict lint, production build, the API/Angular suites and real-browser customer/admin/visual workflows. Add collection API contract tests, pagination/rail boundaries, keyboard/mouse scrolling, load-more completeness, zero/three-decimal filters, long titles and partial errors. Re-run the same baseline audit to compare observed outcomes; retain before/after JSON and screenshots. Check Docker configuration references, but do not declare a live Docker or Lighthouse gate passed unless actually run.

## 8. Implementation results

At report creation this section was pending. Application fixes began only after the baseline report was saved. The following is the post-implementation verification record.

### Before/after replay of the same personas

| Check                          | Baseline                         | After fixes                                                          |
| ------------------------------ | -------------------------------- | -------------------------------------------------------------------- |
| Requested collections          | Premium and Hot absent           | Premium, Hot, Best Selling and New Arrivals                          |
| Products initially returned    | 4 featured / 4 best / 4 arrivals | All 6 Premium / 8 Hot / 8 Best Selling / 8 arrivals, with pagination |
| Valid long title at 360 px     | Page 1037 px; title 1013 px      | Page 360 px; title 151 px                                            |
| JPY Min=500                    | Sent 50000 minor units           | Sent 500 minor units                                                 |
| Max=0                          | Omitted                          | Preserved as maxPrice=0                                              |
| One failed collection          | Global error; 0 visible cards    | Local Premium error; 24 healthy cards remain                         |
| Concurrent category HTTP calls | 2                                | 1, without persistent caching                                        |
| Desktop hero headline          | 48 px                            | 64 px; mobile remains readable at 40 px                              |
| Guest cart                     | Works                            | Still works                                                          |
| Inactive-only stock excluded   | Correct                          | Still correct                                                        |

Replay evidence: `docs/test-evidence/home-after.json` and `after-*` screenshots. Initial product HTTP requests grow from three to four because Hot is new; deduplication keeps overall initial collection/category calls at five. Initial summaries grow from 12 to 30 (including cross-collection overlap). They remain bounded, and lazy images/native scrolling prevent an up-front download of the entire catalogue.

The single development Home-readiness sample was 2400 ms after versus 2127 ms before. This does **not** establish an overall speed improvement; the new feature loads more content, and one sample is affected by compilation/cache/PC load. Category duplication is the demonstrated request optimization. Production Lighthouse and load-scale performance remain unverified.

### Fix implementation map

- `Frontend/src/app/features/catalog/product-rail.component.*`: native horizontal scrolling, keyboard/mouse controls, boundary states and accessible names.
- `Frontend/src/app/features/catalog/home-collection.ts` and `home-page.component.*`: independent states, bounded pages, complete Load more/View all, shorter copy and larger headings.
- `Backend/src/modules/catalog/catalog.schemas.ts` and `catalog.service.ts`: strict collection API contract and server predicates; existing active-stock filtering preserved.
- `Frontend/src/app/core/money-input.ts` and `catalog-page.component.ts`: configured currency units, zero handling, precision/range checks and initial settings synchronization.
- `product-card.component.scss`, catalogue/PDP/home styles: constrained grid items and long-text wrapping. Duplicate image/title keyboard stops removed while retaining the named title link and image alt text.
- `catalog.api.ts`: concurrent-only category deduplication with successful/error reset, tested for later freshness.
- Root manifests/lock, TypeScript/Jest/E2E, Docker files, environment loading, art generator and README: Frontend/Backend relocation. npm link destinations are Backend/Frontend; no legacy apps workspace nodes remain.
- `e2e/fixture-server.ts` and `.dockerignore`: test-upload scratch isolation, cache/coverage/upload build-context exclusions. Existing development uploads are retained.

### Regression and contract results

- npm run lint and npm run build passed with unchanged strict/lint/budget rules.
- API: 78 tests across 10 suites passed, 91.07% line coverage.
- Angular: 23 tests across 9 suites passed, covering 0/2/3-decimal inputs, invalid precision, zero, independent failures, next-page Retry/deduplication and concurrent category freshness.
- Browser: five tests passed across customer card/COD correction, admin create-stock-sell-fulfil-analyse/brand changes, responsive guest/error recovery, and collection browsing. The persona audit also passed separately before and after repairs.
- Collection browser checks load 8 → 16 → 24 → 30 distinct best sellers, verify View all/pagination, previous/next end states, Arrow/Home/End and horizontal mouse wheel, and preserve healthy sections through a partial failure.
- Responsive checks at 360/768/1024/1440 px show no document horizontal overflow; overflow is confined to the intended rails. Desktop/mobile screenshots are saved under docs/previews.
- OpenAPI local references resolve; Compose YAML parses and upload mounts point to /app/Backend/uploads. Docker is unavailable locally, so live container verification remains open.

### Local endpoint timing probe

A warm 25-request sequential probe of the best-selling endpoint (30 demo products, local development proxy included) measured a median of **42.51 ms** and sample p95 of **101.48 ms**. Full samples are in `docs/test-evidence/collection-http-performance.json`. This is not a production load-test SLA or evidence of performance at a large catalogue/concurrent workload.

### Remaining limits

No recruited-human usability study, physical touch-device certification, full screen-reader audit, production Lighthouse certification, Docker clean-clone run or production-scale load test was performed in this task. Native overflow supports browser touch behavior; direct gesture assertions here cover keyboard and horizontal mouse/trackpad input. Existing wider release gates remain in IMPLEMENTATION_CHECKLIST.md. No commit or push was made.

### Additional currency and dependency checks

A further browser replay delayed the public settings response and opened a JPY deep link with minPrice=500; the input correctly displayed 500 after currency loading, rather than 5. After saving KWD with three decimals, entering 1.234 correctly sent minPrice=1234. Evidence: docs/test-evidence/home-after-precision.json. The earlier 2400 ms sample is retained as the stated comparison sample; repeated development timings vary and are not a production speed claim.

npm install refreshed actual workspace links, and npm ci --dry-run --ignore-scripts succeeded. This validates lock consistency without claiming a complete clean-clone installation. OpenAPI refs and Compose paths were checked; Angular cache, coverage and runtime uploads are excluded from the Docker build context. Browser uploads use cleaned suite scratch storage.

Preview: docs/previews/storefront-desktop-full.png shows the complete page and collection controls; desktop/mobile previews are also saved. All application code is now under Frontend/ and Backend/, with shared DTOs, infrastructure and reports outside those folders as requested.
