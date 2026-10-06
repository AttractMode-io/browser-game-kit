# Browser game kit 0.3.0: progression early access

Keep a player's checkpoint, show what they earned and handle saves from two devices without silently overwriting either one.

This release adds revisioned cloud-save SDK methods, achievement and game XP displays, provenance-separated leaderboards, explicit save-conflict recovery, and a same-origin bridge backed by verified account sessions. Server credentials stay outside browser code. Personal reports cannot submit trusted events or grant Attract Mode-wide reputation.

Progression is early access for approved integrations with separately issued scoped credentials. An external developer's hosted production pilot has not yet been completed. This release makes no throughput or cheat-proof promise: developers must validate the gameplay behind trusted events.

A durable single-host SQLite puzzle validator demonstrates atomic challenge consumption, stable events, an outbox, restart recovery and retry acknowledgements. It requires private persistent storage and an exclusive sequence producer. It is not distributed or serverless persistence.

The optional documentation MCP remains read-only. It describes the contract without issuing credentials, changing definitions or granting rewards.

Extract the ZIP, run `npm ci --ignore-scripts` and `npm run dev` using Node 24. The default account demo remains an offline simulation. For progression setup, trust levels, scopes and quotas, read `docs/progression.md`. The package does not include a hosted public sandbox. Existing 0.2.0 account configuration remains supported.

Source: https://github.com/AttractMode-io/browser-game-kit
Docs: https://attractmode.io/docs
Workspace: https://attractmode.io/developers
