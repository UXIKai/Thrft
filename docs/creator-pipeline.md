# Creator-to-checkout pipeline

## Deployment setup

The browser uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
The API uses `SUPABASE_SERVICE_ROLE_KEY`, `PRINTFUL_API_TOKEN`, and
`STRIPE_SECRET_KEY`. Never prefix server secrets with `VITE_`.

1. Run `supabase/creator-pipeline.sql` in the Supabase SQL Editor. The public
   **Thrft** bucket and its Storage SELECT/INSERT policies do not create these
   product, mockup-task, or checkout-order tables. Existing deployments should
   rerun the file to add the multi-size, shipping quote, recipient, and tracking
   columns and shipped statuses without deleting products or orders.
2. Allow authenticated Storage uploads under the user's UUID folder in **Thrft**.
   Artwork paths are `<auth-user-id>/<random-id>.png` or `.jpg`. Mockups are copied
   server-side into `<auth-user-id>/mockups/` so expiring Printful images do not
   break published products. Keep the bucket public. Set its file limit to at
   least 20 MB and allow PNG/JPEG content types.
3. Set `APP_ORIGIN` to the public app URL (otherwise the Vercel production hostname
   is used). Set `PRINTFUL_STORE_ID` if using an account-level token covering
   multiple stores. The Printful token needs catalog, mockup, and order access.
4. Create a Stripe webhook endpoint at
   `https://<app-domain>/api/webhooks/stripe` for
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
   Set its signing secret as `STRIPE_WEBHOOK_SECRET` in Vercel and redeploy.
   A Stripe API secret alone cannot authenticate webhook deliveries.
5. `npm run build` produces both static assets and a bundled Node serverless
   function in `.vercel/output`. The Build Output API routes creator, Printful,
   checkout, and webhook requests to this function before the SPA fallback.
   Locally, `npm run server` serves the same handlers on port 8787; the existing
   local server also requires its Prisma `DATABASE_URL`. For a Supabase-only
   local API, run `node server/creatorServer.js`.
6. Set a random server-only `PRINTFUL_WEBHOOK_SECRET` (at least 32 random bytes)
   and register a Printful V1 webhook URL:
   `https://<app-domain>/api/webhooks/printful?token=<secret>`, subscribing to
   `package_shipped`. Keep the URL/token out of client code and public logs.
   V1 deliveries do not have Stripe-style signatures: the endpoint checks this
   shared secret, then retrieves the order from Printful to verify the shipment,
   external order ID, and tracking data before writing anything.

## Creator workflow

For member profiles, follow counts, account-scoped Saved products, and the real
Leaderboard, also apply `supabase/social.sql`; see [social data](social-data.md).

Store feeds and brand pages load active `brand_products` through
`GET /api/creator/products` (optionally filtered by brand). Empty display slots
remain visible as non-interactive glass tiles, not demo listings. Each populated
brand row displays only its real products. Empty rows continuously rotate in
alternating directions; populated rows move back and forth without repeating
products, even when they contain only one. Product photos float without a
visible container; empty displays keep their glass frames. Store tiles display the first mockup;
the Product Detail sheet lets buyers swipe through all generated mockups and
choose only the listing's published sizes before adding to their bag. Visible
Printful mockups are cut out on the device and cached locally, including older
listings. The original image remains visible until processing completes, or if
the cutout fails; the printable artwork and saved mockups are unchanged. The
uniform white background is removed directly without a model download. Other
backgrounds use the on-device model, which is downloaded on first use. White
details enclosed inside the product are preserved by the direct cutout.

In **Create → Store → photo**, enable **Print on demand**. Upload the
original artwork directly to Thrft Storage, choose a Printful blank, one color,
and multiple available sizes, then generate mockups. PNG/JPEG files up to 20 MB are supported.
Artwork is centered and fitted to the front print area without stretching; blanks without a front printfile return an
explicit error. The preview shows the actual generated Printful image.

Publish after adding a title, brand, and price. One listing contains all selected
size-to-variant mappings for that color. Buyers choose a size for each quantity;
checkout groups matching sizes and submits their corresponding Printful variant
IDs. The retail price step shows the Printful base-cost and estimated gross-margin
ranges across selected sizes, before shipping, taxes, and payment fees. Missing
or non-USD catalog costs are reported as unavailable, not assumed to be zero.
Ordinary Store product photos still work and are now uploaded to
Storage instead of storing data URLs.

### Connect a website

