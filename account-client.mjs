// Adapted from the existing False Start openid-client adapter, with third-party scope/consent rules.
if (typeof window !== 'undefined') throw Error('Attract Mode account-client is server-only. Import the browser account panel instead.');
import {createHmac} from 'node:crypto';
import * as oidc from 'openid-client';
export const issuer = 'https://dupwygdktojsuuzatmih.supabase.co/auth/v1';
export async function configureAccountClient({
  clientId,
  clientSecret,
  redirectUri,
  playerIdKey,
  gameId,
}) {
  if (!clientId || !clientSecret)
    throw Error('Use the client registration supplied for your game.');
  if (!playerIdKey || Buffer.byteLength(playerIdKey) < 32) throw Error('Configure a persistent server-only AM_PLAYER_ID_KEY of at least 32 bytes.');

  const configuration = await oidc.discovery(
    new URL(issuer),
    clientId,
    { client_secret: clientSecret, id_token_signed_response_alg: 'ES256' },
    oidc.ClientSecretPost(clientSecret),
  );
  return createAccountClient({ configuration, redirectUri, registrationCheck: createRegistrationCheck(clientId, globalThis.fetch, gameId), playerIdKey });
}
export function createAccountClient({
  configuration,
  redirectUri,
  clock = Date.now,
  registrationCheck,
  playerIdKey,
  expectedIssuer = issuer,
}) {
  const localTest = expectedIssuer === 'http://127.0.0.1:56421/auth/v1';
  if (expectedIssuer !== issuer && !localTest) throw Error('Unsupported identity issuer.');
  const callback = new URL(redirectUri);
  if (
    callback.protocol !== 'https:' ||
    callback.pathname !== '/auth/callback' ||
    callback.search ||
    callback.hash ||
    callback.username ||
    callback.password
  )
    throw Error('Register an exact HTTPS /auth/callback URL.');
  const metadata = configuration.serverMetadata();
  if (
    metadata.issuer !== expectedIssuer ||
    configuration.clientMetadata().id_token_signed_response_alg !== 'ES256'
  )
    throw Error('Unexpected identity configuration.');
  for (const name of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
    const endpoint = new URL(metadata[name]);
    if (
      endpoint.origin !== new URL(expectedIssuer).origin ||
      (endpoint.protocol !== 'https:' && !localTest) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.hash
    )
      throw Error('Unexpected identity endpoint.');
  }
  oidc.enableNonRepudiationChecks(configuration);
  return {
    origin: callback.origin,
    async validateSession(account) {
      if (!registrationCheck) return;
      const registration = await registrationCheck();
      if (account.gameId !== registration.gameId || account.environment !== registration.environment) throw Error('Registration changed.');
    },
    async begin() {
      if (registrationCheck) await registrationCheck();
      const transaction = {
        state: oidc.randomState(),
        nonce: oidc.randomNonce(),
        verifier: oidc.randomPKCECodeVerifier(),
        expires: clock() + 600000,
      };
      const url = oidc.buildAuthorizationUrl(configuration, {
        redirect_uri: callback.href,
        response_type: 'code',
        scope: 'openid',
        state: transaction.state,
        nonce: transaction.nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(
          transaction.verifier,
        ),
        code_challenge_method: 'S256',
      });
      // No prompt=none and no first-party bypass. Attract Mode presents third-party consent.
      return { url: url.href, transaction };
    },
    async complete(transaction, urlValue) {
      const url = new URL(urlValue);
      if (
        url.origin + url.pathname !== callback.href ||
        url.hash ||
        url.username ||
        url.password
      )
        throw Error('Unexpected callback.');
      if (!transaction || transaction.expires <= clock())
        throw Error('Sign-in expired.');
      for (const key of url.searchParams.keys())
        if (
          ![
            'code',
            'state',
            'iss',
            'error',
            'error_description',
            'error_uri',
          ].includes(key) ||
          url.searchParams.getAll(key).length !== 1
        )
          throw Error('Invalid callback parameters.');
      if (url.searchParams.get('state') !== transaction.state)
        throw Error('Sign-in state mismatch.');
      if (url.searchParams.has('error'))
        throw Error('Sign-in was canceled or denied.');
      const code = url.searchParams.get('code');
      if (!code || code.length > 2048)
        throw Error('Missing authorization code.');
      const tokens = await oidc.authorizationCodeGrant(configuration, url, {
        pkceCodeVerifier: transaction.verifier,
        expectedState: transaction.state,
        expectedNonce: transaction.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (
        typeof claims?.sub !== 'string' ||
        !claims.sub ||
        claims.iss !== expectedIssuer
      )
        throw Error('Verified account identity required.');
      const registration = registrationCheck ? await registrationCheck() : null;
      const playerId = registration ? derivePlayerId(playerIdKey, registration, claims.sub) : undefined;
      // Tokens never leave this backend adapter. No unnecessary refresh/offline token is retained.
      return {
        issuer: expectedIssuer,
        subject: claims.sub,
        ...(registration ? {playerId, gameId: registration.gameId, environment: registration.environment} : {}),
        expires: Math.min(clock() + 3600000, claims.exp * 1000),
      };
    },
  };
}

// Fixed public registry endpoint. No access token, subject or client secret is sent.
export function createRegistrationCheck(clientId, fetchImpl = globalThis.fetch, expectedGameId) {
  if (typeof clientId !== 'string' || !clientId || clientId.length > 256) throw Error('Invalid client ID.');
  if (typeof expectedGameId !== 'string' || !expectedGameId || expectedGameId.length > 256) throw Error('Configure the approved AM_GAME_ID.');
  return async () => {
    const url = new URL('https://attractmode.io/api/integration-status');
    url.searchParams.set('client_id', clientId);
    try {
      const r = await fetchImpl(url, {redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});
      if (!r.ok) throw Error();
      const value = await r.json();
      if (value.active !== true || value.environment !== 'production' || value.gameId !== expectedGameId) throw Error();
      return {gameId:value.gameId,environment:value.environment};
    } catch {throw Error('Game integration is inactive or its status could not be verified.');}
  };
}

export function derivePlayerId(key, registration, subject) {
  if (typeof key !== 'string' || Buffer.byteLength(key) < 32) throw Error('Persistent player ID key required.');
  return createHmac('sha256', key).update(JSON.stringify([registration.gameId, registration.environment, issuer, subject])).digest('base64url');
}
