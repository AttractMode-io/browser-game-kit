# Move from legacy progression to versioned achievement sets

The existing progression API remains supported for approved integrations. Installing the new source modules does not migrate accounts, convert definitions, import awards, combine XP or activate an achievement project. The versioned-set service is a separate preview boundary. Keep the existing `./progression`, `./progression-server`, save APIs and game identity configuration until a deliberately approved cutover.

## Contract differences

| Legacy progression | Versioned achievement sets | Migration decision |
| --- | --- | --- |
| `definitions.put` immediately makes a definition version active | `draft.save` does not affect play; validate, publish exact revision/hash and explicitly bind a build | Do not replace the old method with a draft write under the same name. Maintain the old route for old clients. |
| Event `{eventId,type,businessKey,sequence,value}` | `{setId,event:{eventId,occurrenceId,buildId,type,payload,occurredAt}}` | Instrument semantic payloads; define a stable occurrence key and original timestamp. This is not a field-renaming adapter. |
| `client_reported` / `server_validated` | `personal` / `publisher_validated` | These are different wire vocabularies. Preserve the evidence level; never promote a personal event. |
| Latest active definitions and flat event rules | Immutable set release selected by explicit build binding | Preserve old bindings for delayed events and old builds. Never silently evaluate against latest. |
| Existing XP, achievements and grant history | Distinct set points, set/earning-scope XP ledger, award and completion records | Existing totals remain in the legacy system. New XP is not silently added to old XP or a network score. |
| Game/environment HMAC player identity | Same backend identity plus optional dual-proof central account linking | Keep the identity key stable. Linking is display consent and identity proof, not a history import. |
| Cloud saves and their conflict policy | No replacement save protocol | Continue existing save APIs. A save is not evidence of a validated achievement. |

## Before changing a live game

1. Inventory current definition versions, IDs, player identity derivation, XP policy, event sequence producer, retry/outbox behavior and every deployed build. Capture a private reconciliation snapshot using approved administrative access. Do not put player IDs or credentials in a public issue or manifest.
2. Decide whether this release begins a genuinely new optional set or needs continuity with an existing career. If continuity is required, pause that cutover until a reviewed migration mechanism and per-player reconciliation exist. **This preview provides no automatic legacy-award import, bulk identity mapping or XP transfer endpoint.** A correction permission is not an import permission.
3. Model the new set with stable IDs, a documented earning scope and explicit reward budget. Re-express event rules and test positive, negative, cap, retry and distinct-occurrence fixtures. Do not replay an old event archive to manufacture historical awards.
4. Get the exact project/environment enabled for the pilot. Deploy the required service/schema and use a scoped runtime credential. Validate and publish the tested manifest through Studio or its short-lived authoring grant. Bind the planned new build to that immutable release.
5. Test an authenticated disposable pilot identity end to end. Record the first accepted receipt, duplicate retry, rejected altered occurrence, isolated personal/validated state, logout/account switch and explicit collection consent. Simulation alone does not meet this gate.
6. Keep old builds on their existing progression contract. A new build may use the new set after the continuity decision is approved. If shadow comparison is needed, run the pure simulator without hosted writes; dual writing both reward systems can double visible rewards and requires an explicit temporary policy.
7. Reconcile totals, permissions and privacy before expanding eligibility. Document the player-visible explanation of old achievements versus the new set. Never display the two XP totals as one career merely because both belong to the same game.

## Identity and consent

The private game backend derives the existing game-scoped player ID. `binding.link.start` proves that session; the signed-in central account explicitly accepts the short-lived code. A matching email, browser-supplied ID or uploaded mapping table is insufficient. Conflicting career links fail instead of merging. Collection sharing and leaderboard participation have separate consent. Disconnect removes the public association; it does not grant a new history or silently erase the game's ledger.

After deleting an account, follow the service's deletion and retired-identity policy before any later re-link. Do not recreate a deleted career by replaying queued or retained events. Key rotation and mapping collisions require a deliberate identity migration review; changing the HMAC key cannot be presented as a fresh player onboarding shortcut.

## Rollback and maintenance

Disable the affected pilot/publication path or retire the faulty release using authorized controls. Keep legacy progression and unrelated gameplay operating. A new explicitly published safe release and build binding can restore new writes; deleting receipts, awards or save rows is not rollback. Reconciliation must explain any correction and retain its audit record. A revoked award's tombstone blocks accidental re-earning until an authorized restoration; it is not equivalent to a missing field.

The release receipt should contain old and new contract versions, manifest hash/revision, project/environment/build bindings, exact runtime/authoring scope, identity policy, tested receipt IDs, reconciliation counts, rollback owner and remaining pilot gates. No external independent onboarding or production migration is claimed by this guide.
