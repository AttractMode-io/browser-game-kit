import { randomBytes } from 'node:crypto';
const random = () => randomBytes(32).toString('base64url');
const flowCookie = '__Host-am-game-flow',
  sessionCookie = '__Host-am-game-session';
const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
const readCookie = (request, name) => {
  const value =
    (request.headers.get('cookie') || '')
      .split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith(name + '='))
      ?.slice(name.length + 1) || '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
};
/** Demo-only bounded memory store. Production requires durable TTL storage and atomic take. */
export function createDemoStore(clock = Date.now) {
  const records = new Map();
  return {
    async set(key, value, expires) {
      for (const [k, v] of records) if (v.expires <= clock()) records.delete(k);
      if (records.size >= 1000) throw Error('Demo capacity reached.');
      records.set(key, { value, expires });
    },
    async get(key) {
      const row = records.get(key);
      if (!row || row.expires <= clock()) {
        records.delete(key);
        return null;
      }
      return row.value;
    },
    async take(key) {
      const row = this.get(key);
      records.delete(key);
      return row;
    },
  };
}
export function createDemoHandler({
  client,
  store = createDemoStore(),
  clock = Date.now,
}) {
  const response = (body, status = 200, cookies = [], location) => {
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    for (const value of cookies) headers.append('Set-Cookie', value);
    if (location) headers.set('Location', location);
    return new Response(JSON.stringify(body), { status, headers });
  };
  return async (request) => {
    const url = new URL(request.url);
    if (url.origin !== client.origin)
      return response({ error: 'Wrong game origin.' }, 403);
    if (
      request.method === 'POST' &&
      request.headers.get('origin') !== client.origin
    )
      return response({ error: 'Wrong request origin.' }, 403);
    try {
      if (url.pathname === '/auth/login' && request.method === 'POST') {
        const previous = readCookie(request, flowCookie);
        if (previous) await store.take('flow:' + previous);
        const flow = await client.begin(),
          id = random();
        await store.set(
          'flow:' + id,
          flow.transaction,
          flow.transaction.expires,
        );
        return response({}, 303, [cookie(flowCookie, id, 600)], flow.url);
      }
      if (url.pathname === '/auth/callback' && request.method === 'GET') {
        // Consume before exchange: callbacks cannot be replayed, even concurrently.
        const transaction = await store.take(
          'flow:' + readCookie(request, flowCookie),
        );
        const account = await client.complete(transaction, url.href),
          id = random();
        const previous = readCookie(request, sessionCookie);
        if (previous) await store.take('session:' + previous);
        await store.set('session:' + id, account, account.expires);
        return response(
          {},
          303,
          [
            cookie(flowCookie, '', 0),
            cookie(
              sessionCookie,
              id,
              Math.max(0, Math.floor((account.expires - clock()) / 1000)),
            ),
          ],
          client.origin + '/',
        );
      }
      if (url.pathname === '/auth/logout' && request.method === 'POST') {
        await store.take('session:' + readCookie(request, sessionCookie));
        await store.take('flow:' + readCookie(request, flowCookie));
        return response(
          {},
          303,
          [cookie(sessionCookie, '', 0), cookie(flowCookie, '', 0)],
          client.origin + '/',
        );
      }
      if (url.pathname === '/api/me' && request.method === 'GET') {
        const account = await store.get(
          'session:' + readCookie(request, sessionCookie),
        );
        if (account && client.validateSession) await client.validateSession(account);
        return response(
          account
            ? {
                signedIn: true,
                account: account.playerId ? {playerId:account.playerId,gameId:account.gameId,environment:account.environment} : { issuer: account.issuer, subject: account.subject },
              }
            : { signedIn: false },
        );
      }
      return response({ error: 'Not found.' }, 404);
    } catch {
      // Deliberately omit callback URL, code, token, state and provider error from logs/responses.
      return response({ error: 'Could not sign in. Start again.' }, 400, [
        cookie(flowCookie, '', 0),
      ]);
    }
  };
}
