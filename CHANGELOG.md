# Changelog

## 0.3.0 Progression early access

- Added private-session progression bridge, server-only scoped transport, revisioned save client and explicit conflict handling.
- Added game XP, achievements, history and provenance-separated leaderboard client methods and accessible UI components.
- Added persistent single-host puzzle validation with atomic event/outbox storage, restart recovery and retry acknowledgement.
- Added progression integration documentation and read-only MCP discovery.
- Requires matching platform migrations, reviewed enablement and separately issued scoped credentials. Available only to approved integrations with scoped credentials; external hosted pilot remains outstanding.
- No global reputation, payment or competitive reward is inferred from browser assertions.

## 0.2.0 Stage 1 foundation

- Added encrypted durable single-host sessions and a human local consent UI.
- Breaking: connected configuration now requires expected game ID and a persistent player-ID key; see docs/migration-0.2.md.
- Added reproducible isolated local Supabase OAuth protocol tests with disposable identities.
- Added real locally bundled Three.js scene and active-registration enforcement with scoped player IDs.
- Added redacted local/optional public-connectivity doctor with explicit registration checks.
- Added browser/server package boundaries and session lookup cancellation/timeouts.
- Added extracted ZIP smoke checks and documentation MCP guides.
- Connected mode rejects unsupported environments; offline simulation is not a hosted sandbox.

## 0.1.2 - 2026-10-05

- Complete listing, sign-in and managed-playtest onboarding guide, portable request templates and honest review-status explanations.
- Agent skill and read-only MCP include the intake checklist without adding submission permissions.

## 0.1.1 - 2026-10-01

- Browser account panel with native same-origin sign-in forms and safe teardown.
- Three.js startup and Phaser scene lifecycle wiring examples.
- Static frontend/backend architecture and troubleshooting guides.
- Tests for panel states, stale responses and scene cleanup. Engine rendering and live client registration remain application-level validation.

## 0.1.0 · September 29, 2026

Initial standalone public release.

- Playable offline browser game and signed simulated OIDC login.
- Backend account adapter and registered-client development path.
- Codex, Claude Code, Cursor and Gemini project skills.
- Optional read-only local MCP for documentation and capabilities.
- Security tests, registration checklist and deployment guidance.

Live client registration is reviewed separately. Achievements, shared XP, payments and cloud saves are not third-party APIs in this release.
