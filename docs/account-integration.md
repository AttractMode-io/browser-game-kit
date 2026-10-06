# Browser-game account sample

A backend adapter for **optional third-party Attract Mode sign-in**, adapted from False Start's existing `openid-client` integration. It uses the current Attract Mode issuer and discovered endpoints. It does not create a second Attract Mode account, register a client, enable first-party consent bypass or imply that your integration has been approved.

The smallest scope is `openid`: this sample needs a stable account subject, not email. Use `(issuer, subject)` as the game-account key. Request `profile` only for a concrete approved display-name/avatar need; request email only when separately justified. Never merge an existing game account merely because its email matches.

## Run and test locally

From this kit's root, use Node24 or later:

```sh
npm ci --ignore-scripts
npm test
npm run dev
```

Open http://127.0.0.1:3000 for the playable offline simulation. Tests exercise signed OIDC, state, PKCE, nonce, replay, expiration, sessions and logout without a real account. For the registration and deployment steps, read [Go live](go-live.md).

## Registration checklist

Contact hello@attractmode.io with:

- Your existing game and studio listing URLs, verified representative and actual game URL.
- Exact production and staging HTTPS callback URLs ending in `/auth/callback`. No wildcards, URL fragments, credentials or extra query parameters. Development HTTPS origins require separate registration too.
- The backend stack and storage design; why each requested scope is needed.
- Privacy and deletion policies, local logout behavior and account-linking policy.
- Who operates the deployment and can receive integration incident notices.

Attract Mode separately registers the OAuth client and its exact callbacks in both the issuer and Attract Mode's consent allowlist. A verified page claim is **not OAuth approval**. A studio claim is not automatic authority over every game. Do not reuse False Start's client ID, secret, first-party setting or another developer's callback.

## Backend wiring

`account-client.mjs` uses the existing `openid-client` dependency (6.8.8 in this project). Supply only operator-provided configuration on your server:

```js
import {configureAccountClient} from './account-client.mjs';
import {createDemoHandler} from './demo-handler.mjs';

const client = await configureAccountClient({
  clientId: process.env.AM_GAME_CLIENT_ID,
  clientSecret: process.env.AM_GAME_CLIENT_SECRET,
  redirectUri: 'https://your-registered-game.example/auth/callback'
});
const handle = createDemoHandler({client, store: productionStore});
// Pass real Request objects for the game's /auth/* and /api/me routes.
```

The concrete server handler has these routes:

- `POST /auth/login`: exact Origin required, creates a random state/nonce/PKCE verifier in a ten-minute transaction, binds it to a Secure HttpOnly SameSite=Lax host cookie, redirects to the discovered authorization endpoint. Start with a same-origin HTML form or fetch, not an iframe or a script that grabs account cookies.
- `GET /auth/callback`: exact registered URL, single parameters, correct browser binding/state and expiry; consumes the transaction atomically before exchanging the code. The library verifies issuer, audience, nonce, expiry and ES256 signature against issuer keys. Tokens remain inside the backend adapter.
- `GET /api/me`: reads the game's opaque session cookie and returns only that account's stable issuer/subject. It never returns access/refresh/ID tokens.
- `POST /auth/logout`: exact Origin required; removes only this game's session. It does not log the player out of Attract Mode or other games.

The sample game session expires at the earlier of the ID-token expiry and one hour. After it expires, start a new authorization flow. Attract Mode may already have the player's session, but **third-party authorization remains explicit**. Do not add `prompt=none`, an internal consent bypass, password collection or cross-domain cookie access.

### Production store and deployment requirements

The provided bounded in-memory store is for tests/demo only. Implement `set(key,value,expires)`, `get(key)` and **atomic one-use `take(key)`** in server-only durable TTL storage before deploying. Use consistent clocks, encrypted sensitive transaction storage, no request/body/token logging, trusted HTTPS proxy configuration and a deployment-specific secret system. Keep secure cookies on the exact game origin. Never expose the client secret or verifier to a bundle, URL, localStorage or analytics.

Add backend rate limits for login/callback and a strict server session timeout. Clear sessions on account deletion/revocation according to the agreed contract. For multi-instance deployments, a process-local Map cannot prevent replay across instances. Load configuration at server startup and fail closed on discovery failure; do not fall back to another issuer.

The sample intentionally does not provide a new static browser SDK. A purely static game needs an approved backend-for-frontend to keep the confidential client secret and session safe. No paid service or new credentials are required to run the mock.

## Measurement and capability contract

A catalog Play click means a visitor clicked the outbound link. It is not evidence of gameplay, a completed session, hours, XP, purchases or retention. A successful OAuth sign-in proves an identity grant, not that the player played. A verified claim proves scoped page authority, not access to platform users or revenue.

Future gameplay reporting needs a separate approved event contract: game/client identity, player consent, server-verifiable event source, event IDs and replay protection, timestamps/duration bounds, abuse controls, retention/deletion and explicit platform authorization. Client-supplied XP or claimed hours must never directly change a platform balance. Do not invent endpoints for achievements, entitlements, billing or shared saves. None is granted by this sample.

Before a Connected badge, submit evidence for real registration, new/returning login, enabled social providers, consent acceptance/denial, account switching, mobile Safari/Chrome, expired/replayed authorization and logout. This kit's mock tests are **not** a completed third-party pilot.

## Tiny playable page

Serve `index.html`, `game.mjs` and `sample.css` from the registered game's HTTPS origin, alongside the Request handler routes above. The target-click game runs even when logged out. It reads `/api/me` to show connection status and uses same-origin POST forms for login/logout. Its hit counter is tab-local practice only. This makes the distinction between gameplay and account integration visible without inventing platform XP or storage APIs.

## Registry and game-scoped player identity

The Stage 1 candidate adapter checks `GET https://attractmode.io/api/integration-status?client_id=...` before starting login, after callback verification and before serving an authenticated `/api/me`. This public status check contains no player information. Revoked, inactive, wrong-environment and unreachable registrations fail closed; guest gameplay remains available. Deploy this adapter only after the corresponding registry endpoint is live and your registration is active. Do not skip that check in production to make an unregistered client work.

Configure a persistent random `AM_PLAYER_ID_KEY` on the backend, independent from your OAuth secret. The adapter derives a stable player ID with HMAC-SHA256 over game, environment, issuer and provider subject. Connected `/api/me` returns the game-scoped ID rather than the provider subject. Back up this key securely. Rotating it changes IDs and requires an explicit migration, while rotating the OAuth secret does not. This mapping identifies a player; it is not evidence of earned XP or achievements.
