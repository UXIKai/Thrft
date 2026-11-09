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

### Profile settings
- Garment sizes use equal-sized buttons in centered rows, with the add-size control centered below them.
- The settings gear beside the profile name opens only Profile, Settings & privacy, QR code, and Notifications. Profile opens the full-page editor; QR code encodes the account username, and Notifications explains chat alert controls and current push availability.
- On wide screens, the gear menu opens to the right with its top aligned to the button's center; narrow screens keep it below the name.
- The gear menu renders outside the profile scroll container so its rounded edges are not clipped, and stays within the viewport when scrolling or resizing.
- The profile shows only the username. Account editing keeps the person, @ and lock icons for username, email and password; email changes require authentication-provider confirmation.
- Music and Media appear above Money, forming centered rows that widen toward the bottom.
- Money controls and sales statistics use matching tile sizes, spacing, and glass styling.

Settings & privacy starts with Profile followed by the active account. Other account and support options come next, followed by colors, sliders, and the four shop-tool buttons at the bottom.
Links and Money rows sit immediately below ID verification. Profile contains only username, email and password; Links contains Music and Media; Money contains the financial controls. Each page centers its content, retaining scrolling on shorter screens.

### Chat
- Pinned chats appear first in the regular conversation list, without separate pinned cards. The Messages heading sits in the upper-left corner with search and the desktop sidebar toggle on the right. Search opens the bottom input; the bottom plus opens a chooser with two-person group and one-person friend buttons. Collapsing leaves only the top-left toggle to restore the list.
- Opening a conversation does not automatically focus the message field or summon the keyboard.
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
