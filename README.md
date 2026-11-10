# ThrfT.TOP — Home DNA prototype

Mobile-first home screen: staggered two-column DNA field of **profile slots**, ordered by mock profit (most → least). Motion is **rank-swap only**.

## Run

```bash
cd prototype/home-dna
npm install
npm run server   # SQLite API + ID.me OAuth on :8787
npm run dev      # Vite UI (proxies /api → :8787)
```

Open the URL Vite prints (e.g. `http://localhost:5173`). Use a phone viewport (~390×844).

Do **not** open `index.html` directly as a file — the page needs the Vite/React server. A blank/white screen usually means the app isn’t being served via `npm run dev`.

### ID.me verification

Copy `.env.example` → `.env`, set `IDME_CLIENT_ID` / `IDME_CLIENT_SECRET`, register the redirect URI, then restart the API. Details: [`docs/idme-oauth.md`](docs/idme-oauth.md).

## Profiles

Each circle is an account slot:

- `avatarUrl: null` → empty ring (waiting for a real profile)
- `avatarUrl: '…'` → filled circular avatar

Wire real profiles later by setting `avatarUrl` (and labels) on entries in `src/profiles.js` or via your data layer.

## Layout & motion

Create → Closet → camera chooser includes a centered plus button between Camera and Gallery. It opens a centered brand wheel; tapping the wheel expands a list with a bottom search field. Continue opens centered P/N Number and O/N Number fields (at least one is required). Matching products offer color choices; selecting one downloads its photo, removes the background with the existing scanner, and saves the cutout and color to Closet.

Product-number lookup requires a real catalog: set `THRFT_PRODUCT_CATALOG_PATH` on the API server to a JSON array of records shaped like `{"brand":"Nike","partNumber":"…","orderNumber":"…","title":"…","category":"Tees","price":"30","variants":[{"color":"Black","imageUrl":"https://…"}]}`. Numbers are exact, brand-scoped matches, and both must match when both are supplied. Use only a catalog you are authorized to expose to signed-in users; do not include private order data. Image hosts must permit browser CORS downloads. No manufacturer catalogs are bundled or connected automatically; an unconfigured lookup reports that explicitly and leaves Camera/Gallery available.

Home has equal-width, filled storefront (Store, left) and basket (Market, right) icon tabs with labels underneath between the leaderboard and product cards, spanning the mobile screen. Store (the default tab) shows the Supabase listings cards in scrolling rows. Market shows active catalog products from `/api/products` plus three sample products per demo brand, labeled Sample in their product details. Market uses a three-column grid with automatic rows that grows vertically with the number of products, without repeating cards to fill space. Brand, category, and color filters apply to the sample products too.

The navigation's outer track uses a clear vertical sheen, 8px blur with brightness/contrast enhancement, asymmetric white rim highlights, and a soft drop shadow. The active bubble uses the quieter clear finish with a faint neutral edge and light blur. Mobile bubble spacing remains unchanged.

Tab changes use a physical spring (stiffness 420, damping 26, mass 0.9), with a 0.92 press squish, a 1.12-by-0.94 release stretch, and a synchronized 1.15 icon pop. Dragging follows the finger directly before springing into the selected slot; reduced-motion mode disables these animations.

Home color search previews the chosen color behind the card, starting white for All, with the flowing atmosphere enabled. The card is black except for Black-family shades, which use a white card to keep the selected-color text visible. Confirming a search or selecting an orbital color applies that exact app background color and enables the effect. App text follows that color's brightness: bright colors get black text and dark colors get white text (WCAG luminance); other backgrounds use the half-moon display mode. The reset button at the bottom right of the card clears the color. Switching from Home to another navigation tab clears the color filter and tint, restoring the neutral background and saved display mode.

The product quantity number opens a selected-products page with the quantity at the top and each unit's selected size beneath its product name. Clicking a product container opens a screen showing only centered sizes; tapping a size only selects it; the bottom check mark saves it for that unit (quantity unchanged) and returns to the list. Tap outside the sizes or press Escape to cancel. Both pages close with a check mark at the bottom center (no top back button). Size selections persist in the bag.

### Profile settings
- Tapping the profile photo pops it up full-size with a camera icon centered at the bottom that opens the system photo picker; tap outside or press Escape to close. There is no camera badge on the avatar.
- Garment sizes use equal-sized buttons in centered rows, with the add-size control centered below them.
- The settings gear beside the profile name opens Settings & privacy directly, without an intermediate popup.
- A half-moon button beside the narrower Profile control switches between dark (white on black) and light (black on white) display modes. The choice persists on this device. Neutral UI colors follow the mode without inverting photos or brand colors; color previews choose their own readable contrast.
- The profile shows only the username. Account editing keeps the person, @ and lock icons for username, email and password; email changes require authentication-provider confirmation.
- The Links editor has one centered Media heading above the music-service buttons and social-media buttons.
- Money controls and sales statistics use matching tile sizes, spacing, and glass styling.

