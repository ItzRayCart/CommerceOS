# CommerceOS

CommerceOS is an Angular storefront backed by an Express REST API and MongoDB. Admin includes dashboard, products/media/variants, categories, inventory audits, order fulfilment/refunds, customers, discounts, analytics and white-label settings. The implemented shopping path covers browsing 60 seeded products, category/search filters, product variants, wishlists, guest and account carts, discount codes, checkout, order confirmation, history and pending-order cancellation. Authentication is real and uses a rotating refresh session. Payments use the specified mock card provider or cash on delivery.

## Architecture

```text
Angular SPA (Frontend) → /api/v1 → Express (Backend) → MongoDB replica set
                                ↘ shared DTOs/enums (packages/shared)
```

The API uses route → controller → service → model/mapper layers. `createApp()` has no listener; `server.ts` validates the environment, connects MongoDB, starts the HTTP server and closes it on shutdown. Authentication uses a 15-minute bearer access token and a rotating seven-day HttpOnly refresh cookie. The browser keeps the access token only in memory and attempts a cookie refresh on startup.

## Prerequisites

- Node.js 24 LTS recommended (22.12+ is supported by Angular 21); npm 11.
- Docker Engine with Compose for the container workflow, or a local MongoDB 7 replica set for `npm run dev`. A replica set is required for atomic password-reset transactions and later checkout transactions.
- Copy `.env.example` to `.env`. For production, set a unique `JWT_ACCESS_SECRET` of at least 32 characters and enable `COOKIE_SECURE=true`. Development generates an ephemeral secret when the variable is blank.

## Quick start

```sh
cp .env.example .env
npm ci
docker compose up --build
```

The web app is at `http://localhost:4200`, the API at `http://localhost:4000`, Swagger UI at `http://localhost:4000/api/docs`, and health at `http://localhost:4000/health`. The MongoDB container initiates the single-node `rs0` replica set.

For local development with a separately running MongoDB replica set:

```sh
cp .env.example .env
npm ci
npm run dev
```

The Angular dev server proxies `/api` to the API. The local MongoDB URI in `.env.example` uses `directConnection=true` so it can reach a replica-set container whose advertised host is `mongo`.

In development, the API creates the HALDEN store settings, five categories, 30 products with three variants each, and the `WELCOME10` discount code on startup if they are missing. Seeded product art is local under `Frontend/public/assets/products`. To replace catalogue, settings, discounts, users, carts, orders and inventory audit demo data in a disposable development database, use `npm run seed:reset`; do not run that command against a database containing data you need. In production, seed explicitly with `npm run seed` after configuring the environment.

### Try the storefront

1. Open `http://localhost:4200/`, browse `/shop`, and use the header search. Filters, sorting, and pagination stay in the URL.
2. Open a product. Select a color, inspect the updated price/SKU/stock and gallery, and add it to the cart. A direct link such as `/products/studio-headphones?variant=HLD-002-SAN` selects that SKU.
3. Open `/cart`. As a guest, item IDs and quantities persist locally. Prices, stock, shipping, and tax come from `POST /api/v1/cart/price` using MongoDB data.
4. Register or sign in. Your guest lines merge into your server cart, capped by stock and ten units. Apply `WELCOME10` for 10% off when the subtotal is at least $50. The API validates the code and calculates all totals.
5. Save a product to the wishlist after sign-in. The header count and `/wishlist` reflect the saved products.
6. Continue to checkout. Choose a saved address (the default is preselected) or enter a new one. Phone numbers use an international format such as `+923001234567`; country uses two letters such as `PK` or `US`.
7. Choose Standard, Express or Pickup, then mock card or cash on delivery. Each step requests a fresh server quote. New demo settings use Standard $6 (free from $150 after discounts), Express $18, and Pickup $0. Existing store settings are preserved by normal seeding.
8. Review and place the order. The confirmation shows the order number, item/address/shipping/currency snapshots, payment, totals and timeline. `/account/orders` lists your orders. Pending COD orders can be cancelled, restoring stock and releasing discount usage.

Unavailable items and stock changes show warnings and block checkout readiness. Server cart lines keep a price fingerprint, so a later catalogue price edit produces a price-change warning without storing a cart price. Guest carts also compare their previous browser quote. The order API reads the authenticated server cart and recalculates every amount inside a MongoDB transaction; the browser sends an address/reference, shipping code and payment token, never authoritative prices. If a reviewed quote changes, refresh it and review the new total. Stock changes, audit movements, order creation, discount usage, customer stats and cart clearing commit together.

