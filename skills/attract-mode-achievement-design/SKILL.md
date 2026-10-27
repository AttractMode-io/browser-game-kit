---
name: attract-mode-achievement-design
description: Design bounded achievement manifests and meaningful game progression for the Attract Mode achievement service.
---

# Attract Mode Achievement Design

Use the installed kit's docs/achievements.md, contracts/achievement-rules.mjs and examples/achievements/manifest.json as the executable contract. Locate the kit path in the project before running commands; this installed skill does not contain the SDK.

Define semantic gameplay events, bounded typed fields, stats and conditions before rewards. Preserve existing stable IDs and earning scopes. Separate per-game XP from achievement points; never mint shared network status. Prefer a small attainable set with positive and negative fixtures over grind or mandatory streaks. Secret achievements need safe locked projections, not an assumption that client code can conceal their rules.

Run the kit CLI validate, simulate and diff commands. Check replay, different-level and failure events. A simulation changes no real award. Keep a checked-in manifest as the same revision used in Studio, and resolve conflicts instead of replacing a teammate's work. Report unsupported mechanics explicitly rather than adding arbitrary script evaluation. Draft generation does not publish.
