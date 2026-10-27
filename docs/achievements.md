# Achievement sets, game XP and accepted progress

The achievement modules add a versioned set workflow to Attract Mode's game-scoped progression. Developers define semantic events, simulate rules, publish a tested revision in Developer Studio and connect their game through a trusted backend. The portable rule engine, CLI and silent sample run locally without credentials. Hosted use requires the achievement migration/service to be deployed, approved game registration, explicit release/build binding and an appropriate scoped server credential. Source availability is not proof that a production account is eligible.

Achievement points, game XP and completion are separate. Points recognize an achievement inside its set. Game XP is configurable progression inside one game, not Attract Mode reputation or a global ranking. A publisher-validated result means the publisher's server submitted it after its own checks; it is not an independent anti-cheat guarantee. Personal reports never become validated just because a browser signs a request.

## Try the first set locally

From the extracted kit, with Node.js 24:

```sh
npm ci --ignore-scripts
node tooling/achievements.mjs validate examples/achievements/manifest.json
node tooling/achievements.mjs simulate examples/achievements/manifest.json examples/achievements/events.json
npm run dev
```

Open `http://127.0.0.1:3000/examples/achievements`. This silent sandbox demonstrates a loss, harbor win, exact retry and a different level. Only the first harbor win earns First crossing and 25 game XP. It creates no real account, award or public activity. CLI simulation produces condition traces. It does not exercise deployment, database concurrency or authentication.

## Define one event and one reward

`examples/achievements/manifest.json` is the complete checked-in example. Events have bounded typed fields; stats aggregate matching events; achievements check stats. One event may advance several achievements. No executable JavaScript, network requests or client-supplied XP enters the rule evaluator. The manifest assigns the optional XP reward, while the gameplay event supplies only what happened.

Stable achievement IDs and `earningScope` preserve award identity across compatible releases. Reusing a new event ID for the same business occurrence does not create another award. Keep game XP distinct from set points. Secret descriptions are filtered from locked player projections, but downloadable game source is not a secrecy boundary.

## Draft, test and publish

1. Select the approved game and sandbox project in Developer Studio's Progression workspace.
2. Import the manifest or edit the same revision visually. Save with its expected revision; resolve conflicts rather than overwrite collaborators.
3. Run the simulator with positive, negative, boundary and replay fixtures. Validate the stored revision on the server.
4. Review the semantic diff and exact candidate hash. Publish using the explicit revision, hash and idempotency key.
5. Bind the compatible build ID to that immutable release before sending events. Changing a build label is routing, not proof of an unmodified game.
6. Confirm accepted progress with a sandbox identity before requesting production activation. Sign-in, publication and runtime credential permissions are separate.

The authoring CLI supports `validate`, `diff`, `simulate` and exclusive-create `export`. Remote `draft`, `get`, `validate-draft`, `publish` and `bind` commands default to **request previews**. To execute, obtain a ten-minute, project-scoped authoring token from authenticated Developer Studio and supply it privately through `AM_ACHIEVEMENTS_AUTHORING_TOKEN`. Draft permission is separate from publication permission. Add `--execute --environment sandbox`; production additionally requires `--confirm-production` with the exact project ID. The service checks environment, membership and the live session on every request. Runtime `am_pg_` keys cannot author sets. Never copy browser cookies or put tokens in shell arguments, logs or source control.

```sh
node tooling/achievements.mjs draft examples/achievements/manifest.json --project PROJECT --revision 0
node tooling/achievements.mjs diff previous.json examples/achievements/manifest.json
node tooling/achievements.mjs publish --project PROJECT --set harbor-base --revision 1 --hash SERVER_CANDIDATE_SHA256 --idempotency RELEASE_REQUEST_ID
```

The CLI defaults previews to sandbox. Actual execution requires an explicit environment matching the Studio token. The default destination is the fixed Attract Mode authoring endpoint; only explicit loopback development can override it. Obtain the candidate hash from server validation, not a hash of arbitrarily formatted JSON. Publication is a distinct operation. A generated draft never grants permission to publish. After a network timeout, fetch the draft/release and reconcile the idempotency key before retrying an uncertain write. The CLI does not print its token. Revoke the grant in Studio when finished; signing out or expiry also invalidates it.

