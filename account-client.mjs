// Adapted from the existing False Start openid-client adapter, with third-party scope/consent rules.
import * as oidc from 'openid-client';
export const issuer = 'https://dupwygdktojsuuzatmih.supabase.co/auth/v1';
export async function configureAccountClient({
  clientId,
  clientSecret,
  redirectUri,
}) {
  if (!clientId || !clientSecret)
    throw Error('Use the client registration supplied for your game.');
  const configuration = await oidc.discovery(
    new URL(issuer),
    clientId,
    { client_secret: clientSecret, id_token_signed_response_alg: 'ES256' },
    oidc.ClientSecretPost(clientSecret),
  );
  return createAccountClient({ configuration, redirectUri });
}
export function createAccountClient({
  configuration,
  redirectUri,
  clock = Date.now,
}) {
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
    metadata.issuer !== issuer ||
    configuration.clientMetadata().id_token_signed_response_alg !== 'ES256'
  )
    throw Error('Unexpected identity configuration.');
  for (const name of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
    const endpoint = new URL(metadata[name]);
    if (
      endpoint.origin !== new URL(issuer).origin ||
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password ||
      endpoint.hash
    )
      throw Error('Unexpected identity endpoint.');
  }
  oidc.enableNonRepudiationChecks(configuration);
  return {
    origin: callback.origin,
    async begin() {
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
        claims.iss !== issuer
      )
        throw Error('Verified account identity required.');
      // Tokens never leave this backend adapter. No unnecessary refresh/offline token is retained.
      return {
        issuer,
        subject: claims.sub,
        expires: Math.min(clock() + 3600000, claims.exp * 1000),
      };
    },
  };
}
