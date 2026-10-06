// Offline training provider. Never selected in connected mode; no external requests.
import { generateKeyPairSync, createHash, sign, randomBytes } from 'node:crypto';
import * as oidc from 'openid-client';
import { createAccountClient, issuer } from './account-client.mjs';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export const mockOrigin = 'https://game.example';
export function createMockAccount() {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'offline', alg: 'ES256', use: 'sig' };
  const codes = new Map();
  const configuration = new oidc.Configuration({ issuer,
    authorization_endpoint: issuer + '/oauth/authorize', token_endpoint: issuer + '/oauth/token',
    jwks_uri: issuer + '/.well-known/jwks.json', response_types_supported: ['code'],
    id_token_signing_alg_values_supported: ['ES256'], code_challenge_methods_supported: ['S256'],
  }, 'offline-demo', { client_secret: 'offline-only', id_token_signed_response_alg: 'ES256' }, oidc.ClientSecretPost('offline-only'));
  configuration[oidc.customFetch] = async (url, options) => {
    if (String(url) === issuer + '/.well-known/jwks.json') return Response.json({ keys: [jwk] });
    if (String(url) !== issuer + '/oauth/token') throw Error('Unexpected mock endpoint');
    const body = new URLSearchParams(options.body), record = codes.get(body.get('code'));
    codes.delete(body.get('code'));
    if (!record || record.expires <= Date.now() || body.get('client_id') !== 'offline-demo' ||
      body.get('client_secret') !== 'offline-only' || body.get('redirect_uri') !== mockOrigin + '/auth/callback' ||
      body.get('grant_type') !== 'authorization_code' || createHash('sha256').update(body.get('code_verifier') || '').digest('base64url') !== record.challenge)
      return Response.json({ error: 'invalid_grant' }, { status: 400 });
    const now = Math.floor(Date.now()/1000), input = encode({ alg:'ES256', kid:'offline' }) + '.' + encode({
      iss: issuer, sub:'offline-demo-player', aud:'offline-demo', nonce:record.nonce, iat:now, exp:now+300,
    });
    const signature = sign('sha256', Buffer.from(input), { key:pair.privateKey, dsaEncoding:'ieee-p1363' }).toString('base64url');
    return Response.json({ access_token:'offline-only', token_type:'Bearer', expires_in:300, id_token:input+'.'+signature });
  };
  const client = createAccountClient({ registrationCheck:async()=>({gameId:'offline-demo',environment:'simulation'}),playerIdKey:'offline-fixture-key-not-a-secret-12345',configuration, redirectUri:mockOrigin+'/auth/callback' });
  return { client,
    authorize(url) {
      const params = new URL(url).searchParams;
      for (const [key, value] of Object.entries({client_id:'offline-demo', redirect_uri:mockOrigin+'/auth/callback',response_type:'code',scope:'openid',code_challenge_method:'S256'}))
        if (params.get(key)!==value || params.getAll(key).length!==1) throw Error('Invalid mock authorization');
      for (const key of ['state','nonce','code_challenge']) if (!/^[A-Za-z0-9_-]{32,128}$/.test(params.get(key)||'') || params.getAll(key).length!==1) throw Error('Invalid mock challenge');
      for (const [key, value] of codes) if (value.expires <= Date.now()) codes.delete(key);
      if (codes.size>=1000) throw Error('Mock capacity reached');
      const code = randomBytes(32).toString('base64url');
      codes.set(code, { nonce:params.get('nonce'), challenge:params.get('code_challenge'), expires:Date.now()+60000 });
      return mockOrigin+'/auth/callback?'+new URLSearchParams({ code,state:params.get('state') });
    },
  };
}