Apply `supabase/external-brands.sql` after `supabase/creator-pipeline.sql`.
In **Create → Store → Connect Website**, upload a brand logo and enter its name
and public HTTPS website. Request verification instructions, publish the meta tag
in the homepage `<head>` or the DNS TXT record, then verify before importing.
Repeat the import to refresh the catalog; it is not
scheduled automatically. Shopify-compatible `/products.json` catalogs use
the store currency from `/cart.js`, import up to 1,000 products, and
archive previously imported products no longer available. Other sites can
provide Schema.org Product JSON-LD on the entered product page, or on up to
12 linked product pages. This partial import does not archive other products.
The importer reports unsupported or incomplete catalogs instead of guessing
prices, currencies, or sizes.

Owners can also use **Sync / Re-import catalog** in **Settings → Brand shipping**
or their brand profile management view. It posts `{brandId}` to
`POST /api/brands/import-url`; the server reloads the owned brand's saved name,
logo and verified domain. Products are upserted by brand and external URL,
preserving listing IDs, shipping settings and Shopify connections. Variant
snapshots include stock flags and current prices; sold-out products are archived
and reactivated on restock. A complete empty catalog archives previous imports.
Partial imports never archive unrelated products. USD stores retain USD pricing;
other currencies are not silently converted and remain ineligible for checkout.
Rerun the updated `supabase/external-brands.sql` to apply stock-aware upserts.

Shopify imports also save variant IDs, options, stock flags, sizes and prices as
catalog snapshots. A missing or unsafe numeric variant ID is recorded as null;
these snapshots are not live inventory. Verified USD Shopify products with saved
variants now use in-app Add to Cart and Stripe Checkout. Reimport older products
to load variants. JSON-LD products without supported variants cannot use in-app checkout.
Verified imported brands can set a flat USD shipping rate in **Settings →
Brand shipping**. The default is $0, charged once per brand per checkout, including
mixed Printful carts. A delivery address and reviewed quote are required.

`POST /api/brands/verify-challenge` accepts `{ "domain": "brand.com" }` (or an
HTTPS URL) and returns a stable, random `thrft-verify-...` token, `metaTag`, and
`dnsTxt`. `POST /api/brands/verify-domain` accepts the same domain and
`"method": "html"` or `"dns"`. Both endpoints require sign-in. Challenges are
private and account-scoped; pending challenges do not reserve a domain. The first
successful proof atomically claims that exact hostname for one account.
Subdomains, including `www`, must be verified separately. HTML verification and
catalog requests cannot redirect to a different hostname or custom port.

The importer checks the verified owner before any catalog request and the SQL
sync checks again before writing. Publication is also guarded by a database
trigger. Rerun the updated `supabase/external-brands.sql` even if it was previously
applied: existing unverified imports are archived until ownership is verified
and the catalog is reimported. No existing import is automatically granted ownership.
Product links stay on the verified website origin.
Public HTTPS requests, including redirects and product image downloads, reject
private/reserved addresses and pin the resolved address for each connection.
Imported photos are fetched through a bounded image proxy and use the same
on-device cutout as Printful mockups; if processing fails the original remains
visible. Checkout reloads saved variant USD prices and verified ownership, then
fetches the exact verified origin's live `/products.json` (bounded pagination).
Selected variants must explicitly report `available: true`; missing, sold-out or
unreachable inventory blocks payment. This check is not an inventory reservation:
stock can change between checkout and payment.

### External payments, manual payouts, and optional Shopify sync

Rerun `supabase/external-brands.sql` before deploying checkout. It adds server-only
Shopify credentials, sync jobs, shipping snapshots and `external_brand_payouts`.
Verified paid orders are recorded in `creator_checkout_orders`; an atomic trigger
creates one payout ledger entry per order/brand. Only Stripe-retrieved, paid sessions
whose buyer, currency and total match the server snapshot are accepted.
External paid item revenue (excluding shipping) contributes to the Leaderboard;
Settings → Orders → Sales shows orders, delivery addresses, payout breakdowns and sync status.

There is **no monthly seller fee**. The Thrft fee is 10% of item subtotal.
Processing is the requested formula, `round(0.029 * total_charged + $0.30)`,
not a reconciliation of Stripe's actual balance-transaction fees.
Amounts are rounded to the nearest cent; payout is
`max(0, item_subtotal - round(10% * item_subtotal) + shipping - processing)`.
For mixed/multi-brand carts, allocate the single session processing fee by each
brand's items plus shipping as a share of the total charged, in brand-ID order
using differences of rounded cumulative shares so cents are conserved. The
non-external remainder bears its share. Ledger status starts `owed`; this is
**manual accounting, not an automatic bank payout**. Operators must reconcile
refunds, disputes and actual fees and set entries `held` or adjust before paying;
refund/dispute automation is not provided.

