import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import * as oidc from 'openid-client';
import {
  createAccountClient,
  issuer,
} from '../account-client.mjs';
import {
  createDemoHandler,
  createDemoStore,
} from '../demo-handler.mjs';
const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = {
  ...pair.publicKey.export({ format: 'jwk' }),
  kid: 'local-test',
  alg: 'ES256',
  use: 'sig',
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
function fixture() {
  let now = Date.now(),
    authorization,
    overrides = {},
    tamper = false,
    exchanges = 0;
  const metadata = {
    issuer,
    authorization_endpoint: issuer + '/oauth/authorize',
    token_endpoint: issuer + '/oauth/token',
    jwks_uri: issuer + '/.well-known/jwks.json',
    response_types_supported: ['code'],
    id_token_signing_alg_values_supported: ['ES256'],
    code_challenge_methods_supported: ['S256'],
  };
  const configuration = new oidc.Configuration(
    metadata,
    'registered-demo',
    {
      client_secret: 'not-a-real-secret',
      id_token_signed_response_alg: 'ES256',
    },
    oidc.ClientSecretPost('not-a-real-secret'),
  );
  configuration[oidc.customFetch] = async (url, options) => {
    if (String(url) === metadata.jwks_uri)
      return Response.json({ keys: [jwk] });
    assert.equal(String(url), metadata.token_endpoint);
    exchanges++;
    const body = new URLSearchParams(options.body);
    assert.equal(
      body.get('redirect_uri'),
      'https://game.example/auth/callback',
    );
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('client_id'), 'registered-demo');
    assert.equal(body.get('client_secret'), 'not-a-real-secret');
    assert.equal(
      createHash('sha256')
        .update(body.get('code_verifier'))
        .digest('base64url'),
      authorization.searchParams.get('code_challenge'),
    );
    const payload = {
      iss: issuer,
      sub: 'existing-attract-mode-subject',
      aud: 'registered-demo',
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 300,
      nonce: authorization.searchParams.get('nonce'),
      ...overrides,
    };
    const input =
      encode({ alg: 'ES256', kid: 'local-test' }) + '.' + encode(payload);
    const signature = sign('sha256', Buffer.from(input), {
      key: pair.privateKey,
      dsaEncoding: 'ieee-p1363',
    });
    if (tamper) signature[0] ^= 1;
    return Response.json({
      access_token: 'never-exposed',
      token_type: 'Bearer',
      expires_in: 300,
      id_token: input + '.' + signature.toString('base64url'),
    });
  };
  const client = createAccountClient({
    configuration,
    redirectUri: 'https://game.example/auth/callback',
    clock: () => now,
  });
  const handle = createDemoHandler({
    client,
    store: createDemoStore(() => now),
    clock: () => now,
  });
  const request = (path, options = {}) =>
    handle(new Request('https://game.example' + path, options));
  return {
    client,
    request,
    setClaims: (value) => (overrides = value),
    tamper: () => (tamper = true),
    advance: (ms) => (now += ms),
    get exchanges() {
      return exchanges;
    },
    async begin() {
      const response = await request('/auth/login', {
        method: 'POST',
        headers: { origin: 'https://game.example' },
      });
      assert.equal(response.status, 303);
      authorization = new URL(response.headers.get('location'));
      assert.equal(authorization.searchParams.get('scope'), 'openid');
      assert.equal(
        authorization.searchParams.get('code_challenge_method'),
        'S256',
      );
      assert.equal(authorization.searchParams.has('prompt'), false);
      const cookie = response.headers.getSetCookie()[0].split(';')[0];
      assert.match(
        response.headers.getSetCookie()[0],
        /Secure; HttpOnly; SameSite=Lax/,
      );
      return {
        cookie,
        callback:
          '/auth/callback?code=one-use-code&state=' +
          authorization.searchParams.get('state'),
      };
    },
  };
}
test('browser-game kit completes local mocked OIDC flow, keeps tokens server-only, and signs out locally', async () => {
  const f = fixture(),
    flow = await f.begin();
  const result = await f.request(flow.callback, {
    headers: { cookie: flow.cookie },
  });
  assert.equal(result.status, 303);
  assert.equal(f.exchanges, 1);
  const session = result.headers
    .getSetCookie()
    .find((c) => c.startsWith('__Host-am-game-session='))
    .split(';')[0];
  const me = await f.request('/api/me', { headers: { cookie: session } });
  assert.deepEqual(await me.json(), {
    signedIn: true,
    account: { issuer, subject: 'existing-attract-mode-subject' },
  });
  assert.equal(me.headers.get('cache-control'), 'no-store');
  assert.equal(
    (await f.request(flow.callback, { headers: { cookie: flow.cookie } }))
      .status,
    400,
  );
  assert.equal(f.exchanges, 1);
  assert.equal(
    (
      await f.request('/auth/logout', {
        method: 'POST',
        headers: { origin: 'https://evil.example', cookie: session },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request('/auth/logout', {
        method: 'POST',
        headers: { origin: 'https://game.example', cookie: session },
      })
    ).status,
    303,
  );
  assert.deepEqual(
    await (await f.request('/api/me', { headers: { cookie: session } })).json(),
    { signedIn: false },
  );
});
test('kit rejects wrong browser/state, expiry, cancellation and duplicate callback parameters before exchange', async () => {
  for (const mode of ['browser', 'state', 'expired', 'denied', 'duplicate']) {
    const f = fixture(),
      flow = await f.begin();
    let callback = flow.callback,
      cookie = flow.cookie;
    if (mode === 'browser') cookie = '';
    if (mode === 'state')
      callback = callback.replace(/state=.*/, 'state=wrong');
    if (mode === 'expired') f.advance(600001);
    if (mode === 'denied')
      callback = callback.replace('code=one-use-code', 'error=access_denied');
    if (mode === 'duplicate') callback += '&code=other';
    assert.equal(
      (await f.request(callback, { headers: { cookie } })).status,
      400,
    );
    assert.equal(f.exchanges, 0);
  }
});
test('kit validates ID token issuer, audience, nonce, expiry and signature', async () => {
  for (const variant of [
    { iss: 'https://evil.example' },
    { aud: 'other-client' },
    { nonce: 'wrong' },
    { exp: 1 },
    null,
  ]) {
    const f = fixture(),
      flow = await f.begin();
    if (variant) f.setClaims(variant);
    else f.tamper();
    const response = await f.request(flow.callback, {
      headers: { cookie: flow.cookie },
    });
    assert.equal(response.status, 400);
    assert.equal((await response.text()).includes('never-exposed'), false);
  }
});
test('kit requires exact origin and POST for login, and bounds the demo store', async () => {
  const f = fixture();
  assert.equal((await f.request('/auth/login')).status, 404);
  assert.equal(
    (await f.request('/auth/login', { method: 'POST' })).status,
    403,
  );
  const store = createDemoStore(() => 0);
  for (let i = 0; i < 1000; i++) await store.set(String(i), {}, 1);
  await assert.rejects(store.set('excess', {}, 1), /capacity/);
});

test('parallel callback replay exchanges a code only once', async () => {
  const f=fixture(),flow=await f.begin();
  const results=await Promise.all([f.request(flow.callback,{headers:{cookie:flow.cookie}}),f.request(flow.callback,{headers:{cookie:flow.cookie}})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[303,400]);assert.equal(f.exchanges,1);
});
test('demo session expires independently of browser cookie retention', async () => {
 const f=fixture(), flow=await f.begin();
 const finish=await f.request(flow.callback,{headers:{cookie:flow.cookie}});
 const session=finish.headers.getSetCookie().find(c=>c.startsWith('__Host-am-game-session=')).split(';')[0];
 f.advance(300001);
 assert.deepEqual(await (await f.request('/api/me',{headers:{cookie:session}})).json(),{signedIn:false});
});
