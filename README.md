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

Home has equal-width Market and Store tabs between the leaderboard and product cards, spanning the mobile screen. Market browses personal Supabase listings; Store browses active brand-store products. Each feed uses only its own products, including when personalizing or showing empty results.

Home color search previews the chosen color behind the card, starting white for All, with the flowing atmosphere enabled. The card is black except for Black-family shades, which use a white card to keep the selected-color text visible. Confirming a search or selecting an orbital color also saves that exact app background color and enables the effect.

The product quantity number opens a selected-products page with the quantity at the top and each unit's selected size beneath its product name. Clicking a product container opens a screen showing only centered sizes; choosing one updates that unit without changing the quantity and returns to the list. Tap outside the sizes or press Escape to cancel. Size selections persist in the bag.

### Profile settings
- The profile-photo chooser uses one camera icon to open the system photo picker, with a centered close X at the bottom of the screen.
- Garment sizes use equal-sized buttons in centered rows, with the add-size control centered below them.
- The settings gear beside the profile name opens Settings & privacy directly, without an intermediate popup.
- A half-moon button beside the narrower Profile control switches between dark (white on black) and light (black on white) display modes. The choice persists on this device. Neutral UI colors follow the mode without inverting photos, brand colors, or the always-black color-selection centers.
- The profile shows only the username. Account editing keeps the person, @ and lock icons for username, email and password; email changes require authentication-provider confirmation.
- The Links editor has one centered Media heading above the music-service buttons and social-media buttons.
- Money controls and sales statistics use matching tile sizes, spacing, and glass styling.

Settings & privacy starts with Profile followed by the active account. Other account and support options come next, followed by colors, sliders, and the four shop-tool buttons at the bottom.
Links and Money rows sit immediately below ID verification. Profile contains only username, email and password; Links contains music services and social handles under Media; Money contains the financial controls. Each page centers its content and section headings above the controls, retaining scrolling on shorter screens.

### Chat
- Focusing conversation, friend, or group-member search opens the keyboard without lifting the whole page; only the search dock moves above the keyboard.
- Friend and group-member searches query registered accounts by username or display name; demo contacts and locally saved names are never search suggestions. New group members retain their actual usernames for profile navigation.
- Group-member names open the member's public account page with username, avatar, joined date, verification, Following/Followers, and active Store listings. Settings, Orders, and Closet remain private. Following/follower counts currently show unavailable placeholders, matching the owner's profile; follower tracking is not implemented.
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
- The orbital color picker keeps its center circle black and displays the focused color's name in that color. Its flowing background previews each focused color at 70% brightness while gliding.
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
