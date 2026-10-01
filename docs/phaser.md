# Add an account menu to a Phaser game

Use an HTML panel beside your Phaser canvas. The account UI connects to your game's backend and leaves your scene's gameplay code alone. It does not grant access to an achievements or cloud-save API.

Copy `integrations/` into your browser source and add an element outside the canvas:

```html
<aside id="account-menu" aria-label="Player account"></aside>
```

In your existing scene module:

```js
import { attachPhaserAccountUI } from './integrations/phaser.mjs';
// Inside your scene's create() method:
this.accountUI = attachPhaserAccountUI(this, {
  element: document.querySelector('#account-menu'),
});
```

The adapter listens for the scene's `shutdown` event, removes the panel contents and ignores an in-flight response after shutdown. Re-entering the scene mounts a fresh panel. If your app removes the view without shutting down its scene, call `this.accountUI.dispose()` first. Give one scene ownership of each panel. Do not mount a new panel every update tick.

The UI uses native same-origin POST forms for sign-in and sign-out. That navigation leaves the current scene, so make your existing pause/progress behavior clear to the player. The kit does not persist game progress or merge a guest career into an account.

Serve `GET /api/me`, `POST /auth/login`, `GET /auth/callback` and `POST /auth/logout` on the game's origin. Keep the client secret and tokens on that backend. See [account integration](account-integration.md), [static hosting](static-frontend.md) and [go-live requirements](go-live.md). Live integration requires a registered client and player consent.

Tests exercise the panel state changes and scene shutdown listener with an event-emitter fixture, alongside the existing signed mock backend flow. They do not instantiate Phaser or validate a real registered-client integration. Test scene restarts, touch layout and sign-in navigation in your actual game.
