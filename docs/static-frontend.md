# Connect a static game through a backend

A static HTML, Three.js or Phaser game can keep its current frontend host. This kit's confidential-client account flow still needs a backend to hold secrets, validate identity and issue a session cookie.

Use one public HTTPS origin for both the game and its account routes. Your hosting platform can proxy `/api/me` and `/auth/*` to a backend you control. The browser should continue to request those relative paths. Configure the proxy to preserve the registered host and forward only trusted request metadata; never trust arbitrary incoming forwarded headers. Do not enable permissive cross-origin credential sharing to make a split-origin demo appear to work.

| Route | Behavior |
| --- | --- |
| `GET /api/me` | Minimal current-game session JSON; no tokens; no cache |
| `POST /auth/login` | Validate Origin, create browser-bound one-use transaction, redirect to approved issuer |
| `GET /auth/callback` | Validate signed identity and transaction, create opaque HttpOnly session, redirect to game |
| `POST /auth/logout` | Validate Origin, clear this game's session |

Serve the game document with a referrer policy that preserves the Origin on same-origin form submissions, such as `strict-origin`, as the demo does. Keep private account responses uncached and avoid exposing callback URLs through referrers. Test the actual browser and proxy path; a host-wide `no-referrer` policy can produce a null Origin and fail the deliberate POST checks.

The included `server.mjs` is a loopback development server. It refuses production mode because its store is process memory. Deploying it unchanged, putting it on a public tunnel as a permanent backend or copying `.env` into a static output directory is not a production integration.

Before release, implement durable TTL storage with atomic transaction consumption, secure cookies, HTTPS, abuse controls, session expiry and private-response cache rules. Register the exact callback URL for your game. Third-party consent stays in place. The [go-live checklist](go-live.md) lists the required review and validation. This guide describes the architecture; it does not provide a production adapter for a specific hosting vendor.
