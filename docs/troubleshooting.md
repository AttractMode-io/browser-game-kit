# Troubleshoot your account integration

Start with the offline demo. It separates local setup problems from live registration and hosting problems. Never paste client secrets, cookies or callback query strings into a public issue.

| Symptom | Check |
| --- | --- |
| `npm ci` fails or Node APIs are missing | Use Node 24 or newer and the release's lockfile. Run installation from the directory containing `package.json`. |
| Port 3000 is occupied | Stop the other process or start with another `PORT`, such as `PORT=3001 npm run dev` in a POSIX shell. Open the printed `127.0.0.1` address. |
| `Wrong host` in the offline demo | Open `http://127.0.0.1:3000`, not a LAN hostname or a different host alias. The server intentionally binds only to loopback. |
| The panel shows an offline identity | Default mode is a simulation. Real login needs reviewed registration, server-side environment values and connected mode. |
| The UI says the account is unavailable | Inspect `/api/me` status and response type. It must reach your backend, not a static host's HTML fallback. Check same-origin routing. Guest play should remain available. |
| Sign-in expires or cannot finish | Start again from the game's login form. Do not reuse a callback, remove state validation or retry an old code. Check exact callback registration, cookie handling and server clock. |
| Login or logout returns 403 | Check the registered public origin and the native same-origin form POST. Do not disable Origin checks. |
| The server refuses production mode | Expected. Replace demo process-memory storage with a reviewed production adapter before deployment. |
| Login works but achievements or payments do not | This kit does not supply those public APIs. Check the capability manifest instead of guessing endpoints. |

For a reproducible bug, include the kit version, Node version, sanitized route/status, whether you used offline or connected mode, and the smallest steps that reproduce it in a [GitHub issue](https://github.com/AttractMode-io/browser-game-kit/issues). For security concerns use [SECURITY.md](../SECURITY.md).