### Try checkout payments

| Mock card             | Result                                                 |
| --------------------- | ------------------------------------------------------ |
| `4242 4242 4242 4242` | Paid order                                             |
| `4000 0000 0000 0002` | HTTP 402, card declined; cart and stock unchanged      |
| `4000 0000 0000 9995` | HTTP 402, insufficient funds; cart and stock unchanged |

Use a future `MM/YY` expiry and any three-digit CVC. Luhn, expiry and CVC are validated in the browser. PAN/CVC never enter an API request, stored order, or submission recovery record. These are demonstration payments; no real card is charged. COD creates a pending/unpaid order. An admin can use `PATCH /api/v1/admin/orders/:id/status` with `{ "status": "paid" }` to record payment and `paidAt`; the full admin sales UI remains a later phase.

`POST /api/v1/orders` requires an `Idempotency-Key` header (8–128 letters, digits, underscores or hyphens). Retries for the same user/key return the original order, including after cart clearing. After a connection/server failure, checkout preserves the key and exact token-only payload in session storage and offers **Check pending order**. Keep that key when retrying an API call whose outcome is uncertain. A confirmed payment/validation failure allows a corrected new submission. Confirmation emails use `MAIL_TRANSPORT=console` locally or the existing SMTP settings; email failure does not undo a committed order.

Catalogue data comes from `GET /api/v1/settings/public`, `/categories`, `/products`, `/products/suggest`, and `/products/:slug`. Product images are bundled locally. The implemented endpoint contract is at `/api/docs` and `Backend/docs/openapi.yaml`.

### Try authentication yourself

Open `http://localhost:4200/register` to create a customer account, then visit `/login` and `/account`. Passwords need at least eight characters, an uppercase letter, a lowercase letter, and a digit, and cannot be one of the common passwords blocked by the API. Public registration always creates a customer; sending `role: "admin"` has no effect. The API contract and response schemas are at `/api/docs`.

With the API at `http://localhost:4000`, this PowerShell example runs the complete session sequence and preserves the refresh cookie in `$authSession`:

```powershell
$base = 'http://localhost:4000/api/v1'
$email = "tester-$(Get-Random)@example.com"
$registration = @{ email=$email; password='ExamplePassword9'; firstName='Test'; lastName='Customer' } | ConvertTo-Json
$registered = Invoke-RestMethod "$base/auth/register" -Method Post -ContentType 'application/json' -Body $registration -SessionVariable authSession
$login = Invoke-RestMethod "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{ email=$email; password='ExamplePassword9' } | ConvertTo-Json) -WebSession $authSession
$refreshed = Invoke-RestMethod "$base/auth/refresh" -Method Post -ContentType 'application/json' -Body '{}' -WebSession $authSession
$oldRefresh = ($authSession.Cookies.GetCookies("$base/auth/refresh") | Where-Object Name -eq 'refreshToken').Value
$me = Invoke-RestMethod "$base/auth/me" -Headers @{ Authorization="Bearer $($refreshed.data.accessToken)" }
Invoke-RestMethod "$base/auth/logout" -Method Post -ContentType 'application/json' -Body '{}' -Headers @{ Authorization="Bearer $($refreshed.data.accessToken)" } -WebSession $authSession
# Expected: HTTP 401; the old refresh token captured before logout was revoked.
Invoke-RestMethod "$base/auth/refresh" -Method Post -ContentType 'application/json' -Body '{}' -Headers @{ Cookie="refreshToken=$oldRefresh" }
```

The API limits authentication requests to 10 per 15 minutes per IP, so use a fresh interval if repeated manual attempts return HTTP 429. Password-reset requests always return HTTP 202. In local development `MAIL_TRANSPORT=console` writes the reset link to the API log. For production set `MAIL_TRANSPORT=smtp`, `SMTP_HOST`, `SMTP_PORT`, and, when the server requires authentication, `SMTP_USER` and `SMTP_PASS`. Production also requires `COOKIE_SECURE=true` and a nonblank `JWT_ACCESS_SECRET` of at least 32 characters.

## Workspaces and scripts

| Workspace         | Purpose                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| `Frontend`        | Angular standalone SPA, lazy storefront/admin shells, design tokens, typed API client |
| `Backend`         | Express API, MongoDB connection, validation, logging, errors, OpenAPI                 |
| `packages/shared` | Dependency-free enums and DTO interfaces                                              |

