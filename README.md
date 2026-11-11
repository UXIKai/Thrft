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

Store creation includes a Materials text field saved with the product. The Information view shows only the material details without a heading, title/brand, or description. Tap the material details to return to the sizes. Apply the updated Prisma schema with `npm run db:push` and regenerate the client with `npm run db:generate` when deploying this field.

The Money editor includes the Diaita Group Initiative pledge controls below its other content. Settings links to Money with a bank icon; Give Back is no longer a separate Settings section.

Changing navigation tabs resets Home Brand, Color, and Category filters to All. Clearing a Home color search restores the background that preceded the search, including its contrast and wallpaper, instead of forcing a neutral light background.

The inline Store size header shows only the current EN or EU metric in numeric mode. The page's top-right action reads `123` while displaying letters and `Aa` while displaying numbers; EN/EU is hidden in letter mode. Letter switching is available when equivalent letter labels exist (footwear without letter equivalents stays numeric). General apparel equivalents use a chest-size chart, with product-specific conversions taking precedence.

Store plus buttons expand an inline size panel beneath the product, keeping its photo, title, and price visible, with an EN/EU display toggle and Information view for materials. The main plus rotates smoothly into an X and back without changing position; reduced-motion preferences disable the rotation animation. Product `sizeConversions` override the general footwear chart; unconverted labels stay unchanged. Bag selections retain the original size value. Materials are shown only when supplied, otherwise explicitly marked unavailable.

Market product details show the seller's title, brand, category, price, condition, and description beneath the photo, without Store size/quantity selectors. Brand/category values have no parenthetical labels and are not added to feed tiles. Market items add directly to the bag; Store sizing is unchanged.

Brand orbital tiles are circular, with uncropped logo images sized to fit completely inside them. The selected brand's center circle automatically matches solid square source-logo backgrounds by inspecting opaque, similarly colored image corners. Logo images use a same-origin proxy so pixel inspection works. Transparent/non-square marks, the empty search circle, and failed logo loads retain white backgrounds.

The brand picker has no bottom search bar: tap the empty center circle to type a brand name, then finish typing to preview and select the match. Opening search preserves the canvas dimensions and focuses without scrolling so the keyboard does not shift the circle. The standalone back button still closes the picker.

Brand orbitals show website logos instead of text for the orbiting brands and centered selection, while searching still matches brand names. They use a black background, a white center circle, and evenly spaced 42px white logo tiles without added dark outlines. Drag the canvas directly with one finger and pinch with two fingers to zoom (55%-200%); trackpad pinch also zooms. The canvas stays where released. Move a brand into the center and tap the center to select, or press the center first, drag toward a brand to bring it into the seat, and release to select it. Drags started outside the center never select on release; adding a second finger cancels release-selection. Returning to the starting middle or an empty gap clears the selection. Rings grow with the catalog rather than squeezing logos together. Unknown brands and failed logo loads retain readable names. Category, color, and account orbitals keep their existing labels and appearance.

Product brand headings open a brand page containing every active catalog product and available marketplace listing for that brand. Catalog queries are brand-filtered without the home-feed cap; marketplace listings are paged through completely before brand matching. Sold/unlisted items and mock Market previews are excluded.

Create → Closet removes the photo background with the AI scanner, crops transparent margins, and respects camera orientation. Failed scans display an error rather than saving a rough color-key replacement. The Straighten slider corrects angled photos; size adjustments keep the complete cutout inside the frame, and the saved image matches the preview.

Create → Closet → camera chooser includes a centered plus button between Camera and Gallery. It opens a centered brand wheel; tapping the wheel expands a list with a bottom search field. Continue opens centered P/N Number and O/N Number fields (at least one is required). Matching products offer color choices; selecting one downloads its photo, removes the background with the existing scanner, and saves the cutout and color to Closet.

The closet lookup brand wheel and searchable list show the published website icons for all 106 named built-in brands, retrieved through Google's favicon service using official website domains from `brandLogos.js`. Logos use a 40px column beside larger brand names, with 60px wheel spacing for clear alignment. Brand names remain visible and accessible. Other/custom brands have no assumed logo; failed image loads keep the name and log a warning. Logo delivery requires internet access.