```sh
# Set the temporary token using your private secret-management workflow first.
node tooling/achievements.mjs draft examples/achievements/manifest.json --project PROJECT --revision 0 --execute --environment sandbox
node tooling/achievements.mjs validate-draft --project PROJECT --set harbor-base --revision 1 --execute --environment sandbox
node tooling/achievements.mjs publish --project PROJECT --set harbor-base --revision 1 --hash SERVER_CANDIDATE_SHA256 --idempotency RELEASE_REQUEST_ID --execute --environment sandbox
node tooling/achievements.mjs bind --project PROJECT --set harbor-base --build web-1 --release RELEASE_ID --revision CURRENT_BINDING_REVISION --execute --environment sandbox
```

## Connect a personal-report browser game

The Node sample also serves `/examples/achievements-connected`. It uses the existing account session, the same-origin bridge and a bounded sessionStorage queue, with no audio. Set the private `AM_ACHIEVEMENTS_ENDPOINT` and `AM_ACHIEVEMENTS_CREDENTIAL`, then explicitly enable `AM_ACHIEVEMENTS_ENABLED=true` in connected account mode. First publish `harbor-base` and bind `web-1` in the exact environment assigned to that approved registration. The supplied account demo currently supports its approved production issuer only; it does not manufacture a sandbox issuer. Use a separately approved sandbox backend for sandbox end-to-end tests. Offline account simulation cannot contact the hosted achievement service. The page does not automatically create registrations, publish releases or accept profile linking.

Keep credentials and identity derivation on the game backend. Mount `createAchievementBridge` at your same-origin `/api/game-achievements`; pass the existing authenticated game-session resolver and `createAchievementTransport`. The bridge checks the exact Origin, JSON type and body limit; it accepts personal `event.report`, `progress.get` and explicit `binding.link.start`, derives `playerId` from the session and strips caller authority fields. Enforce your normal host validation, request rate limits and secure cookie settings around it.

```js
// Backend only. Reuse the approved account adapter's game-scoped session.
import {createAchievementBridge, createAchievementTransport} from './achievements-server.mjs';
const execute = createAchievementTransport({
  endpoint: 'https://attractmode.io/api/achievements',
  credential: process.env.AM_ACHIEVEMENTS_CREDENTIAL,
  enabled: true
});
const handler = createAchievementBridge({
  origin: 'https://your-game.example', resolveSession, execute
});
// Mount handler as a Web Request -> Response route on your backend.
```

```js
// Browser only. scope comes from the authenticated session, never typed by a player.
import {createAchievementClient, createAchievementScope} from './integrations/achievements.mjs';
const achievements = createAchievementClient({
  endpoint: '/api/game-achievements', storage: localStorage,
  scope: createAchievementScope(authenticatedSession.account)
});
const result = await achievements.report({
  setId: 'harbor-base',
  event: {eventId: durableId, occurrenceId: completedRunId, buildId: 'web-1',
    type: 'level.completed', payload: {level: 'harbor', won: true}}
});
if (result.status === 'accepted') {
  // The receipt confirms acceptance. It does not necessarily contain a new award.
}
```

Create the durable event and occurrence IDs once per gameplay occurrence, then retain them unchanged on retry. The browser stamps `occurredAt` once when enqueuing a new event if absent, and retains that timestamp on every retry. The runtime requires canonical UTC ISO `occurredAt`; trusted server integrations must persist it with the event before transport. The service bounds newly accepted events to seven days old and five minutes into the future; timestamps on personal reports remain player assertions, not anti-cheat evidence. An already committed exact retry returns its retained receipt after that event-acceptance window. Full receipts become eligible for pruning after 90 days. Once maintenance archives a receipt, the service keeps the deduplication tombstone and returns a conflict instead of reissuing an award; query current progress or support diagnostics for reconciliation. The candidate includes gated daily maintenance at 07:17 UTC with bounded batches and backlog reporting. Undelivered snapshots older than 90 days are also eligible for redaction, excluding active leases. This source configuration is not evidence that a production job has been deployed or completed; operators must monitor backlog. `accepted` means the server confirmed a receipt; `pending` means the exact event remains queued; `rejected` means it was terminally rejected or expired. Do not award local confirmed XP from a pending response. Do not let sync failure stop gameplay.

