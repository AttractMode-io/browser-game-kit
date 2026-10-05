# Get your game listed, connect accounts or arrange a playtest

You can do these separately. A listing sends players to your game. Verified page management proves authority over a specific page. Account integration needs a registered client. A managed playtest needs an agreed session. None automatically grants the others.

## Pick your next step

| Goal | Prepare | Send it here |
| --- | --- | --- |
| List a browser game | Game and studio, playable URL, description, genres, controls, devices, access requirements, official source, screenshot URLs, credit and permission | [Developer workspace](https://attractmode.io/developers), List a game |
| Add Attract Mode sign-in | Game and studio, build URL, production origin, exact callbacks, backend stack, requested identity use, ownership evidence | [Developer workspace](https://attractmode.io/developers), Add sign-in |
| Arrange a managed playtest | Build, questions, devices, access, simultaneous players, session minutes, preferred dates/timezone, proposed reward | [Developer workspace](https://attractmode.io/developers), Request a playtest |

Use public HTTPS links without embedded credentials, secret-bearing query values, fragments or custom ports. Use one callback or media URL per line, up to eight per field. The optional public contact is separate from account identity.

Check the catalog before requesting a listing. Claim an existing page instead of creating a duplicate. Reuse the same studio for multiple games and include its existing page URL in notes. A claim proves control of an established identity through the separate reviewed challenge flow; a submitted request is not proof of ownership.

## No interactive browser available?

Download the [text request template](https://attractmode.io/developer-request-template.txt) or [JSON template](https://attractmode.io/developer-request-template.json). Copies are bundled in `docs/developer-request-template.*`. Complete only the kind you need, then email it to **hello@attractmode.io** with a subject such as `Game listing: My Game`, `Sign-in request: My Game` or `Playtest request: My Game`.

This is a review route, not automatic publication. Unknown information should stay unknown with an explanation. An agent can prepare the draft; sending it still needs the developer's authorization. Do not create a public GitHub issue containing the submission. The templates are documents, not an anonymous write API. The MCP is read-only and cannot submit, email or change accounts.

Your public contact is optional. Only include an address there if you want it published. Account identity, request notes, review history and credentials are not public listing copy. Never include passwords, client secrets, payment details or private player data. Public screenshots must be yours, permitted by the creator or covered by the supplied press-kit permission; credit is not a substitute for permission.

## What happens after submission?

- **Draft:** private saved work, not sent. Fill missing fields and submit when ready.
- **Submitted:** waiting for review. Watch the workspace for a decision.
- **Changes requested:** read the note, edit the same request and resubmit.
- **Approved:** review passed; delivery is still pending. Read the next step in the note.
- **Declined:** read the reason. A declined request has not delivered the requested service.
- **Fulfilled:** an actual outcome has been recorded. Check the note and outcome link.

Approval is not a live game page, functioning OAuth client or booked tester session. Those results must be recorded separately. Existing publisher proposals remain available in the workspace; do not submit the same proposal again just because the new intake exists.

## Account integration: prepare while review runs

Run the [offline demo](../README.md) and [production checklist](go-live.md). Use your existing backend and preserve guest play where supported. Start with the minimum justified scope. Register exact production and staging callbacks separately; no wildcards or another game's client. Keep state, S256 PKCE, nonce, issuer/audience/signature/expiry validation and one-use browser-bound transactions.

Client configuration is delivered through an agreed private channel after review. Never paste a secret into the request, code, browser environment or issue. Use durable server-only TTL storage and an HTTPS backend. Third-party player consent remains mandatory. Test real registration and failure cases before describing the game as connected. A catalog page or verified claim cannot authorize player data access.

## Multiplayer playtests need a session plan

For a typing-race game, describe room creation, join links/codes, whether two players or eight must join simultaneously, and the behavior to observe. Supply session duration, timezone and proposed dates. Ask concrete questions about joining a room, starting a race or understanding results, rather than asking for a positive review.

The team reviews availability and scope before agreeing a session. Confirm hosting, participant count, feedback delivery and reward terms before testers are invited. A proposed reward is not authorization to charge anyone or pay testers. Approval alone does not schedule a test. No tester count, turnaround, positive rating, traffic or revenue is guaranteed. `/playtests` serves testers applying to available managed campaigns, not developer intake.

## Reference

[Publishing and claims](https://attractmode.io/docs/publishing) · [Accounts](https://attractmode.io/docs/accounts) · [Managed playtests](https://attractmode.io/docs/playtesting) · [Source](https://github.com/AttractMode-io/browser-game-kit) · [Download ZIP](https://github.com/AttractMode-io/browser-game-kit/releases/latest/download/attract-mode-browser-game-kit.zip)
