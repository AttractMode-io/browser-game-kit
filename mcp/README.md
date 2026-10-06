# Attract Mode documentation MCP

An optional **local, read-only** server for agents that can use MCP. It answers “how do I connect player accounts?” and “does this kit support payments?” from a small, versioned set of bundled official documents. This keeps capabilities and integration instructions available without exposing a production control plane.

The skill works without MCP. Use this server if your agent benefits from searchable docs or cannot read the kit files directly. This is not a hosted MCP endpoint, a marketplace submission or an automatic recommendation system.

## Install and test

Use Node 24 or later. From the kit root:

```sh
npm --prefix mcp ci --ignore-scripts
npm --prefix mcp test
```

Dependency versions are locked. Review this repository before running its code. No credentials, account connection or environment variables are needed. There are no install hooks. Run the server directly as `node /absolute/path/to/browser-game-kit/mcp/server.mjs`; do not use `npm start` as the client's transport command because npm may write non-protocol output to stdout.

## Connect your client

Replace the absolute path below. Add only this entry to your client's existing MCP configuration, preserving its other servers. Do not replace an entire config file. Node must be on the client's PATH, or use its absolute executable path.

For clients using `mcpServers` JSON (Claude Desktop/Claude Code, Cursor and Gemini CLI), the server entry is:

```json
{
  "mcpServers": {
    "attract-mode-docs": {
      "command": "node",
      "args": ["/absolute/path/to/browser-game-kit/mcp/server.mjs"]
    }
  }
}
```

Use your client's normal MCP settings UI or documented project config location. The JSON shape is an example to merge, not an installer. Local stdio cannot be reached by a remote web-chat client without a separately configured bridge; this kit does not start one.

For Codex, add a local stdio MCP entry to the selected project's trusted config (or use Codex's MCP settings):

```toml
[mcp_servers.attract-mode-docs]
command = "node"
args = ["/absolute/path/to/browser-game-kit/mcp/server.mjs"]
```

Restart/reconnect and check that `get_capabilities`, `search_docs` and `read_doc` appear. Try: “Use Attract Mode docs to explain the production login requirements and whether payments are currently supported.” Stop and resolve startup errors instead of guessing from an unavailable server.

## Tools and resources

| Tool | Input | Result |
| --- | --- | --- |
| get_capabilities | none | Release date, supported surfaces, registration requirements and unavailable API list. |
| search_docs | query, 1–160 characters | Up to eight relevant paragraphs from fourteen fixed documents. |
| read_doc | one of the fourteen document IDs below | One bundled page. |

Document IDs: `production-storage`, `local-sandbox`, `diagnostics`, `package-boundaries`, `integration`, `onboarding`, `request-template`, `skill`, `agents`, `threejs`, `phaser`, `static-frontend`, `troubleshooting`, and `mcp`.

The `onboarding` document explains listing, sign-in and managed-playtest intake. The `request-template` document supplies the offline checklist; it cannot submit anything.

The same pages are MCP resources under `attractmode://docs/…`. `attractmode://capabilities` contains the JSON capability manifest. These are MCP resource identifiers, not HTTP services. Search covers this downloaded release, not the live site's game catalog. Update the kit to get newer documentation.

## Security boundary

The server reads only fifteen hardcoded package assets at startup: fourteen documents and the capability manifest. No client-controlled filesystem path, shell command, URL fetch, account access, telemetry, credentials, environment inspection or write tool exists. It does not listen on a network port. Tool arguments are schema-validated and search results are bounded. MCP client permissions still apply; read-only annotations describe behavior, not a grant of authority. This package has no production account credentials to expose.

MCP does not make unimplemented platform APIs available. Cloud saves, achievements, game XP and statistics require an approved integration and scoped server credentials; read the progression guide. Shared XP, payments, subscriptions and revenue sharing remain unavailable. A production OAuth client still requires independent registration. Keep this documentation server local; adding a public HTTP gateway needs a separate security design and is outside this kit.

[Official MCP server documentation](https://modelcontextprotocol.io/docs/develop/build-server) and the official TypeScript SDK are the protocol references. Transport tests use an actual SDK client and child-process stdio, not hand-written protocol mocks.

Client configuration references: [Codex](https://developers.openai.com/codex/mcp), [Claude Code](https://code.claude.com/docs/en/mcp), [Cursor](https://cursor.com/docs/mcp), [Gemini CLI](https://geminicli.com/docs/tools/mcp-server/). Checked September 29, 2026.
