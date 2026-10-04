# CommerceOS

CommerceOS is an Angular storefront backed by an Express REST API and MongoDB. The implemented shopping path covers browsing 30 seeded products, category/search filters, product variants, wishlists, guest and account carts, discount codes, checkout, order confirmation, history and pending-order cancellation. Authentication is real and uses a rotating refresh session. Payments use the specified mock card provider or cash on delivery.

## Architecture

```text
Angular SPA (apps/web) → /api/v1 → Express (apps/api) → MongoDB replica set
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

In development, the API creates the HALDEN store settings, five categories, 30 products with three variants each, and the `WELCOME10` discount code on startup if they are missing. Seeded product art is local under `apps/web/public/assets/products`. To reset only catalogue/settings/discount demo data in a disposable development database, use `npm run seed:reset`; do not run that command against a database containing data you need. In production, seed explicitly with `npm run seed` after configuring the environment.

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

Catalogue data comes from `GET /api/v1/settings/public`, `/categories`, `/products`, `/products/suggest`, and `/products/:slug`. Product images are bundled locally. The implemented endpoint contract is at `/api/docs` and `apps/api/docs/openapi.yaml`.

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
| `apps/web`        | Angular standalone SPA, lazy storefront/admin shells, design tokens, typed API client |
| `apps/api`        | Express API, MongoDB connection, validation, logging, errors, OpenAPI                 |
| `packages/shared` | Dependency-free enums and DTO interfaces                                              |

`npm run build`, `npm run lint`, and `npm test` run across workspaces. GitHub Actions also installs Chromium and runs `npm run test:e2e`. `npm run docker:up` and `npm run docker:down` manage Compose. `npm run seed` fills missing demo catalogue data; `npm run seed:reset` replaces it in a disposable development database.

## Environment

See `.env.example` for all variables. `MONGODB_URI`, CORS origins, web base URL, upload directory, logging level, mail transport and auth TTLs are read only in `apps/api/src/config/env.ts` and validated at startup. The Angular API base URL is `/api/v1`.

## Testing and current scope

Run `npm run lint`, `npm run build`, and `npm test` from the repository root, matching GitHub Actions. API integration tests use `mongodb-memory-server` and may download a MongoDB binary on the first run; they do not need a separately running MongoDB. Docker is required to verify the full Phase 0 clean-clone exit criterion. Demo customer accounts are created through registration; no account password is shipped. The supplied design brief is in `docs/`; keep the confidential engineering specification outside a public repository. See `IMPLEMENTATION_CHECKLIST.md` for remaining phase gates and `DECISIONS.md` for implementation decisions.

For real-browser checkout tests:

```sh
npx playwright install chromium
npm run test:e2e
```

Keep ports 4000 and 4200 free. Playwright starts Angular, Express and a disposable MongoDB replica set, creates its own accounts, and stops them afterwards. It never uses your development database. On Linux, use `npx playwright install --with-deps chromium`. An installed Chrome can be used on Windows with `$env:PLAYWRIGHT_CHROME_CHANNEL='chrome'` before `npm run test:e2e`. If you already have a suitable MongoDB binary, `MONGOMS_SYSTEM_BINARY` can point to it to avoid the first download. First-run MongoDB downloads can be large; a download/setup timeout is separate from a checkout test failure.

The adversarial checkout coverage and specification mapping are in `docs/CHECKOUT_REVIEW.md`. Tests cover payment decline, partial-write rollback, last-unit concurrency, duplicate and lost-response submissions, cart/order races, discount limits/release, immutable snapshots and order ownership.