Product-number lookup requires a real catalog: set `THRFT_PRODUCT_CATALOG_PATH` on the API server to a JSON array of records shaped like `{"brand":"Nike","partNumber":"…","orderNumber":"…","title":"…","category":"Tees","price":"30","variants":[{"color":"Black","imageUrl":"https://…"}]}`. Numbers are exact, brand-scoped matches, and both must match when both are supplied. Use only a catalog you are authorized to expose to signed-in users; do not include private order data. Image hosts must permit browser CORS downloads. No manufacturer catalogs are bundled or connected automatically; an unconfigured lookup reports that explicitly and leaves Camera/Gallery available.

Home has equal-width, filled storefront (Store, left) and basket (Market, right) icon tabs with labels underneath between the leaderboard and product cards, spanning the mobile screen. Store (the default tab) shows the Supabase listings cards in scrolling rows. Market shows active catalog products from `/api/products` plus three sample products per demo brand, labeled Sample in their product details. Market uses a three-column grid with automatic rows that grows vertically with the number of products, without repeating cards to fill space. Brand, category, and color filters apply to the sample products too.

The navigation's outer track uses a clear vertical sheen, 8px blur with brightness/contrast enhancement, asymmetric white rim highlights, and a soft drop shadow. The active bubble uses the quieter clear finish with a faint neutral edge and light blur. Mobile bubble spacing remains unchanged.

Tab changes use a physical spring (stiffness 420, damping 26, mass 0.9), with a 0.92 press squish, a 1.12-by-0.94 release stretch, and a synchronized 1.15 icon pop. Dragging follows the finger directly before springing into the selected slot; reduced-motion mode disables these animations.

Home color search previews the chosen color behind the card, starting white for All, with the flowing atmosphere enabled. The card is black except for Black-family shades, which use a white card to keep the selected-color text visible. Confirming a search or selecting an orbital color applies that exact app background color and enables the effect. App text follows that color's brightness: bright colors get black text and dark colors get white text (WCAG luminance); other backgrounds use the half-moon display mode. The reset button at the bottom right of the card clears the color. Switching from Home to another navigation tab clears the color filter and tint, restoring the neutral background and saved display mode.

The product quantity number opens a selected-products page with the quantity at the top and each unit's selected size beneath its product name. The cart quantity number opens the same page; its bottom check mark returns directly to the cart. Clicking a product container opens a screen showing only centered sizes; tapping a size only selects it; the bottom check mark saves it for that unit (quantity unchanged) and returns to the list. Tap outside the sizes or press Escape to cancel. Both pages close with a check mark at the bottom center (no top back button). Size selections persist in the bag.

Name, username, and profile photo edits are saved to Supabase user metadata when Supabase authentication is configured, so new sessions retain them. Photos use the `avatar_url` metadata field read during sign-in. Local API identity saves must succeed remotely; they do not silently fall back to device-only storage. Photo save failures are displayed without replacing the existing photo.

While signed in, browser back preserves the current app page, rather than revisiting the sign-in screen. Edge touch swipes are canceled on both sides during event capture, before page controls handle them, including on Create. Browser/OS gestures that cannot be canceled remain platform-controlled. Explicit sign-out and expired sessions still require authentication.

### Profile settings
- Settings has a centered title with the back button at the far left of its header. The Profile control sits below at its original width, with the moon toggle on its right.
- Choosing a black or near-black Background swatch/custom color turns off the dark-mode toggle and saves that preference. The chosen background stays black, with automatic white text for contrast; Home search colors do not change the saved theme.
- A Dim–Bright slider below Short–Tall controls app brightness live and persists on this device. Bright preserves the normal appearance; Dim adds a screen-wide dark overlay without changing the theme or device brightness.
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
- Store tabs use a registered-trademark symbol; Store and Market tabs are icon-only on Home, Profile, and Create, with accessible names retained. Closet keeps its visible label. Market shows your own Supabase listings with Active/Sold filters.
- Create has Store, Closet, and Market tabs at the top. Store posts a photo, title, brand, type, price, and description to your brand store (`POST /api/products`, segment `store`, sign-in required). Closet scans an item into your closet. Market posts a personal Supabase listing with condition.
- Pinned chats appear first in the regular conversation list, without separate pinned cards. The Chats heading is centered above the list, with search and the desktop sidebar toggle on the right. Search opens the bottom input; its plus opens a chooser with two-person group and one-person friend buttons. Collapsing leaves only the top-left toggle to restore the list.
- Opening a conversation does not automatically focus the message field or summon the keyboard.
- The new-chat plus appears only inside the open search bar, not as a standalone button at the bottom of Chats. The left search icon closes and clears the search. The sidebar heading reads Chats.
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
