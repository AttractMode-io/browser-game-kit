# Browser and server boundaries

Copy only the browser helpers under `integrations/` into your frontend. Keep `account-client.mjs`, `demo-handler.mjs`, `.env` and the OIDC dependency on your trusted backend.

The package defines `./browser`, `./threejs` and `./phaser` browser entries. Its `./server` entry resolves only under Node's `node` condition. The account adapter also rejects execution where `window` exists. These are guardrails, not a replacement for inspecting the built bundle: direct-path imports and custom bundler rules can bypass package exports.

This kit is distributed through GitHub, not an advertised npm registry package. If you copy it into a monorepo, preserve its entry boundaries. Never put the client secret in a `VITE_`, `NEXT_PUBLIC_` or other browser-exposed variable. A public project ID, Origin header or browser-held token cannot prove an achievement was earned.

Use issuer and subject as the backend account key. Do not expose a provider's internal account identifier as a public game profile, merge by email, or treat login as permission to access another game's data. A game-scoped player API must be separately documented and enabled before you call it.
