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
- The pencil editor opens full-page, with account fields and settings centered in a column capped at 460px.
- Music and Media appear above Money, forming centered rows that widen toward the bottom.
- Money controls and sales statistics use matching tile sizes, spacing, and glass styling.

### Chat
- The desktop sidebar toggle sits above pinned chats; search remains at the bottom. Collapsing hides the sidebar rail, leaving only the top-left toggle to restore the list.
- Opening a conversation does not automatically focus the message field or summon the keyboard.
- Hold a chat for 450ms to open Pin, Mark as Unread, Hide Alerts, and Delete actions. Moving or releasing early cancels the hold; unread and alert preferences persist with the chat.
- Holding also shows a scrollable preview of recent messages above the actions, without opening or marking the conversation as read.
- The edit menu sits between pinned chats and the list. Select shows selection circles and a bulk-delete button below the filter. Edit pins shows minus controls on pinned avatars to unpin chats without deleting them.
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