The queue defaults to 100 events and a seven-day retention window. It drains sequentially when `report()` or `flush()` is called; there is no background timer. Call `flush()` on authenticated reconnect. A 401/403, network outage, 429 or transient server error retains the event for explicit retry. Invalid payloads/conflicts are removed with a rejected result. Expired events are discarded with an `expired` result, not silently treated as earned. Storage errors and overflow are explicit errors. Without a storage adapter, `persistence` is `memory` and events do not survive reload.

Use one client/writer per game-session tab. Browser localStorage is not a transactional cross-tab queue; coordinate writers in the host game if several tabs are supported. Server event/occurrence deduplication remains authoritative. Call `setScope(null)` at sign-out and `setScope(newScope)` on account change: in-flight requests abort, old queued data is cleared and stale replies cannot render for the next account. The BFF also compares the expected scope to its authenticated session before execution. An unnoticed account switch in another tab therefore returns ACCOUNT_CHANGED, clears the stale queue and requires a fresh authenticated scope instead of awarding the old event to the new player. Never adopt a guest queue or merge by email. Queue storage holds gameplay payloads, not tokens; avoid personal data in events. Shared-device games can supply a session-only storage adapter.

## Publisher-validated events

The trusted game server authenticates the player, validates gameplay against its own state, and calls the private transport with `event.submit`. Do not expose this action through the personal-report bridge. A browser-computed score, signed client queue, public manifest or cloud save is not authoritative proof. Keep personal and publisher-validated progress separate in reads and UI.

## Silent, accessible in-game presentation

`mountAchievementPanel({element, client, setId})` in `integrations/achievement-panel.mjs` renders accepted progress and provenance as plain text. Load `achievement-panel.css`; call `refresh()` after sign-in and `destroy()` when leaving the screen. The panel has no audio, media playback or speech synthesis. It uses a polite status region, wraps long text and distinguishes pending from accepted. Exact replay receipts do not celebrate an award again. Pass `notifications:false` to suppress award announcements. The headless API works without any component.

On account change the panel clears its private display. Destroying a panel does not sign the player out or dispose a shared client. Hidden locked achievement text is withheld again at rendering even if an integration mistakenly supplies it. The server projection remains the primary spoiler/privacy boundary.

## Player account and public sharing

A game-scoped player ID is not a public Attract Mode handle. `await achievements.startProfileLink()` starts a short-lived link from the authenticated game session through its trusted backend. Show the returned `consentUrl` as a player-chosen link; do not open it automatically or log its one-time token. It points to Attract Mode with the token in a fragment, so the URL token is not sent in an HTTP request/referrer. The signed-in player must inspect the game and explicitly accept in their central account. The token expires in ten minutes, is stored hashed and can be used once. Existing progress is linked only after both game-session proof and central-account consent; a plain central-account sign-in does not guess a HMAC mapping. Never submit provider subjects, email addresses or arbitrary player IDs from a browser. Private progress, profile display and leaderboards have separate permissions. Withdrawal must remove public projections. Client SDK code cannot grant sharing consent on the player's behalf.

## Scope and compatibility

Existing `./progression`, saves, account helpers and v0.3.x methods remain available; this is additive. New package exports are `./achievements`, `./achievements-server`, `./achievement-panel`, `./achievement-panel.css`, `./achievement-rules` and shared `./achievement-types`. Shared contracts and a portable evaluator do not constitute a React Native SDK: native secure storage, sign-in/app links and device acceptance remain prerequisites. No Unity/Godot support, hosted no-backend claim, global XP, payments or production availability is implied.

Four project-local skills cover design, integration, QA and release. Install only those relevant to the task through `agents/install.mjs`. The bundled MCP can search/read these documents and capability boundaries; it has no live player access, draft publishing, reward correction or write tools.

## Types and legacy migration

The `./achievements`, `./achievements-server`, `./achievement-rules` and `./achievement-panel` exports include TypeScript declarations. `./achievement-types` is type-only. `RuntimeGameplayEvent` requires an original `occurredAt`; browser `GameplayEvent` permits enqueue to stamp it. Manifest types describe schema version 1, while runtime validation checks numeric bounds, referenced fields and condition complexity. These are shared contracts, not generated game-specific event types or a native authentication package.

Existing `definitions.put`, save and progression integrations keep their current behavior. New drafts never replace immediate legacy activation under the same method name. Read [the migration guide](./achievement-migration.md) before changing a live game; there is no automatic award import or XP transfer.