To enable optional Shopify sync, configure server-only
`SHOPIFY_TOKEN_ENCRYPTION_KEY` as base64 of 32 random bytes (AES-256-GCM; keep a
secure backup and don't rotate without reencrypting saved tokens). In Settings →
Brand shipping, save the shop's `*.myshopify.com` hostname and Admin token with
`read_orders` and `write_orders`. The server validates the shop's primary domain
against the owned website; credentials are encrypted and never returned to the browser.
`PUT /api/brands/settings/:id/shopify` accepts `{shop, token}` or `{disconnect:true}`.
Paid external orders are sent to `/admin/api/2026-01/orders.json` as already paid;
no second payment is initiated. Shopify failures are logged and shown in Sales
without rejecting Stripe's webhook. A durable per-brand claim prevents replayed
POSTs; interrupted/ambiguous submissions require manual review, never blind retry.
Orders without a token remain visible for manual fulfillment.

Products are saved in `brand_products`, with the authenticated `creator_id`,
`printful_product_id`, `printful_variants`, `artwork_url`, `mockup_urls`, size,
color, and price. Publication uses an owned, completed server-side mockup task;
the browser cannot substitute another creator or fulfillment URL. Profile's
Store tab, brand pages, and storefront feeds load these records.

## Checkout and fulfillment

Checkout reloads each cart product and its price from Supabase. Browser-supplied
prices and artwork URLs are not fulfillment inputs; requested variant IDs must
match trusted saved variants. For Printful
items, buyers enter a structured delivery address in the bag before payment.
`POST /api/checkout/estimate` retrieves Printful `/shipping/rates` using that
address and server-resolved variant quantities, then shows shipping services and
the total. Checkout re-quotes the selected service before creating Stripe; a
changed price requires another review. Provider errors or unavailable shipping
block checkout rather than substituting free shipping.

Shipping is charged as a separate Stripe line item. The quoted address is saved
as the Stripe customer's shipping address and in `creator_checkout_orders`
alongside the selected rate and total (including shipping). Stripe collects
billing details, not a different delivery address, so the shipping quote cannot
be invalidated after payment. Fulfillment uses the saved address and shipping
service. Ordinary, non-Printful items retain their existing checkout behavior;
mixed carts quote Printful shipping only for printable items, plus each external
brand's flat shipping rate.

Only a verified **paid** Stripe session creates a Printful order with
`confirm=false`. It remains a **draft**: no automatic Printful confirmation or
production charge. Mixed carts include only printable items in the Printful
draft. Manufacturing costs are not added separately; creators must account for
them in retail pricing and review/confirm drafts before Printful can ship.

Verified `package_shipped` events update `fulfillment_status` to
`partially_shipped` or `shipped` and save `tracking_number`, `tracking_url`, and
all package tracking entries in `shipments`. Repeated notifications are safe,
and later Stripe callbacks do not create another draft for shipped orders.

Signed webhooks support delayed payments and retries. A database claim prevents
concurrent submissions; Printful's external order ID allows recovery if the
remote order was created but its ID could not be saved. Failed fulfillment is
saved and returned as an error so Stripe can retry. The authenticated checkout
status endpoint also verifies payment and retries fulfillment. The app does not
empty the cart just because a return URL says `checkout=success`.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/printful/products` | Catalog blanks (authenticated) |
| GET | `/api/printful/products/:id` | Blank size/color variants |
| POST | `/api/printful/mockups` | `{ product_id, variant_ids: [id, ...], artwork_url, placement: "front" }` |
| GET | `/api/printful/mockups/:task_key` | Poll an owned task; persists completed images |
| POST | `/api/creator/products` | Publish with `mockup_task_key`, title, brand, price |
| GET | `/api/creator/products` | Public active storefront products; optional `brand` filter |
| GET | `/api/creator/me/products` | Current creator's products |
| GET | `/api/creator/accounts/:username` | Creator storefront |
| POST | `/api/checkout/session` | Authenticated cart checkout |
| POST | `/api/checkout/estimate` | `{ items, address }` → subtotal and live Printful shipping rates |
| GET | `/api/checkout/session/:id` | Owner-only Stripe-verified payment/fulfillment status |
| POST | `/api/webhooks/stripe` | Raw-body, signed Stripe webhook |
| POST | `/api/webhooks/printful?token=<secret>` | Authenticated, provider-verified shipment updates |

The structured `address` uses Printful fields: `name`, `address1`, optional
`address2`, `city`, `state_code`, `country_code` (two-letter ISO code), and `zip`.
Checkout accepts the selected `shippingRateId` and quoted `shippingAmount` in
integer USD cents; both are checked against a fresh provider quote.

Run `node --test tests/creator-pipeline.test.js` and `npm run build` for local
validation. Tests use mocked provider responses and never create real orders.
An end-to-end deployment test still requires applying the schema, configuring
the webhook, and completing a Stripe test-mode payment against the deployed API.
