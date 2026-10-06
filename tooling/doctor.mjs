#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Never return configuration values, exception messages, tokens or callback queries.
export async function diagnose({ env = process.env, connected = false, online = false, fetchImpl = globalThis.fetch, nodeVersion = process.versions.node } = {}) {
  const checks = [];
  const add = (code, status, message) => checks.push({ code, status, message });
  add('NODE_VERSION', Number(nodeVersion.split('.')[0]) >= 24 ? 'pass' : 'fail', 'Use Node.js 24 or newer.');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  add('KIT_VERSION', 'pass', `Installed kit ${pkg.version}; pin a reviewed release for deployments.`);
  if (!connected) add('OFFLINE_SIMULATION', 'pass', 'Default demo uses a local signed fixture, not an integration sandbox or real player account.');
  else {
    add('ENVIRONMENT', (!env.AM_ENVIRONMENT || env.AM_ENVIRONMENT === 'production') ? 'pass' : 'fail', 'Connected mode currently supports approved production registration only. An isolated hosted sandbox issuer is not configured.');
    add('CLIENT_REGISTRATION', env.AM_GAME_CLIENT_ID?.trim() && env.AM_GAME_CLIENT_SECRET?.trim() ? 'pass' : 'fail', 'Set the approved client ID and server-only secret in your local environment. Presence does not verify registration.');
    add('PLAYER_ID_KEY', env.AM_PLAYER_ID_KEY && Buffer.byteLength(env.AM_PLAYER_ID_KEY) >= 32 ? 'pass' : 'fail', 'Set a persistent server-only player ID key with at least 32 bytes. Back it up securely; changing it changes game-scoped IDs.');
    let valid = false;
    try { const u = new URL(env.AM_GAME_REDIRECT_URI); valid = u.protocol === 'https:' && u.pathname === '/auth/callback' && !u.search && !u.hash && !u.username && !u.password; } catch {}
    add('CALLBACK_FORMAT', valid ? 'pass' : 'fail', 'Use the exact registered HTTPS URL ending /auth/callback with no query, fragment or credentials.');
    add('REGISTRATION_REVIEW', 'manual', 'Confirm the callback, approved origin and client belong to this game in the developer workspace. This command cannot inspect private registration.');
  }
  add('PRODUCTION_HOSTING', env.NODE_ENV === 'production' ? 'fail' : 'pass', 'Bundled server is development-only. Production requires durable atomic TTL storage and a reviewed backend.');
  if (online) {
    try {
      // Fixed public endpoint only: credentials are never sent. Redirects are rejected.
      const r = await fetchImpl('https://attractmode.io/developer-capabilities.json', { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
      if (!r.ok) throw Error();
      const text = await r.text();
      if (text.length > 131072) throw Error();
      const manifest = JSON.parse(text);
      if (!manifest || typeof manifest !== 'object' || !manifest.capabilities) throw Error();
      add('PUBLIC_CONNECTIVITY', 'pass', 'Official public capability manifest is reachable. This does not verify OAuth credentials or authorize production access.');
    } catch { add('PUBLIC_CONNECTIVITY', 'fail', 'Could not verify the official capability manifest within five seconds. Retry online diagnostics; offline guest demo remains available.'); }
  }
  return { schemaVersion: 1, mode: connected ? 'connected-development' : 'offline-simulation', ok: checks.every(c => c.status !== 'fail'), checks };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const known = new Set(['--connected', '--online']);
  if (process.argv.slice(2).some(arg => !known.has(arg))) { console.error('Usage: npm run doctor -- [--connected] [--online]'); process.exitCode = 2; }
  else { const report = await diagnose({ connected: process.argv.includes('--connected'), online: process.argv.includes('--online') }); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.ok ? 0 : 1; }
}
