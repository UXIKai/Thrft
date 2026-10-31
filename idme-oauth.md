# ID.me verification on Thrft

Thrft uses ID.me’s **OAuth 2.0 authorization code** flow with real API parameters.

## Endpoints (local API)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/idme/config` | Public verification parameters (no secret) |
| GET | `/api/idme/authorize` | Builds authorize URL + CSRF `state` |
| GET | `/api/idme/callback` | ID.me redirect → token → attributes → PostgreSQL |
| POST | `/api/idme/callback` | Same exchange for SPA/popup clients |
| GET | `/api/idme/status` | Current verification record |

## Environment

Copy `.env.example` and set:

- `IDME_CLIENT_ID` / `IDME_CLIENT_SECRET` from [developers.id.me](https://developers.id.me)
- `IDME_REDIRECT_URI=http://127.0.0.1:8787/api/idme/callback` (register this exact URI)
- `IDME_SCOPE=fortified_identity` (or a scope your ID.me app is provisioned for)
- `APP_ORIGIN=http://127.0.0.1:5173`

Load env before starting the API, e.g.:

```bash
set -a && source .env && set +a
npm run server
```

## Flow

1. App calls `GET /api/idme/authorize`
2. Browser goes to `https://api.id.me/oauth/authorize?client_id&redirect_uri&response_type=code&scope&state`
3. User completes ID.me verification
4. ID.me redirects to `/api/idme/callback?code&state`
5. Server `POST`s `https://api.id.me/oauth/token` with `grant_type=authorization_code`
6. Server `GET`s `https://api.id.me/api/public/v3/attributes.json` with the access token
7. Profile is updated (`identityStatus`, `identityRef`/`uuid`, `legalName`, scope, groups)
8. User returns to the app with `?idme=verified`
