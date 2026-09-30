# Contributing

Start with an issue for a substantial change so the scope is clear. For a bug, include the release, Node version, minimal reproduction and the test that should pass. Remove credentials and player data. Security reports go to the private contact in SECURITY.md.

1. Fork the repository and create a focused branch.
2. Run `npm ci --ignore-scripts` and `npm test`.
3. For skill changes run `npm run test:agents`. For MCP changes run `npm --prefix mcp ci --ignore-scripts` and `npm --prefix mcp test`.
4. Update the relevant docs and changelog when behavior changes.
5. Open a pull request explaining the developer problem, resulting behavior and validation.

Preserve the pinned issuer, explicit third-party consent, exact callback matching, state/nonce/PKCE, token verification, backend secrets, atomic one-use transactions and privacy boundaries. No hidden telemetry, remote install scripts, invented APIs or changes to unrelated agent settings.

A maintainer reviews contributions before release. Use dependency lockfiles and keep GitHub Actions permissions minimal. Do not add private website source or internal operations records to this public kit.
