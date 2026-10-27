---
name: attract-mode-progression-integration
description: Connect a browser game to Attract Mode achievement events, reliable personal progress and optional UI using the current kit contract.
---

# Attract Mode Progression Integration

Read the installed kit's docs/achievements.md and the project's current account integration first. Reuse authenticated game-scoped sessions and exact Origin checks. Public browser code uses integrations/achievements.mjs; achievements-server.mjs and am_pg_ credentials stay on the trusted backend. Do not expose event.submit through a browser bridge.

Send semantic events with stable eventId, occurrenceId and buildId, never client-supplied XP or identity authority. The server computes awards against a bound published release. Label pending, accepted and rejected separately; gameplay survives outages. Configure bounded durable queue storage, explicit reconnect flush and one writer per session. Abort and clear the old account queue on sign-out/switch; never merge guest events or identities by email.

The panel is optional and silent. Preserve hidden-achievement filtering, escaped text, provenance and account disposal. Central profile sharing requires authenticated binding and separate consent. Use shared types for future native work only; do not claim React Native support without its authentication/device prerequisites. Test actual transport and account-switch behavior before declaring an integration complete.
