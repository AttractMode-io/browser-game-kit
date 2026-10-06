# Add an account menu to a Three.js game

Keep your renderer and guest game running. The kit adds a small HTML account panel beside your canvas; sign-in happens through your game's backend. This recipe does not add achievements, cloud saves or shared XP.

## Run the included scene

Run `npm ci --ignore-scripts` and `npm run dev`, then open http://127.0.0.1:3000/examples/threejs. Three.js is pinned locally; the scene uses no CDN. Click the rotating cube or use the keyboard button while account lookup runs independently. The default server uses the clearly labeled offline account simulation.

## Wire your existing game

Copy `integrations/` into your project's browser source and bundle it using your existing build tool. Put a panel outside the canvas:

```html
<aside id="account-menu" aria-label="Player account"></aside>
```

Mount it once in your game startup module, after the element exists:

```js
import { mountThreeAccountUI } from './integrations/threejs.mjs';
const accountUI = mountThreeAccountUI({
  element: document.querySelector('#account-menu'),
});
// Keep your existing renderer.setAnimationLoop(...) or requestAnimationFrame loop.
// When your application tears down this game view:
// accountUI.dispose();
```

Use your existing menu layout for the panel. Keep it outside pointer-lock gameplay or release pointer lock before opening the menu. Do not call `refresh()` each frame. A login uses a normal form navigation, so plan how your game handles unsaved local progress before the player chooses to sign in. Account sign-in does not save that progress for you.

## Provide the backend

The panel reads `GET /api/me` and submits native same-origin forms to `POST /auth/login` and `POST /auth/logout`. Use the kit's backend contract and [account integration guide](account-integration.md). Never import `account-client.mjs` into your Three.js bundle. A live client requires separate registration and an exact HTTPS `/auth/callback` URL; third-party players see consent.

First run the offline kit to understand the flow. For a separately hosted static game, use the [same-origin frontend/backend deployment guide](static-frontend.md), then the [production checklist](go-live.md).

## What is tested

Automated tests cover the shared panel's guest, connected, offline, failed-request and teardown states, plus the backend's signed mock sign-in flow. The included scene is an integration example, not a replacement for testing your renderer, pointer-lock controls or a real registered client. HTTP tests verify its dependency paths; WebGL rendering needs a real-browser check. Run those checks in your own game before release.

The included scene uses a fixed `/examples/threejs` return path for login/logout. The server stores that allowlisted path with the sign-in transaction; it never follows arbitrary return URLs. Its practice-hit count is kept only in sessionStorage for this tab, including across sign-in navigation. This is local demo state, not account progression or cloud save. For another game route, configure a trusted server allowlist and matching frontend action; never accept unrestricted URLs.
