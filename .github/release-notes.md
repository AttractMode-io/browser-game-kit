Version 0.2.0 adds launch-foundation tooling. Connected integrations have breaking configuration changes; read docs/migration-0.2.md before upgrading.

Get your browser game listed, prepare real Attract Mode sign-in, or request a focused managed playtest with a clear next step.

This update adds:

- A developer onboarding guide covering listing, ownership, account integration and managed playtests as separate reviewed paths.
- Downloadable text and JSON request templates, including screenshots and media permission, exact callbacks, and multiplayer session requirements.
- An email fallback to hello@attractmode.io when an agent cannot use the interactive workspace.
- Review-status explanations, public-contact privacy guidance and a clear distinction between approval and actual delivery.
- Updated Codex, Claude Code, Cursor and Gemini CLI skill references. The optional read-only documentation MCP can read the onboarding guide and request template; it cannot submit requests or operate accounts.

Download **attract-mode-browser-game-kit.zip**, extract it, run `npm ci --ignore-scripts` and `npm run dev`, then open the printed local URL. Node.js 24 or later is required. **SHA256SUMS.txt** contains the archive checksum.

The default login remains an offline simulation. Real accounts require separately approved client registration, exact HTTPS callbacks, player consent and a production backend with durable transaction storage. Production requires the separately configured encrypted SQLite single-host store or an equivalent reviewed durable adapter. No achievement, shared XP, payment or cloud-save API is included.

A listing request does not grant ownership, a sign-in request does not issue credentials, and a playtest request does not recruit testers or authorize payment. Read the workspace review notes and fulfillment record for the actual outcome.

Source: https://github.com/AttractMode-io/browser-game-kit
Docs: https://attractmode.io/docs
Workspace: https://attractmode.io/developers

Stage 1 candidate additions: redacted `npm run doctor`, a locally bundled Three.js scene, bounded account lookups that never block guest gameplay, explicit browser/server package boundaries, and extracted-archive smoke checks. Connected clients require an active platform integration registry entry and a persistent server-only `AM_PLAYER_ID_KEY`; the adapter checks revocation and returns a game-scoped player ID. Deploy the matching platform registry before releasing this connected adapter. See `docs/account-integration.md` for migration requirements.
