# Upgrade from 0.1.x to 0.2.0

Offline demo users can install this release and run the same commands. Real connected integrations must complete these steps before deploying 0.2.0:

1. Confirm the platform integration registry is live and the specific client is active for the correct game and production environment. A prior OAuth client alone is no longer sufficient.
2. Set `AM_GAME_ID` to that registration's game ID. Preserve the existing approved client ID, secret and exact callback.
3. Generate and securely persist a separate `AM_PLAYER_ID_KEY`. Connected `/api/me` now returns `{playerId, gameId, environment}` rather than the provider issuer/subject. Update frontend consumers.
4. If your game already has records keyed by provider subject, migrate them using your trusted server-side identity mapping before switching the frontend. Follow the [identity migration procedure](account-integration.md#changing-the-player-id-key-without-losing-player-records). Do not merge by email or discard player records.
5. For the included single-host production server, configure the separate encrypted session store using [production-storage.md](production-storage.md). Existing custom durable adapters can keep the `set/get/take` interface. Never put SQLite on an ephemeral or shared network filesystem.
6. Run doctor, unit tests and the real local OAuth sandbox, then test the approved production client on its actual HTTPS origin. Verify cancellation, returning login, expiry, logout and account switching.

Keep 0.1.x source available for rollback, but do not use rollback as a way to bypass revoked registration. Rollback account data changes only with a tested mapping and backup; reverting code does not undo an identity migration automatically. This release does not add progression or payment APIs.