`npm run build`, `npm run lint`, and `npm test` run across workspaces. GitHub Actions also installs Chromium and runs `npm run test:e2e`. `npm run docker:up` and `npm run docker:down` manage Compose. `npm run seed` fills missing catalogue data and the admin sales dataset; `npm run seed:reset` replaces it in a disposable development database.

## Environment

See `.env.example` for all variables. `MONGODB_URI`, CORS origins, web base URL, upload directory, logging level, mail transport and auth TTLs are read only in `Backend/src/config/env.ts` and validated at startup. The Angular API base URL is `/api/v1`.

## Testing and current scope

Run `npm run lint`, `npm run build`, and `npm test` from the repository root, matching GitHub Actions. API integration tests use `mongodb-memory-server` and may download a MongoDB binary on the first run; they do not need a separately running MongoDB. Docker is required to verify the full Phase 0 clean-clone exit criterion. Explicit demo seeding creates the development-only accounts below; public accounts are created through registration. The supplied design brief is in `docs/`; keep the confidential engineering specification outside a public repository. See `IMPLEMENTATION_CHECKLIST.md` for remaining phase gates and `DECISIONS.md` for implementation decisions.

For real-browser checkout tests:

```sh
npx playwright install chromium
npm run test:e2e
```

Keep test ports 4400 and 4500 free. Your development app can continue using 4000 and 4200. Playwright starts Angular, Express and a disposable MongoDB replica set, creates its own accounts, and stops them afterwards. It never uses your development database. On Linux, use `npx playwright install --with-deps chromium`. An installed Chrome can be used on Windows with `$env:PLAYWRIGHT_CHROME_CHANNEL='chrome'` before `npm run test:e2e`. If you already have a suitable MongoDB binary, `MONGOMS_SYSTEM_BINARY` can point to it to avoid the first download. First-run MongoDB downloads can be large; a download/setup timeout is separate from a checkout test failure.

The adversarial checkout coverage and specification mapping are in `docs/CHECKOUT_REVIEW.md`. Tests cover payment decline, partial-write rollback, last-unit concurrency, duplicate and lost-response submissions, cart/order races, discount limits/release, immutable snapshots and order ownership.

## Admin portfolio demo

With a development MongoDB replica set running, run from the repository root:

```sh
npm run seed
npm run dev
```

For Compose use `docker compose exec api npm run seed`. Startup alone does not create administrator credentials or sales history. Explicit seeding creates 40 customers and 120 historical orders across all six states through the real order services. It is repeatable without duplicating orders/movements. Use a demo database; `npm run seed:reset` destroys the data listed above.

| Role     | Email                | Demo password  |
| -------- | -------------------- | -------------- |
| Admin    | admin@halden.test    | Admin#12345    |
| Customer | customer@halden.test | Customer#12345 |

These are public demo credentials. Do not seed them into production. Sign in at `/login`, then open `/admin`.

### Customer: Discover -> Purchase -> Order

Browse `/shop`, select a variant, add it to the cart, sign in, choose an address/shipping/payment, review and place an order. Confirmation/tracking appear in `/account/orders`. Payments use mock cards or COD, with no real money processed.

### Admin: Create -> Stock -> Sell -> Fulfil -> Analyse

1. **Products -> Create product:** enter details/category, upload images, set alt text/primary/order, define up to three option axes and generate variants.
2. Set unique SKUs, integer prices in minor units (`15000` = USD $150), stock/thresholds, specifications and SEO. Choose **Active** and save. The real storefront displays the product.
3. **Inventory:** search its SKU, adjust stock with a reason/note and inspect movement history. Negative stock is rejected; stock and audit commit together.
4. Purchase it as a customer using COD. **Orders:** mark paid, enter carrier/tracking, ship, then complete. Cancellation/refund use confirmations and legal transitions; invalid transitions return `409 INVALID_STATE_TRANSITION`.
5. **Analytics:** view product/category sales, customers and discounts; export filtered CSV. Dashboard KPIs compare against the previous equal-length period.
6. **Settings:** change name, theme, contacts, currency, tax, shipping and feature flags, then save. **View storefront** reflects your brand. Future quotes use saved settings; old orders retain snapshots. Currency changes denomination/display without foreign-exchange conversion.

`UPLOAD_DIR` must be writable. Local uploads accept JPEG/PNG/WebP with matching extension, MIME and magic bytes, up to 5 MB per image and 10 files per upload. Angular and Nginx proxy `/uploads`. MongoDB transactions require a replica set; payments, email and storage use provider interfaces.

