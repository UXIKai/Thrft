# Orders

Run `listings-schema.sql` and `supabase/creator-pipeline.sql`, then
`supabase/orders.sql` in Supabase. The service-only view contains paid order
items; the authenticated API filters purchases by buyer and sales by seller.
Historical items without a saved seller ID are attributed to their original
listing when it still exists.

Printful production status is refreshed from Printful when Orders is opened.
The existing Printful `package_shipped` webhook supplies carrier tracking; see
`docs/creator-pipeline.md` for its configuration. Margin is the estimated
product gross margin from the checkout snapshot, excluding fees and shipping.
Orders without a known base cost do not show a margin.

Market label purchasing and Shippo tracking are not yet implemented. Creating a
label requires a seller return address, parcel dimensions and weight, a quoted
UPS rate and explicit acceptance of its cost, and a duplicate-charge-safe
purchase and recovery flow. The current checkout does not reserve a Market
listing against simultaneous buyers. Do not rely on Market fulfillment for
production until these workflows are completed.
