---
name: attract-mode-progression-release
description: Prepare and publish an explicitly authorized Attract Mode achievement set revision with verifiable release and compatibility evidence.
---

# Attract Mode Progression Release

Read the installed kit's docs/achievements.md and current game/project release policy. Inspect the current Studio revision and semantic diff, confirm fixtures and server validation, and bind the intended environment/build to the exact immutable release. Existing authorization determines whether publication may proceed; drafting does not imply it.

Remote CLI commands default to request previews. Execute only with a short-lived project-scoped token issued by authenticated Developer Studio, explicit environment and exact production project confirmation. Supply the token privately through AM_ACHIEVEMENTS_AUTHORING_TOKEN; never put it in arguments or output. Runtime credentials cannot author. Never copy browser cookies into scripts or claim a preview published. Check exact revision/hash and idempotency key, then verify the returned release and build binding. Reconcile an uncertain publication before retrying.

Publish complete code/artifact sets atomically through the project's approved workflow. Preserve historical awards and earning scopes; incompatible changes require a migration policy. Record rollback, real target checks and remaining access/device gates. Keep docs, package capability manifests, Markdown/llms outputs and skills consistent with actual shipped availability. Neither package edits nor an HTTP 200 proves service deployment, search indexing or assistant citations.