`npm run test:e2e` runs customer/admin suites with separate fresh API/MongoDB instances, retaining the real authentication rate limit. It verifies publication, purchases, fulfilment, analytics, branding and dashboard layouts at 360/768/1024/1440 px. Reports are under `playwright-report/checkout` and `playwright-report/admin`. Acceptance evidence and remaining release gates: `docs/ADMIN_REVIEW.md`.

Browser suite scratch directories live under ignored `node_modules/.cache/commerceos-e2e` and are removed after each suite. This avoids leaked temporary MongoDB data exhausting the system drive on Windows.

## UI design and visual checks

The redesigned storefront and admin share the design brief's typography, tokens and settings-driven branding. Fonts are self-hosted with licenses under `Frontend/public/assets/fonts`. Research/design decisions: `docs/UI_REDESIGN.md`.

`npm run test:e2e` runs customer, admin and visual UI suites. To run one suite use `npm run test:e2e -- --suite=ui` (or `checkout` / `admin`). The UI suite checks Home, Catalogue, Product, Register and guest Cart at responsive widths, captures screenshots, and verifies API-error recovery. Reports: `playwright-report/ui`; screenshots: ignored `test-results/`. Each suite has a fresh disposable replica set and automatically cleaned scratch files.

## Commit messages

Commit messages are free-form; prefixes such as `feat:` and `chore:` are optional. The pre-commit hook still formats staged files with lint-staged/Prettier.

## Frontend, Backend and home collections

Core application folders are `Frontend/` (Angular) and `Backend/` (Express/Mongoose). `packages/shared/` retains the shared DTO workspace; tests, infrastructure, tools and documentation remain at the root. Workspace names stay `@commerceos/web`, `@commerceos/api` and `@commerceos/shared`, so root npm commands are unchanged. After pulling the folder relocation, run `npm ci` to refresh workspace links.

Home offers native horizontal scrolling (touch/trackpad, previous/next and keyboard arrows/Home/End), eight-item pages, Load more and View all. All eligible products are reachable through pagination; they are not all downloaded up front.

- **Premium:** merchant-selected featured products. Use **Premium selection** in the product editor.
- **Hot:** products listed in the last 30 days, with recorded ordered units and an available active variant.
- **Best Selling:** positive recorded ordered units, highest first. This uses existing counters, not a paid-revenue report.

Collection data is filtered by the backend using `GET /api/v1/products?collection=premium|hot|best-selling`. The catalogue retains the collection in its URL and supports filtering/pagination. Demo counters are seeded; real orders maintain production counters. Empty collections show an honest empty state.

Persona review and before/after evidence: `docs/USER_TEST_REPORT_2026-10-07.md`. Run `npm run test:e2e -- --suite=rails` for collection controls, complete pagination, keyboard/mouse access, partial Retry and local HTTP timing samples. `--suite=audit` repeats the simulated shopper/merchant audit; it runs only against a disposable test database. Test uploads now live in the suite's owned scratch directory, not development uploads.

## Account and expanded illustrations

The account page shares the storefront header, typography and theme. It includes personal details, saved-address editing, default addresses, removal confirmation and password changes with inline validation. Visit `/account`, `/account/addresses`, or `/account?tab=security`. Password changes revoke refresh sessions and require signing in again.

The demo catalogue contains **60 products, 180 colour variants and 480 local SVG illustrations**. The original 60 illustrations are preserved; each product has eight gallery views, including Graphite, Sand and Brass variations. These are stylised demo illustrations, not product photography. No AI-generated photos or remote image dependencies are used.

To add missing demo products and illustration views to an existing development database:

```sh
npm run seed:catalog
```

This requires the Node/npm dependencies installed with `npm ci`, a valid root `.env` with `NODE_ENV=development`, and the configured MongoDB instance running. This command preserves existing prices, stock, product/variant identities, accounts, orders and custom uploaded media. It extends original demo galleries and repairs discarded demo photo URLs; it does not reset the database or create demo order history.

Illustrations are committed assets; image-generation services and image encoder dependencies are unnecessary. To create any missing illustration files locally, run `node tools/generate-product-art.mjs`. Existing SVG files are never overwritten. Test the account workflow with `npm run test:e2e -- --suite=account`; it also runs in the full CI browser suite.

Details and test evidence: [Account and catalogue review](docs/ACCOUNT_AND_CATALOGUE_REVIEW_2026-10-10.md).
