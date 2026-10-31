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

### Leaderboard
- **Zig-zag formation:** 5 empty rings left + 5 right under Thrft●.
- Climb swaps orbit around each other (yin-yang), opposite-side only.

### Product rows
- 10 brand rows × 10 product boxes (mock codes/prices).
- Vertical scroll progress `p = scrollTop / maxScroll` moves each row horizontally:
  - even rows → left (`translateX(-p · 120px)`)
  - odd rows → right (`translateX(+p · 120px)`)
- Scroll-linked only (not autonomous marquees).

## Notes

- Bubble **size is fixed**; rank order is by money made.
- Brand logos / stock photos are intentionally omitted in favor of empty profile rings.
