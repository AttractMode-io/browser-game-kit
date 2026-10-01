Run a playable offline game and test account sign-in without credentials. Includes the backend OIDC adapter, Codex/Claude/Cursor/Gemini skills, optional read-only docs MCP, and deployment/security guidance.

Download **attract-mode-browser-game-kit.zip**, extract it, and run `npm ci --ignore-scripts` then `npm run dev`. Open the printed local URL. Node24 or later is required. SHA256SUMS.txt records the archive checksum.

This release's default login is a clearly labeled simulation. Real Attract Mode accounts require a separately approved OAuth client and HTTPS callback. The supplied development server uses memory and refuses production mode; follow the durable-storage checklist before deployment. No achievement, shared XP, payment or cloud-save API is provided.

Source: https://github.com/AttractMode-io/browser-game-kit
Docs: https://attractmode.io/docs

This update adds a shared browser account panel, Three.js startup and Phaser scene-lifecycle wiring, static hosting architecture and troubleshooting guides. The read-only MCP can search and read these guides. Tests cover UI state, stale responses and scene cleanup; rendering engines and a real approved client still need application-level validation.
