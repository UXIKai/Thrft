# Creator-to-checkout pipeline

## Deployment setup

The browser uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
The API uses `SUPABASE_SERVICE_ROLE_KEY`, `PRINTFUL_API_TOKEN`, and
`STRIPE_SECRET_KEY`. Never prefix server secrets with `VITE_`.

1. Run `supabase/creator-pipeline.sql` in the Supabase SQL Editor. The public
   **Thrft** bucket and its Storage SELECT/INSERT policies do not create these
   product, mockup-task, or checkout-order tables.
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

## Creator workflow

In **Create → Store → photo**, enable **Create a Printful product**. Upload the
original artwork directly to Thrft Storage, choose a Printful blank and its
size/color, and generate mockups. PNG/JPEG files up to 20 MB are supported.
Artwork is centered and fitted to the front print area without stretching; blanks without a front printfile return an
explicit error. The preview shows the actual generated Printful image.

Publish after adding a title, brand, and price. One published product represents
one specific Printful size/color. Publish separate products for additional
variants. Ordinary Store product photos still work and are now uploaded to
Storage instead of storing data URLs.

Products are saved in `brand_products`, with the authenticated `creator_id`,
`printful_product_id`, `printful_variant_id`, `artwork_url`, `mockup_urls`, size,
color, and price. Publication uses an owned, completed server-side mockup task;
the browser cannot substitute another creator or fulfillment URL. Profile's
Store tab, brand pages, and storefront feeds load these records.

## Checkout and fulfillment

Checkout reloads each cart product and its price from Supabase. Browser-supplied
prices, variant IDs, and artwork URLs are not fulfillment inputs. Stripe collects
a structured shipping address and stores a durable item snapshot in
`creator_checkout_orders`.

Only a verified **paid** Stripe session creates a Printful order with
`confirm=false`. It remains a **draft**: no automatic Printful confirmation or
production charge. Mixed carts include only printable items in the Printful
draft. Shipping/production costs are not added to the Stripe price by this
integration; creators must account for those in pricing and review drafts.

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
| POST | `/api/printful/mockups` | `{ product_id, variant_id, artwork_url, placement: "front" }` |
| GET | `/api/printful/mockups/:task_key` | Poll an owned task; persists completed images |
| POST | `/api/creator/products` | Publish with `mockup_task_key`, title, brand, price |
| GET | `/api/creator/products` | Public active storefront products; optional `brand` filter |
| GET | `/api/creator/me/products` | Current creator's products |
| GET | `/api/creator/accounts/:username` | Creator storefront |
| POST | `/api/checkout/session` | Authenticated cart checkout |
| GET | `/api/checkout/session/:id` | Owner-only Stripe-verified payment/fulfillment status |
| POST | `/api/webhooks/stripe` | Raw-body, signed Stripe webhook |

Run `node --test tests/creator-pipeline.test.js` and `npm run build` for local
validation. Tests use mocked provider responses and never create real orders.
An end-to-end deployment test still requires applying the schema, configuring
the webhook, and completing a Stripe test-mode payment against the deployed API.
