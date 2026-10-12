# Account and catalogue review — 10 October 2026

## Delivered scope

- Account now uses the storefront shell and data-driven theme. Personal details, address book and security are separate URL-backed views; orders and wishlist have working navigation.
- Typed reactive forms provide inline validation, server field errors, pending states and success feedback. Address editing, default selection and a keyboard-accessible removal dialog use the existing authenticated API.
- Optional phone numbers can be cleared. Non-empty phone numbers still require valid international digits. Password confirmation runs locally; the existing password policy and session revocation run on the server.
- Catalogue expansion adds 30 products across the five existing categories: 60 products and 180 colour variants in total.
- All 56 generated AI photo files were removed from both the workspace and this chat's generated-image folder. Their compression dependency was removed as well.
- All 60 original SVG illustrations were retained, verified against Git content after normalising checkout line endings. 420 additional SVGs give each product eight illustration views. The 480 valid SVGs occupy about 518 KiB in total.
- New illustration pairs show Graphite, Sand and Brass finishes with item-specific silhouettes and front/rear details. These are stylised illustrations, not photography.
- Product galleries now select the colour's first image on variant changes. Clicking a thumbnail directly chooses that image and updates the selected state consistently.

## Data preservation and review

The former seed returned as soon as any product existed. Seeding now inserts missing products by stable slug and batches validated inserts. It keeps prices, stock, IDs, order references and custom uploaded media. Only known discarded demo-photo URLs are restored. Existing original demo galleries receive missing illustration views; galleries containing custom images are preserved. Conditional media updates avoid replacing concurrent edits, and a no-op run leaves product timestamps alone.

`npm run seed:catalog` updates the configured development database without resetting data or creating demo orders. The running development API was checked: 60 products, no AI primary-image URLs, and eight views for Arc headphones with the original SVG first. `node tools/generate-product-art.mjs` was rerun and created zero files, confirming existing artwork is preserved.

## Verification

- Strict lint and production builds passed; the initial Angular bundle is approximately 305 KB before compression.
- All 480 SVG files parsed successfully as XML.
- Angular tests passed, including five new account form tests.
- Seed tests cover partial expansion, image/variant ID preservation, custom-media preservation, discarded URL restoration and repeat-run behaviour.
- Browser tests use ports 4400/4500 and disposable MongoDB replica sets so a development app on 4000/4200 can remain running.
- Full test run: 80 API tests and 28 Angular tests passed. Three focused seed regression tests passed, including the additional existing-gallery/ID preservation case. The full API run measured 90.87% line coverage.
- All six browser workflows passed: two customer checkout flows, admin operations/branding, responsive storefront/gallery checks, collection rails, and account management. Account was rerun successfully after adding simulated address-removal failure and retry checks.

## Running locally

See the root README for Node/npm, `.env`, MongoDB replica-set and Docker setup. Run `npm ci`, `npm run seed:catalog`, then `npm run dev`. Visit `/account` after signing in. Test the account workflow with `npm run test:e2e -- --suite=account`. No image-generation service or additional image encoder is required.
