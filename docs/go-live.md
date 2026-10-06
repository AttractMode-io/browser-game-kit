# From the demo to real player sign-in

## 1. Run the offline demo first

`npm ci --ignore-scripts`, then `npm run dev`. Open the printed 127.0.0.1 URL. Sign in and out and run `npm test`. No registration or credentials are required for this step. This is the fastest way to see the session boundary before changing your game.

## 2. Request your own client registration

[Submit your game or claim its page](https://attractmode.io/developers), then contact hello@attractmode.io with your game/studio URLs, backend stack, exact staging and production HTTPS `/auth/callback` URLs, requested account information and privacy/deletion policy. Do not send a password or secret. Start with the `openid` scope; this sample needs a stable subject, not an email address.

Page verification and OAuth registration are separate. A verified listing does not grant login integration, a studio claim does not claim every game, and a social login configured for another product cannot be reused. Attract Mode reviews the registration and supplies your own client configuration through an appropriate private channel. Player consent remains explicit for third-party games.

## 3. Try a connected development session

After registration, copy `.env.example` to `.env`. Set your approved `AM_GAME_ID`, client ID, client secret, persistent random `AM_PLAYER_ID_KEY` and the exact registered HTTPS redirect URI. Keep the player ID key unchanged across OAuth-secret rotations. Confirm the integration registry endpoint is live and your client is active. This file is ignored by Git. Keep it out of uploads, logs, screenshots, chats and browser bundles.

Run `npm run start:connected`. The server still listens on loopback. Put a trusted HTTPS reverse proxy in front of it for your registered development origin and preserve that origin's Host header. Forward `/`, the two static game assets, `/auth/*` and `/api/me`. Do not expose the raw loopback port publicly or trust arbitrary forwarded headers. Configure certificates and the registered domain normally; do not disable TLS checks.

The adapter uses the existing Attract Mode issuer's discovery metadata. The callback must match the registered HTTPS origin and `/auth/callback` exactly. Additional query parameters, fragments and wildcard callbacks are rejected. Test new/returning players and canceled consent with an approved account; mock success does not prove production works.

## 4. Move the adapter into your real backend

Import `configureAccountClient` and `createDemoHandler`; the integration guide shows the concrete interface. Serve the game with your framework and retain the backend account routes. Retain `(issuer, subject)` only in trusted backend identity records; use the derived `playerId` for game-facing records. The persistent key and game/environment namespace keep that ID stable and scoped. Keep email-based legacy account linking separate and require explicit proof of both accounts.

Use the included [single-host encrypted SQLite store](production-storage.md), or a reviewed shared store implementing `set`, `get` and **atomic one-use `take`** before production. Store transaction state, nonce and PKCE verifier server-side with a ten-minute expiry. A get-then-delete sequence is not atomic across workers. Encrypt sensitive data at rest, use trusted clocks and never log raw transaction, cookie or token contents.

Serve the game HTML with a referrer policy such as `strict-origin`, which omits URL paths while preserving a valid Origin on same-origin form POSTs. Chromium can send `Origin: null` for forms from a `no-referrer` document. Do not weaken CSRF checks to accept a null origin; the kit keeps private callback/API responses on `no-referrer`.

Set per-client/browser abuse limits and request-size/time limits in your hosting layer. Use Secure, HttpOnly, SameSite=Lax host cookies on the exact game origin, origin checks for mutations, no-store private responses and HTTPS. The sample game session lasts no longer than one hour or the identity token expiry, whichever comes first. Arrange revocation and deletion handling as part of registration. Local sign-out ends the game session only.

The supplied server fails production startup without connected mode, a private persistent database path and a session-encryption key. Follow the production-storage guide; ephemeral hosting is not supported by the SQLite adapter.

## 5. Verify before asking for the connected label

- Real client and every exact callback registered.
- New/returning login and each enabled social provider work.
- Third-party consent acceptance and denial behave correctly.
- Wrong state, nonce, issuer, audience, signature, expired/replayed code and parallel callback attempts fail.
- Signing out and switching accounts cannot show the previous player's data.
- Mobile Safari and Chrome tested against the actual HTTPS deployment.
- Secrets absent from built browser assets, logs, analytics and source control.
- Durable storage and atomic consume verified under multiple server instances.
- Privacy/deletion information and operational contact supplied.

Send the deployment URL and test evidence to the Attract Mode team. Listing, client registration and a connected badge are distinct steps. This starter does not create entitlements, award XP or collect payments.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Node syntax/engine error | Run `node --version`; use Node24 or later. |
| Port already in use | Stop the previous server or select another PORT; use the exact printed URL. |
| Demo has no score after reload | The practice score is tab-local, not an Attract Mode statistic. |
| Wrong host/origin | Open the printed127.0.0.1 URL in offline mode. For connected mode, the trusted proxy must preserve the registered HTTPS Host; don't disable origin checks. |
| Sign-in canceled or expired | Start a new flow from the game's sign-in button. Do not reuse the callback URL. |
| Unknown client or redirect | Confirm the approved client and exact callback with Attract Mode. Never borrow another game's credentials. |
| Signed out after server restart | Expected in the demo. Production requires durable session storage. |
| Static site cannot hide client secret | Add a backend-for-frontend. A build-time frontend variable does not protect a secret. |
| Progression credential missing | Request a separately scoped credential for an approved integration. Login alone does not authorize progression. Payments remain unavailable; never substitute internal website endpoints. |
