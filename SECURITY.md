# Security policy

Report suspected vulnerabilities privately to **hello@attractmode.io**, with “Security: browser-game-kit” in the subject. Include the affected release, reproduction steps and expected/actual behavior. Do not include active credentials, player data or weaponized public demonstrations. Do not open a public issue containing an unpatched vulnerability or secret.

This kit is pre-1.0. Use the latest release and review its changelog; no response-time guarantee or bug-bounty payment is promised. The repository's code does not authorize testing other games, platform users or production infrastructure.

## Scope

The code demonstrates OIDC with a pinned issuer and backend-only tokens. The included development server uses temporary memory and refuses production mode. The local MCP has no network listener, write tools or credentials. Skill installation is project-scoped and refuses overwrite.

Connected development requires credentials issued for your own registered client. Never publish `.env`, tokens, cookies, PKCE verifiers or client secrets. Rotate a credential through its issuer if it is exposed; deleting a Git commit does not revoke it.

Production requires durable atomic TTL storage, trusted HTTPS, abuse limits, account deletion/revocation handling and a reviewed integration. Tests against the mock are not certification of your deployment.
