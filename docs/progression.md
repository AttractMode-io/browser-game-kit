# Save progress and reward verified play

**Progression is early access for approved game integrations with separately issued scoped credentials.** Version 0.3.0 adds cloud saves, game XP, achievements and statistics. Production access requires an active registration and configured game backend. An external developer’s hosted production pilot has not yet been completed; no throughput or cheat-proof guarantee is implied. Use the approved endpoint supplied during setup, never a guessed URL.

Players should be able to return to their saved game, see what they earned and recover when two devices disagree. This kit separates that experience from the evidence used to award anything competitive.

## Start locally, without credentials

Run these commands from the extracted kit directory after `npm ci --ignore-scripts`:

```sh
node --test tests/progression.test.mjs tests/progression-ui.test.mjs tests/puzzle-validation.test.mjs tests/puzzle-store.test.mjs
npm run dev
```

Open `http://127.0.0.1:3000/examples/progression` to inspect synthetic achievement, leaderboard and save-conflict states. No real account, XP grant or cloud save is created. The tests exercise the included browser/bridge contracts, explicit conflict choices, durable SQLite challenge consumption and stable retry events. They do not connect to the platform database.

To follow the executable server-validation recipe independently, run this from the kit root:

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {createPuzzleValidator, createMemoryPuzzleStore} from './examples/validation/puzzle.mjs';
const validator = createPuzzleValidator({
  store: createMemoryPuzzleStore(),
  sendEvent: async event => event // local observation only; no platform grant
});
const challenge = await validator.issue('local-player', {question:'2 + 3', answer:'5'});
await assert.rejects(validator.solve('different-player', {challengeId:challenge.id, answer:'5'}));
const input = {challengeId:challenge.id, answer:'5'};
const first = await validator.solve('local-player', input);
const retry = await validator.solve('local-player', input);
assert.deepEqual(retry, first);
console.log('Local validation passed: wrong player rejected; retry keeps the same event. No XP sent.');
JS
```

The memory recipe is a test fixture; it does not supply a production sequence allocator or outbox. Use the durable recipe below for those requirements. A complete disposable local progression service is not bundled. `/examples/progression-connected` requires a configured service and must show unavailable sync when none exists. Do not rename the simulated demo as a production test.

## Connect an approved game

1. Complete the [account registration and hosted sign-in checklist](go-live.md). A listing, an OAuth client, and progression approval are separate requirements. Approval remains a reviewed manual step.
2. Obtain the approved progression endpoint and separate credentials for the exact game/environment. Use a `player` credential for the browser bridge, `events` for the trusted validator and `definitions` for administration. Keep the last two outside the public game server's browser-facing bridge.
3. Define your game rules, XP thresholds, achievement targets, statistic aggregation and season through the approved administration workflow. Record the resulting definition version. The kit has no automatic production provisioning command.
4. In private backend configuration, set `AM_PROGRESSION_ENABLED=true`, `AM_PROGRESSION_ENDPOINT` and `AM_PROGRESSION_CREDENTIAL`. `.env.example` includes disabled placeholders. Never copy credentials into frontend build variables.
5. Sign in through your actual hosted game, then use `/examples/progression-connected` or your own panel. The sample panel uses `client_reported` mode and its `completions` statistic; adapt its configuration to your approved definitions and intended provenance before expecting populated boards. An empty board is valid until a qualifying result is accepted and the player opts in.
6. Configure your validator separately to submit durable `event.submit` records. Validate gameplay on the server before submission. Only after receiving acceptance should your UI report granted XP. Login and saving do not themselves validate a win.
7. Complete the acceptance checklist below with two disposable authorized player accounts and record actual results before requesting a connected label. Do not reuse a live player's progression for destructive tests.

`npm run doctor` checks account configuration and connectivity only. It does not currently verify progression credential scope/expiry, definitions, season, cloud writes or leaderboard readiness. Confirm those through the reviewed developer setup and explicit acceptance operations; a green doctor result is not a progression launch approval.

## Three trust levels

Client-reported progress is editable by the player. A server-validated event records a decision your backend actually checked. An authoritative game server or verifiable replay can establish stronger evidence about play. Hosting a thin proxy, hiding an API key or signing a browser-supplied score does not turn that score into a verified result. Attract Mode validates credentials, isolation, rules and duplication; your game validates what happened.

Game XP belongs to one game. It never grants Attract Mode-wide reputation, payments or valuable rewards. Keep personal and validated leaderboard results separate. Leaderboard provenance must remain visible.

## Browser integration

Import `createProgressionClient` from `integrations/progression.mjs`. Serve `/api/game-progression` from your game's backend on the same origin.

```js
const progress = createProgressionClient({
  endpoint: '/api/game-progression',
  scope: `${gameId}:${environment}:${signedInPlayerId}`,
  storage: sessionStorage
});
const saved = await progress.readSave('campaign');
await progress.writeSave('campaign', {level: 4}, saved.revision);
```

The cache scope prevents accidental account mixing; it is not authentication. The backend reads the verified server session and ignores any identity sent by the browser. On logout or an account change, call `progress.setScope(null)` and destroy the progression UI before rendering the next player's data. Never merge guest progress into account rewards automatically.

`readSave(slot)` returns a revision and history. `writeSave(slot, value, expectedRevision)` changes the slot only if that revision still matches. On HTTP 409, keep the local draft, fetch the newest save and let the player choose. Do not change `expectedRevision` and retry silently. `recoverSave(slot, restoreRevision, expectedRevision)` restores an older value as a new revision, with the same conflict check. `cacheDraft()` stores a recoverable local draft; nothing automatically uploads on reconnect. Storage errors are visible to the caller. Do not store secrets in saves or drafts.

`progress({mode})` reads game XP, stats, achievements and provenance. `history({mode})` reads recent accepted events and corrections. `leaderboard({stat, period, season, mode})` reads a defined board. `setVisibility({public: true})` is an explicit opt-in. UI components live in `integrations/progression-ui.mjs` and accept normalized display models rather than credentials.

## Backend bridge

`createProgressionBridge({origin, resolveSession, execute})` returns a Web Request handler. `resolveSession` must validate the existing server-side session on every call and return `{gameId, environment, playerId}`. Never implement it by decoding an unverified JWT or copying request fields. Preserve the registered origin through your trusted reverse proxy. The handler requires a matching Origin, JSON and POST, bounds the streamed body, disables caching and rejects trusted event and administration actions.

For local tests, inject the local engine's `execute` function. For an approved integration, `createProgressionTransport({endpoint, credential, enabled:true})` can connect to the approved HTTPS API. The `am_pg_` credential stays in your backend secret store. Give the browser bridge only a player-scoped credential, not an event or definition credential. The transport follows no redirects and sends `{action, data, playerId}`; the platform derives game, environment and scope from the credential. Use separate credentials for development and production, rotate them and revoke compromised keys.

No auto retry is performed. Save conflicts require a choice; event retries must retain the exact event payload and identifiers. Surface unavailable sync while keeping the game playable locally.

## Server event contract

Trusted backend action `event.submit` accepts `{eventId, type, businessKey, sequence, value}`. Definitions derive XP and achievement transitions from accepted event types. Do not accept `xp` or an achievement unlock instruction from the browser. Save the pending event durably before sending. Reuse its event ID after a timeout, with exactly the same content. A new event ID is not permission to award the same challenge twice: `businessKey` must identify the actual server-owned challenge, match or completion. Follow the platform's sequence contract.

Definitions and compensating corrections are privileged operations. Keep them out of public routes, browser bundles and agent tools with broad default access. Corrections append evidence and an offset rather than erasing the original grant history.

## Validation recipes

The executable `examples/validation/puzzle.mjs` recipe keeps the answer on the server, binds the challenge to a player and expiry, and preserves the same event for retries. Its in-memory store is an isolated test fixture only. A deployed store must verify and consume the challenge atomically, assign sequence, persist the event and insert an outbox row in one transaction. An outbox worker retries delivery and marks the receipt only after success. Do not generate a fresh event each retry.

The executable `examples/validation/turn-based.mjs` fixture implements a small server-owned take-away match and stable terminal results. For a deployed turn-based game, accept an action against a server-owned board revision. Validate the active player, legal move and result, atomically advance the board, then emit one result event with that match's stable business key. A repeated request must return its stored result. Never accept a browser's `won: true` flag.

For an authoritative simulation, the match server owns state and emits the result after finishing its simulation. Bind the event to the roster and match ID and keep a result record for dispute/correction. A signature from a backend that merely forwards arbitrary client scores is not equivalent.

## Acceptance before release

**Developer-owned checks, available in this ZIP:** run the local commands above and `npm test`. Then test your actual registered game against its approved staging/pilot service:

- Sign in as account A, save a checkpoint and load it in a second independent session of A.
- Read the same revision in both sessions. Save from the first, then submit the stale revision from the second. Expect HTTP 409, retain the local draft, and require an explicit choice. Do not silently retry with the new revision.
- Recover an available older revision with the observed current revision, confirm explicitly, and verify it becomes a new revision. Canceling must leave both local and remote state intact.
- Complete a genuinely qualifying server-validated challenge. Confirm one accepted event, expected game XP, achievement and statistic. Retry the exact persisted event after an ambiguous timeout; expect the same receipt without another grant.
- Read definitions, accepted-event history and the correct stat/season/provenance board. Opt in, verify visibility, opt out, and verify removal on a fresh board read.
- Sign out and switch to account B. A's saves, private history and UI cache must disappear. Verify session expiry and unavailable-sync recovery preserve guest play and local unsynced work.
- Exercise credential rotation/revocation on dedicated pilot credentials through the approved administrator. Old access must fail; restoration must not require changing the persistent player-ID key. Never use another developer's credential to test isolation.

**Platform-maintainer checks:** database transaction concurrency, scope enforcement, cross-game isolation, changed-payload replay, duplicate business keys, quota enforcement, rollback and correction tests belong to the private platform suite. They are not included in this public ZIP and developers are not expected to run unavailable commands. Request dated maintainer evidence for the service version used by your pilot.

Keep fixture results, hosted first-party results and an independent external developer's acceptance separate. None substitutes for the others. Physical mobile-browser testing remains necessary for supported device claims.

## UI wiring

`mountProgressionUI({element})` returns `renderLevel`, `renderAchievements`, `showAchievement`, `renderLeaderboard`, `resolveSaveConflict` and `destroy`. Import `integrations/progression-ui.css` in your page. Normalize the private API response into display models: a level has `{gameName,level,xp,nextLevelXP}`, an achievement has `{name,description,unlocked,hidden,progress,target}`, and a board has `{period,provenance,entries:[{displayName,score,visibility}]}`. Only public leaderboard entries belong in the UI. Do not infer verification from a high score or hide provenance.

After a conflict, fetch the remote revision and pass explicit callbacks to `resolveSaveConflict({slot,localLabel,remoteLabel,onKeepLocal,onKeepRemote})`. `onKeepLocal` writes with that fetched revision only after the player chooses; another conflict must remain visible. `onKeepRemote` applies the fetched remote data. Cancellation retains the draft. Destroy the UI on sign-out before showing a different account. The standalone `examples/progression.html` demonstrates synthetic states, not live player records.

`reportPersonalEvent({eventId,type,businessKey,sequence,value})` is optional personal progress. The backend accepts only definitions explicitly marked `client_reported`, never validated rules. It is not an achievement attestation. Separate the player’s personal practice score from trusted competitive results in both storage and display.

`progressionDisplayModels({progress,definitions,board,gameName})` converts API responses into UI models. It does not invent a level curve; supply a developer-defined level and next-level threshold if needed. Public boards use anonymous ordinal labels unless an explicitly public display name is supplied. `definitions({mode})` reads permitted definitions with locked hidden achievements omitted by the service. `setVisibility({public,mode})` chooses the exact provenance board to expose.

## Packaged server wiring

The kit server exposes `/api/game-progression` only when explicitly configured. The account handler's server-only `resolveProgressionSession` uses its secure cookie, TTL store and registration check. A signed-out or revoked session fails before the platform call.

For an approved connected deployment, configure `AM_PROGRESSION_ENABLED=true`, the approved `AM_PROGRESSION_ENDPOINT`, and the player-scoped `AM_PROGRESSION_CREDENTIAL` in backend environment variables. Active registration and a provisioned credential are prerequisites. Offline simulated accounts cannot call a remote service, even if those environment variables are present.

For isolated local integration, import `createGameServer({port:0, env:{}, progression:{localFixture:true, execute}})` and supply your local engine adapter. This path cannot run in production or connected account mode. The package does not bundle the private platform database or claim a public sandbox exists. `/examples/progression-connected` exercises the authenticated bridge when available; without a configured service it shows a sync failure, not fabricated successful progress.

## Durable puzzle validator recipe

`examples/validation/puzzle-store.mjs` provides a Node 24 SQLite implementation of the challenge store. It uses `BEGIN IMMEDIATE` to consume a challenge, increment the player's sequence and write the exact event into an outbox atomically. The database has file mode 0600. Keep it outside public asset directories on persistent single-host storage; this implementation is not a multi-region or serverless database. Only one such event producer may own a player sequence for this game/provenance stream. If several game systems emit events, move their sequence allocator and outbox into one shared transactional database.

```js
const store = createPuzzleStore({filename: '/private-game-data/puzzles.sqlite'});
const validator = createPuzzleValidator({store, sendEvent: async event => event});
// Your authenticated endpoint derives playerId from the server session.
await validator.solve(playerId, {challengeId, answer});
// A separate worker uses the server-only event-scoped transport.
await deliverPuzzleOutbox({store, sendEvent: event => platform({
  principal: {playerId: event.playerId},
  action: 'event.submit',
  data: Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'playerId'))
})});
```

The solve response must not say the platform granted XP yet. The outbox worker acknowledges only successful delivery; a timeout leaves the exact payload pending. If the worker crashes after remote acceptance but before acknowledgement, the platform's event ID makes retry safe. Retained accepted challenge records prevent a second win with a new UUID. The store caps challenges and pending events at 10,000 and stops visibly rather than deleting idempotency evidence. Monitor capacity and migrate/archive using a reviewed retention policy before approaching that limit. A new database is not a safe workaround for exhausted storage because it loses sequence and completion history.

Run `node --test tests/puzzle-store.test.mjs` for persistence, two-connection consumption, timeout retry and worker acknowledgement checks. The question/answer itself must be generated and stored on the server; sending the answer in a browser bundle defeats validation.

## Credential scope and pilot quotas

Use separate credentials for each registered game and environment. The platform derives these boundaries from the credential, not request fields. `player` permits private saves and personal progress/reporting, permitted definitions, board reads and visibility choices. `events` permits server-validated event submission only. `definitions` permits definition changes and compensating corrections; issuance requires studio-owner authority. The browser bridge should receive only a `player` credential. Keep the `events` credential in your validator worker and the `definitions` credential in your administration environment.

Keys are returned only at issuance; the platform stores their hash. Expiry is 1–90 days. Each project permits at most five active keys, 20 issues per day and 100 retained issuance records. Revoke an unused key before rotating when at the active limit. A removed issuer membership, project revision change, expired key or revoked integration rejects further requests. Revocation is not a substitute for keeping secrets out of source and browser bundles.

Pilot limits are 600 requests per minute per credential, and event acceptance is capped at 120 per minute and 10,000 per day per player/provenance stream. These are abuse and storage controls, not evidence that gameplay happened. The platform also bounds request bytes; never retry HTTP 429 in a tight loop. Honor a retry delay when supplied and otherwise back off with jitter.

Saves permit 10 named slots per player, 64 KiB per value and five retained revisions. Project storage is capped at 10,000 player/provenance records, 500,000 events, 100 definition versions and 100,000 pending notification records. Capacity failures must remain visible; do not silently discard unsynced progress or mint new identities to evade limits. Definition levels are ascending XP thresholds beginning at zero. The server returns `level` and `nextLevelXP`; game XP remains separate from Attract Mode-wide reputation.

Statistics support `sum` (accumulated totals), `max` (higher personal best) and `min` (lower personal best, such as completion time). The first accepted min result initializes the score; zero is not invented as a starting best. Min boards sort ascending and min achievement targets unlock at or below the threshold. The display adapter shows that target as text instead of an increasing progress bar. Existing statistic aggregation cannot change across definition versions.
