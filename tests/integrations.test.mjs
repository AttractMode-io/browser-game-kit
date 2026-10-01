import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mountAccountUI } from '../integrations/account-ui.mjs';
import { mountThreeAccountUI } from '../integrations/threejs.mjs';
import { attachPhaserAccountUI } from '../integrations/phaser.mjs';
function fixture() {
  const document = { createElement(tag) { return { tag, ownerDocument: document, children: [], attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, append(child) { this.children.push(child); }, replaceChildren(...children) { this.children = children; } }; } };
  return document.createElement('aside');
}
const response = value => async () => Response.json(value);
test('browser panel uses same-origin private session fetch and native POST forms', async () => {
  const element = fixture();
  const ui = mountThreeAccountUI({ element, fetchImpl: async (url, options) => {
    assert.equal(url, '/api/me'); assert.deepEqual(options, { credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    return Response.json({ signedIn: false });
  } });
  await ui.ready;
  const [status, login, logout] = element.children;
  assert.equal(status.attributes.role, 'status');
  assert.equal(login.action, '/auth/login'); assert.equal(login.method, 'post');
  assert.equal(logout.action, '/auth/logout'); assert.equal(logout.method, 'post');
  assert.equal(login.hidden, false); assert.equal(logout.hidden, true);
  assert.match(status.textContent, /guest/);
  ui.dispose(); assert.equal(element.children.length, 0);
});
test('connected and offline states remain distinct and never render account JSON as markup', async () => {
  for (const demo of [false, true]) {
    const element = fixture(); const ui = mountAccountUI({ element, fetchImpl: response({ signedIn: true, demo, handle: '<script>bad</script>' }) });
    await ui.ready;
    assert.equal(element.children[1].hidden, true); assert.equal(element.children[2].hidden, false);
    assert.match(element.children[0].textContent, demo ? /Offline test identity/ : /Attract Mode account/);
    assert.doesNotMatch(element.children[0].textContent, /script/);
    ui.dispose();
  }
});
test('failed, malformed and expired sessions leave guest play available without stale account controls', async () => {
  for (const fetchImpl of [async () => new Response('', { status: 500 }), response({signedIn:'yes'}), async () => { throw Error('network'); }]) {
    const element = fixture(); const ui = mountAccountUI({element, fetchImpl}); await ui.ready;
    assert.match(element.children[0].textContent, /Guest play still works/);
    assert.equal(element.children[1].hidden, true); assert.equal(element.children[2].hidden, true);
  }
});
test('older refresh cannot replace current identity and disposed views ignore late responses', async () => {
  const resolves = []; const element = fixture();
  const ui = mountAccountUI({element, fetchImpl: () => new Promise(resolve => resolves.push(resolve))});
  const fresh = ui.refresh(); resolves[1](Response.json({signedIn:false})); await fresh;
  resolves[0](Response.json({signedIn:true})); await ui.ready;
  assert.equal(element.children[1].hidden, false);
  const late = ui.refresh(); ui.dispose(); resolves[2](Response.json({signedIn:true})); await late;
  assert.equal(element.children.length, 0);
});
test('Phaser scene shutdown disposes panel and listeners, restart can mount anew', async () => {
  const scene = {events: new EventEmitter()}; const element = fixture();
  const ui = attachPhaserAccountUI(scene, {element,fetchImpl:response({signedIn:false})}); await ui.ready;
  assert.equal(scene.events.listenerCount('shutdown'), 1);
  scene.events.emit('shutdown'); assert.equal(element.children.length, 0); assert.equal(scene.events.listenerCount('shutdown'), 0);
  const next = attachPhaserAccountUI(scene, {element,fetchImpl:response({signedIn:true})}); await next.ready;
  assert.equal(element.children[2].hidden, false); next.dispose(); assert.equal(scene.events.listenerCount('shutdown'), 0);
  assert.throws(() => attachPhaserAccountUI({}, {element}), /Phaser scene/);
});
