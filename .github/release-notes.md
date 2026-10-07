Developer onboarding fixes for the early-access progression kit.

- Runnable, clearly labeled local progression demo and validator quickstart.
- Progression configuration placeholders and hosted acceptance checklist.
- Clear boundaries for diagnostic checks, operator approval, and private platform tests.
- Updated MCP resource documentation.

Production progression still requires an approved project and scoped server credentials. No new permissions or hosted-service availability are introduced.

Fixes concurrent SQLite store initialization: configure busy timeout before acquiring journal/schema locks. Includes deterministic multi-process regression and Linux validation.
