---
name: attract-mode-progression-qa
description: Verify Attract Mode achievement definitions, reward idempotency, sync isolation and player presentation before release.
---

# Attract Mode Progression Qa

Use the installed kit's docs/achievements.md and actual manifests/fixtures. Run validate, simulate and semantic diff, then meaningful integration tests against the deployed target or isolated backend. Local simulator results do not prove database locking or deployment state.

Cover exact retry, changed-payload same ID, same occurrence with a new ID, concurrent requests, condition boundaries, one-time XP, capped repeatable XP, compatible-release changes, delayed build events and rollback. Verify rejected/outage events cannot produce confirmed awards, account switches clear pending UI/queues, secret locked fields never leave projections, and publisher-validated results never follow from client assertions. Test public consent withdrawal separately from private progress.

Keep audio disabled at app level before browser/game tests. Exercise keyboard, narrow viewport, long text and text scaling. Record test commands, actual outcomes and explicit skipped device/real-Postgres checks. Do not label unrun production/native tests as passed; do not use real player accounts or mutate production rewards without task authorization.
