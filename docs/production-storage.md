# Single-host production adapter

The default demo uses memory. For an approved external game on one persistent Node.js host, the kit includes encrypted SQLite sessions with atomic one-use transactions. This does not turn a static host, ephemeral function filesystem or shared network drive into a durable server.

Use Node.js 24 on a persistent Linux host, a process supervisor and your existing trusted HTTPS reverse proxy. Register the exact public `/auth/callback` URL. Install dependencies using `npm ci --ignore-scripts`. Create a private state directory outside the public web root, owned by the server's OS user (mode 700).

Create `.env.production` privately from `.env.example`, and add:

```text
NODE_ENV=production
AM_SESSION_DB=/absolute/private/state/sessions.db
AM_SESSION_KEY=<64 hexadecimal characters generated locally>
```

Generate each private key locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Use separate values for `AM_SESSION_KEY` and `AM_PLAYER_ID_KEY`; put them in your secret manager, never source control or chat. Set the approved game/client IDs, client secret and callback as described in the account guide.

Run:

```sh
node --env-file=.env.production tooling/doctor.mjs --connected --online
npm run start:production
```

The server listens on 127.0.0.1 only. Route the registered HTTPS host to it through your proxy, preserving `Host`. Do not trust incoming `Forwarded` headers or disable HTTPS/cookie/origin checks. Keep `/api/*` and `/auth/*` uncached. Terminate TLS at the trusted proxy, add per-IP abuse protection there, and supervise the process. A missing durable-store configuration refuses production startup.

## Durability and security contract

- SQLite WAL with full synchronous commits, a busy timeout and `BEGIN IMMEDIATE` serializes `take()` across processes using the same local database. A consumed callback cannot be reused after a restart.
- Records are AES-256-GCM encrypted with fresh nonces. The record key and expiry are authenticated. The file is mode 600; its directory must not be writable by other users. No OAuth access or refresh token is retained.
- Transactions expire in ten minutes; game sessions last no more than one hour or their identity-token expiry. Expired entries are removed at startup, on writes/reads and every minute while running. Capacity is bounded to 10,000 records and 8 KiB per record.
- Registry checks still enforce active game registration. Local logout consumes the session. Account data stays on the trusted backend; only the scoped player ID reaches game code.

The tests exercise reopen, encryption, expiry, wrong-key rejection, capacity and consumption through multiple connections. SQLite is marked experimental in Node.js 24, so pin and test the Node patch version when upgrading. This adapter supports one persistent host, including multiple processes sharing a local file. Use a separately reviewed transactional shared store for multiple hosts or serverless deployment; do not use SQLite over NFS.

## Backup, key rotation and recovery

Use SQLite's online backup mechanism or stop the process before copying the database together with required WAL state. Encrypt backups, restrict access and keep a short documented retention (recommended maximum seven days for these transient records). Restoring a session backup can reintroduce previously consumed flows, so restore only with a new `AM_SESSION_KEY` and an empty session database; require players to sign in again. Preserve the old encrypted file only according to incident/retention policy.

Session-storage key rotation intentionally signs everyone out: stop the process, archive/remove the transient database and its WAL files according to retention policy, configure a new key and restart with an empty database. Do not do this to `AM_PLAYER_ID_KEY`, which defines durable player identity. Follow the separate [player-ID migration procedure](account-integration.md#changing-the-player-id-key-without-losing-player-records).

An unavailable store or registry denies account operations. Keep guest gameplay available. Never fall back from failed persistent storage to memory in production.