Settings & privacy starts with Profile followed by the active account. Other account and support options come next, followed by colors, sliders, and the four shop-tool buttons at the bottom.
Links and Money rows sit immediately below ID verification. Profile contains only username, email and password; Links contains music services and social handles under Media; Money contains the financial controls. Each page centers its content and section headings above the controls, retaining scrolling on shorter screens.

### Chat
- Focusing conversation, friend, or group-member search opens the keyboard without lifting the whole page; only the search dock moves above the keyboard.
- Friend and group-member searches query registered accounts by username or display name; demo contacts and locally saved names are never search suggestions. New group members retain their actual usernames for profile navigation.
- Group-member names open the member's public account page with username, avatar, joined date, verification, Following/Followers, and active Store listings. Settings, Orders, and Closet remain private. Following/follower counts currently show unavailable placeholders, matching the owner's profile; follower tracking is not implemented.
- Profile has labeled Store, Closet, and Market tabs using the same filled icons as Home. Market shows your own Supabase listings with Active/Sold filters.
- Create has labeled Store, Closet, and Market tabs at the top. Store posts a photo, title, brand, type, price, and description to your brand store (`POST /api/products`, segment `store`, sign-in required). Closet scans an item into your closet. Market posts a personal Supabase listing with condition.
- Pinned chats appear first in the regular conversation list, without separate pinned cards. The Messages heading sits in the upper-left corner with search and the desktop sidebar toggle on the right. Search opens the bottom input; the bottom plus opens a chooser with two-person group and one-person friend buttons. Collapsing leaves only the top-left toggle to restore the list.
- Opening a conversation does not automatically focus the message field or summon the keyboard.
- Opening chat search rotates the bottom plus into an X around a fixed center; closing clears search and rotates it back in the same position. The sidebar heading reads Chats. When search is closed, the plus opens the new-chat chooser.
- Hold a chat for 450ms to open Pin, Mark as Unread, Hide Alerts, and Delete actions. Moving or releasing early cancels the hold; unread and alert preferences persist with the chat.
- Holding also shows a scrollable preview of recent messages above the actions, without opening or marking the conversation as read.
- The edit menu sits above the list. Select shows selection circles and a bulk-delete button below the filter. Edit pins shows minus controls on pinned row avatars to unpin chats without deleting them; the check mark finishes editing.
- The filter menu matches the edit menu's compact 140px width, 34px minimum row height and 12px corners, with aligned icons, wrapping labels and a dark blurred surface.
- During chat selection, the edit button becomes a check mark that finishes selection without deleting chats.
- Desktop chat uses the full window width, with a left-aligned conversation list and the open conversation filling the remaining space.
- Focusing desktop chat search keeps the page in place; keyboard lifting is reserved for touch-primary devices or a visible software keyboard.
- Phone layouts continue to show the conversation list or the open conversation one at a time.

### Leaderboard
- **Zig-zag formation:** 5 empty rings left + 5 right under Thrft●.
- Climb swaps orbit around each other (yin-yang), opposite-side only.

### Product rows
- The orbital color picker displays the focused color's name on a contrasting center: white for dark colors and black for bright colors. Its controls and surrounding labels also switch contrast with the preview, independently of the saved app theme.
- The orbital's top safe area and browser theme color stay matched to the focused color, independent of the drifting background. Closing the orbital restores the app's background.
- The orbital center's eclipse glow stays lit while browsing and dragging, matching the hovered color in the color picker and remaining white in other pickers.
- The home search backdrop reuses the app's flowing atmosphere at 70% brightness behind the always-black filter panel. Choosing a color updates the backdrop, its flowing effect, and the panel text to that color; the panel itself does not animate.
- Saved edit and filter menus open below their buttons, close each other, and dismiss when clicking outside.
- A check mark below the product quantity returns to the previous page, including the cart, brand or clothing-type page when opened there.
- Open products show the brand above the image, then the title and price below it. The plus reveals a centered four-column size picker with a smooth expansion.
- Product titles omit a repeated leading brand name below the image.
- 10 brand rows × 10 product boxes (mock codes/prices).
- Vertical scroll progress `p = scrollTop / maxScroll` moves each row horizontally:
  - even rows → left (`translateX(-p · 120px)`)
  - odd rows → right (`translateX(+p · 120px)`)
- Scroll-linked only (not autonomous marquees).

## Notes

- Bubble **size is fixed**; rank order is by money made.
- Brand logos / stock photos are intentionally omitted in favor of empty profile rings.
