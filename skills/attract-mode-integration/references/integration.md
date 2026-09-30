# Integration contract

Verified against the kit shipped September 29, 2026. Check the current release before assuming a new capability exists. Official source: https://github.com/AttractMode-io/browser-game-kit. Platform: https://attractmode.io/developers.

## What is available

The kit supplies a backend OpenID Connect authorization-code adapter using PKCE. A registered third-party game redirects the player to Attract Mode for authentication and explicit authorization. Enabled social providers belong to Attract Mode; the game does not collect those passwords. Availability of a provider must be checked in the actual login flow, not promised from this sample.

Local mock login requires no real account or secret. Production client registration is reviewed separately from claiming a catalog page. Registration contact: hello@attractmode.io. Include game/studio listing, verified representative, production/staging origins, exact HTTPS callbacks, minimal requested scopes, privacy/deletion rules and incident contact. The platform registers the client and exact callbacks in the issuer and consent allowlist.

## Adapter routes

| Route on the game's backend | Behavior |
| --- | --- |
| POST /auth/login | Same-origin request; state, nonce and PKCE; ten-minute transaction; Secure HttpOnly SameSite=Lax browser-binding cookie. |
| GET /auth/callback | Exact registered URL; single parameters; matching state/browser/expiry; atomically consumes transaction before exchanging code and verifying issuer, audience, signature, nonce and expiry. |
| GET /api/me | Opaque game session to minimal account identity; never returns access, refresh or identity tokens. |
| POST /auth/logout | Same-origin request; deletes this game's session only. |

These are routes implemented by the sample inside the developer's game. They are not undocumented platform API endpoints. Use issuer discovery through account-client.mjs. Do not construct a custom authorization endpoint or change the trusted issuer.

Use openid as the minimal scope. Add profile or email only for an approved need. Identity key is the pair (issuer, subject), not username or email. Third-party consent is required, even when the player already has an Attract Mode session. Do not copy an in-house client's credentials or consent exception, use prompt=none or scrape cross-domain cookies.

## Storage and deployment

The in-memory store is demo-only. Implement set(key, value, expires), get(key) and atomic one-use take(key) in durable server-only TTL storage shared by all instances. Bound its size, encrypt sensitive transaction data and expire unused transactions. Keep secure cookies and trusted HTTPS configuration; never expose secrets or tokens to URLs, logs, localStorage, analytics or browser bundles. Add login/callback rate limits. Load configuration at startup and fail closed when discovery fails.

The game session expires at the earlier of identity-token expiry and one hour. Expiry starts a fresh authorization flow. Local logout does not sign the user out of other games. Confirm deletion/revocation handling as part of registration. A production connection needs real-browser checks for new and returning users, authorization denial, switching accounts, expired/replayed callbacks, mobile Safari/Chrome and logout.

## Capability boundaries

Available on the Attract Mode website: catalog game/studio pages, reviewed ownership claims and corrections, private game saves/studio follows, moderated reviews and scoped developer measurement. These site features do not grant API access or player information to an arbitrary game.

Not provided as third-party APIs in this kit: achievements, shared XP, playtime reporting, payments, subscription entitlements, revenue sharing, cloud saves or in-game community. A click is not gameplay; a login is not playtime; browser-submitted XP is not trusted. Do not synthesize endpoints or present roadmap items as released capabilities.
