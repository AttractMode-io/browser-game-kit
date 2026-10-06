# Check your integration

Run the credential-free check first:

```sh
npm run doctor
npm run doctor -- --online
```

The optional online check contacts only Attract Mode's public capability manifest. It sends no client credentials and refuses redirects. A successful check is evidence of connectivity, not approval or a live login.

For a registered client, fill `.env` locally using `.env.example`, then:

```sh
node --env-file=.env tooling/doctor.mjs --connected --online
```

Output is structured JSON with fixed codes and instructions. It deliberately omits IDs, secrets, callback values and raw remote errors. Share this report instead of `.env`, browser cookies or authorization URLs. Exit code 1 means a check failed; exit code 2 means invalid command arguments. `manual` checks need a human or the authenticated developer workspace. Doctor cannot inspect private callback registration, game ownership or client revocation.

| Code | Next action |
| --- | --- |
| NODE_VERSION | Install Node.js 24 or newer. |
| ENVIRONMENT | Use the offline demo until an isolated sandbox issuer is available, or your separately approved production client. Changing an environment string does not isolate accounts. |
| CLIENT_REGISTRATION | Obtain this game's approved ID and secret. Keep both on the server. |
| GAME_ID | Set the approved registry game ID; it must match the active registration. |
| PLAYER_ID_KEY | Generate and securely persist a server-only random key; changing it changes player IDs. |
| CALLBACK_FORMAT | Use the registered HTTPS `/auth/callback`, without extra query parameters. |
| REGISTRATION_REVIEW | Compare the exact URL and game registration in the developer workspace. |
| PRODUCTION_HOSTING | Replace the development server and in-memory store before deployment. |
| PUBLIC_CONNECTIVITY | Retry connectivity separately; let guest gameplay continue. |

## Safe retries and cancellation

The browser panel gives session lookups five seconds, cancels a superseded lookup and cancels on disposal. Call `refresh()` to retry a read. Authentication POSTs and callbacks are never automatically retried. A failed account lookup leaves guest gameplay available. Configure `timeoutMs` between 1 and 30000 if needed. Your game should not await account UI before starting its render loop.

## Environment status

The bundled offline mode is a signed identity simulation. It is not a hosted integration sandbox. Connected mode pins the official production issuer and requires reviewed registration. Unsupported environment values fail closed. Do not use real player credentials in fixtures or present local test identities as production accounts.

For actual local provider integration rather than simulation, follow [the Docker/Supabase sandbox guide](local-sandbox.md). Doctor does not start Docker or mutate sandbox records.
