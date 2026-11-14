# Supabase profiles, Saved, and Leaderboard

Run `supabase/creator-pipeline.sql`, then `supabase/social.sql` in the Supabase SQL
Editor. The social migration is rerunnable, backfills existing Auth users, and
keeps public identity separate from private preferences.

`creator_profiles` stores usernames, display names, avatars, bios, and join dates.
An Auth trigger synchronizes identity changes. Historical duplicate handles get
a deterministic UUID suffix; new explicit usernames must be unique. Profiles
exist even when a member has no products. The public account API includes active
Store products with their full mockup and size metadata.

`creator_follows` stores unique follower/followed pairs and forbids self-follows.
`creator_public_profiles` computes Following and Followers counts from these
relationships. Authenticated users can insert/delete only their own follows.
The existing count layout remains unchanged.

`creator_saved_products` stores real listing IDs, their Store/Market source, and
the authenticated owner. The server reloads listing details instead of trusting
saved titles, prices, mockups, or variants. Bulk replacement uses a service-only
transactional RPC. Saved items cannot be read or modified for another account.
Deleted or no-longer-public products are omitted unless the viewer owns them;
checkout independently checks availability. Saving an ID cannot expose a
different member's private listing.

`creator_profile_preferences` stores private settings, including favorite brand
IDs. Favorites and saved products survive logout and work across devices.
Supabase errors are surfaced rather than disguised as successful local saves.

`creator_leaderboard` ranks the top ten creators by estimated gross product
margin on verified paid USD orders: retail revenue minus known Printful base
costs, before shipping, taxes, and payment fees. New order snapshots preserve the
creator and base cost; older orders use the listing's stored variant cost.
Orders without known costs do not contribute an invented profit. No demo
accounts or empty rank slots are generated. Existing circular placement,
avatars, glass styling, and spacing are retained; a rank opens its member page.

| Method | Route | Data |
| --- | --- | --- |
| GET | `/api/creator/accounts/:username` | Public identity, follow counts, active Store products |
| GET / PUT | `/api/creator/me/profile` | Authenticated private preferences |
| GET / PUT | `/api/creator/me/saved` | Authenticated saved products; PUT accepts `{ items: [{ id }] }` |
| GET | `/api/creator/leaderboard` | Real ranked identities and estimated margins |

Run `node --test tests/creator-pipeline.test.js` and `npm run build`.
