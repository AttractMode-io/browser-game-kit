# Real local OAuth integration sandbox

This is separate from the instant offline demo. It runs Supabase Auth and PostgreSQL locally through Docker, signs real OIDC tokens, creates a disposable user and client, exercises consent and exchanges a PKCE authorization code. It never uses production accounts or a production service key.

Install Docker Desktop and Supabase CLI 2.98.2 or newer. Start Docker, then from the kit directory:

```sh
npm ci --ignore-scripts
npm run sandbox:prepare
npm run sandbox:start
npm run test:sandbox
npm run sandbox:stop
```

The first start downloads container images and can take several minutes. Ports 56421 and 56422 must be free. The sandbox uses its own project ID and Docker volumes. Do not copy production data into it. Supabase CLI displays local credentials in its startup output; keep that output private. Do not expose Docker's development service ports to the Internet or an untrusted network.

The test reads local credentials directly from CLI output in memory, without printing them. It checks the fixed `http://127.0.0.1:56421` API URL before creating anything. Its generated signing key stays in a Git-ignored file with owner-only permissions. Disposable test identities use `example.invalid`, require no real email, and are removed along with their clients after a successful or failed run.

A successful run verifies actual Supabase consent approval/denial, authorization code exchange, PKCE, ID-token validation and used-code rejection. The consent decision is submitted by the test through the real API as its disposable user. This is a protocol integration test, not a tested human consent UI, a hosted multi-developer sandbox, or a live production client pilot.

## Strict environment boundary

The normal `configureAccountClient` remains pinned to the production issuer. The lower-level test adapter accepts only that issuer or the fixed local sandbox issuer, never arbitrary remote providers. Local insecure HTTP is enabled only on the sandbox's test OIDC configuration. Production callbacks remain HTTPS. A local token fails the production issuer check; changing `AM_ENVIRONMENT` cannot promote a sandbox identity.

## Reset and troubleshoot

The test cleans up its own records. To discard all data belonging to this isolated kit sandbox, stop it using `supabase stop --workdir sandbox --no-backup`, then start it again. This deletes this sandbox's data: do not run reset commands from another project. Never add `--linked` or a remote database URL.

If Docker is unavailable, the offline demo and unit tests still work; they do not replace `test:sandbox`. If Auth says no signing key was detected, confirm `npm run sandbox:prepare` ran and the ignored key has signing key operations. Never send the key to support.

Reference: [Supabase OAuth server setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started).
