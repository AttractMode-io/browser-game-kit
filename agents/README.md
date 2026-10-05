# Use the kit with your coding agent

Give your agent a working contract so you can spend more time building your game. The same portable skill works in Codex, Claude Code, Cursor and Gemini CLI. No API key is needed to install it or run the local mock. Installing a skill does not register a game or enable production sign-in.

## Install into one project

From this downloaded kit's root, choose your agent and your existing game directory:

```sh
node agents/install.mjs codex /absolute/path/to/your-game
# or: claude, cursor, gemini
```

The installer copies only the bundled skill into that project's agent skill directory. It refuses an existing destination and symlinked destination directories. It never edits global settings, AGENTS.md, CLAUDE.md or an MCP configuration, never downloads code, and never installs dependencies. Review the installed folder before trusting it. To update, review the new release and replace the old skill yourself; the installer will not overwrite it.

| Agent | Project destination | Invoke |
| --- | --- | --- |
| Codex | .agents/skills/attract-mode-integration | `$attract-mode-integration` |
| Claude Code | .claude/skills/attract-mode-integration | `/attract-mode-integration` |
| Cursor | .cursor/skills/attract-mode-integration | Ask to use the Attract Mode integration skill |
| Gemini CLI | .gemini/skills/attract-mode-integration | Ask to use the Attract Mode integration skill |

Restart or reload your agent if the new skill is not discovered. These are coding-client integrations, not automatic installations into web chat. For another client that supports Agent Skills, copy the complete `skills/attract-mode-integration` folder into its documented skill directory. For plain chat, attach SKILL.md and its reference document yourself; the model cannot install code into your game without a development environment.

## A useful first prompt

> Use the Attract Mode integration skill to inspect this browser game. Run the kit's mock locally, add optional sign-in using my existing backend, and test cancellation, session expiry and logout. Keep guest play intact. Tell me what needs real client registration before production. Do not invent achievement or payment APIs.

For review:

> Review our Attract Mode integration against the skill's contract. Trace secrets, callback validation, durable one-use transaction storage and session lifecycle. Give me concrete fixes and run the relevant tests. Do not contact Attract Mode or deploy anything.

## Prepare a game submission or playtest request

> Read docs/developer-onboarding.md and the bundled request template. Prepare a listing request for my game using only verified facts and screenshots we may publish. Keep personal contact information private unless I explicitly mark it public. Show me the draft and missing information. Do not submit or email it yet.

For sign-in or playtests, select that request kind instead. A multiplayer playtest should state simultaneous-player requirements, room joining, timezone, session length and specific questions. The review workflow does not guarantee testers or approve payments.

## Optional local MCP

The [documentation MCP](../mcp/README.md) lets an MCP-capable agent search this release's bundled contract and read an explicit capability manifest without loading all the docs up front. It cannot register clients, read accounts, change listings or grant achievements. It is optional; the skill and mock work without it.

## Format references

Project skill paths were checked against these official sources September 29, 2026. Client behavior can change; use your client's current docs if it differs.

- [Agent Skills format](https://agentskills.io/specification)
- [Codex skills](https://developers.openai.com/codex/skills)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Cursor skills](https://cursor.com/docs/skills)
- [Gemini CLI skills](https://geminicli.com/docs/cli/skills/)
