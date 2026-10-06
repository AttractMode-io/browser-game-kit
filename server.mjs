import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { configureAccountClient, issuer } from './account-client.mjs';
import { createDemoHandler } from './demo-handler.mjs';
import { createMockAccount, mockOrigin } from './mock-account.mjs';

// A single-process development server, not a production hosting adapter.
export async function createGameServer({ connected = false, port = 3000, env = process.env } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid port');
  const production=env.NODE_ENV==='production';
  if(production&&(!connected||!env.AM_SESSION_DB||!env.AM_SESSION_KEY))throw Error('Production requires connected mode and durable atomic TTL storage configuration.');
  if (connected && env.AM_ENVIRONMENT && env.AM_ENVIRONMENT !== 'production') throw Error('No isolated sandbox issuer is configured. Use the offline simulation or an approved production registration.');
  const mock = connected ? null : createMockAccount();
  const client = connected ? await configureAccountClient({ clientId:env.AM_GAME_CLIENT_ID,clientSecret:env.AM_GAME_CLIENT_SECRET,redirectUri:env.AM_GAME_REDIRECT_URI,playerIdKey:env.AM_PLAYER_ID_KEY,gameId:env.AM_GAME_ID }) : mock.client;
  const store=production?(await import('./session-store.mjs')).createSessionStore({filename:env.AM_SESSION_DB,key:env.AM_SESSION_KEY}):undefined;
  const handle = createDemoHandler({ client, returnPaths:['/','/examples/threejs'], ...(store?{store}:{}) });
  let windowStart = Date.now(), authRequests = 0;
  const server = createServer(async (req,res) => {
    const localOrigin = 'http://127.0.0.1:'+server.address().port;
    const publicOrigin = connected ? client.origin : localOrigin;
    const formTargets = connected ? "'self' " + new URL(issuer).origin + ' https://attractmode.io' : "'self'";
    const headers = { 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
      'X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action ${formTargets}; frame-ancestors 'none'; base-uri 'none'` };
    const reply = (status, body, extra={}) => { res.writeHead(status, Object.fromEntries(Object.entries({ ...headers,...extra }).map(([name,value])=>[name.toLowerCase(),value]))); res.end(body); };
    const authFailure = (status = 400) => reply(status, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign-in could not finish</title></head><body><main><h1>Sign-in could not finish</h1><p>The request expired, was canceled, or could not be verified. Return to the game and try again.</p><p><a href="/">Back to the game</a></p></main></body></html>', {'Content-Type':'text/html; charset=utf-8'});
    try {
      // Ignore Forwarded / X-Forwarded-* input. Configure the trusted proxy to preserve the registered Host.
      if (req.headers.host !== new URL(publicOrigin).host || !req.url.startsWith('/') || req.url.startsWith('//')) return reply(403,'Wrong host');
      const url = new URL(req.url, publicOrigin);
      if (req.method !== 'GET' && req.method !== 'POST') return reply(405,'Method not allowed');
      if (req.method==='POST' && req.headers.origin!==publicOrigin) return reply(403,'Wrong origin');
      const length = Number(req.headers['content-length'] || 0);
      if (req.headers['transfer-encoding'] || !Number.isFinite(length) || length>4096) return reply(413,'Request too large');
      if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/mock/')) {
        if (Date.now()-windowStart>60000) { windowStart=Date.now();authRequests=0; }
        if (++authRequests>60) return reply(429,'Too many authentication attempts. Try again shortly.',{'Retry-After':'60'});
      }
      if (!connected && url.pathname==='/mock/authorize' && req.method==='GET') {
        const callback = mock.authorize(url);
        return reply(303,'',{'Location':callback.replace(mockOrigin,localOrigin)});
      }
      const assets = { '/examples/threejs':'examples/threejs.html','/examples/threejs.mjs':'examples/threejs.mjs','/integrations/threejs.mjs':'integrations/threejs.mjs','/integrations/account-ui.mjs':'integrations/account-ui.mjs','/vendor/three.module.js':'node_modules/three/build/three.module.js','/vendor/three.core.js':'node_modules/three/build/three.core.js','/':'index.html','/game.mjs':'game.mjs','/sample.css':'sample.css' };
      if (req.method==='GET' && Object.hasOwn(assets,url.pathname)) {
        let body = await readFile(new URL(assets[url.pathname],import.meta.url),'utf8');
        if (url.pathname==='/') body=body.replace('<main>', '<main><p class="mode-notice">'+(connected ? 'Connected account mode. Real Attract Mode sign-in.' : 'OFFLINE DEMO. No real account, credentials or internet access needed. The sign-in simulation uses a local test identity.')+'</p>');
        if (!connected && url.pathname==='/') body=body.replace('Sign in with Attract Mode','Simulate sign-in (offline)');
        // Documents retain Origin on same-origin form POSTs without sharing URL paths.
        // Private /auth and /api responses keep the default no-referrer policy.
        return reply(200,body,{...((url.pathname==='/'||url.pathname==='/examples/threejs')?{'Referrer-Policy':'strict-origin'}:{}),'Content-Type':(url.pathname.endsWith('.mjs')||url.pathname.endsWith('.js'))?'text/javascript; charset=utf-8':url.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});
      }
      const requestHeaders = new Headers();
      if (req.headers.cookie) requestHeaders.set('cookie', connected ? req.headers.cookie : req.headers.cookie.replaceAll('am-demo-flow=','__Host-am-game-flow=').replaceAll('am-demo-session=','__Host-am-game-session='));
      if (req.headers.origin) requestHeaders.set('origin',connected?req.headers.origin:client.origin);
      const response = await handle(new Request(client.origin+url.pathname+url.search,{method:req.method,headers:requestHeaders}));
      const extra = Object.fromEntries(response.headers);
      delete extra['set-cookie'];
      extra['set-cookie']=response.headers.getSetCookie().map(value=>connected?value:value.replace('__Host-am-game-flow=','am-demo-flow=').replace('__Host-am-game-session=','am-demo-session=').replace('; Secure',''));
      if (!connected && extra.location) {
        const location=new URL(extra.location);
        extra.location=location.origin===mockOrigin?extra.location.replace(mockOrigin,localOrigin):localOrigin+'/mock/authorize'+location.search;
      }
      if (response.status >= 400 && url.pathname.startsWith('/auth/')) {
        // Preserve cookie clearing without reflecting callback values or provider error text.
        res.setHeader('Set-Cookie', extra['set-cookie']);
        return authFailure(response.status);
      }
      let body=await response.text();
      if (!connected && url.pathname==='/api/me' && response.ok) body=JSON.stringify({...JSON.parse(body), demo:true});
      reply(response.status,body,extra);
    } catch {
      if (req.url.startsWith('/auth/')) return authFailure();
      reply(400,JSON.stringify({error:'Request could not be completed. Start again.'}),{'Content-Type':'application/json'});
    }
  });
  server.once('close',()=>store?.close());
  server.requestTimeout=10000; server.headersTimeout=10000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  try {
    const connected=process.argv.includes('--connected'), server=await createGameServer({connected,port:Number(process.env.PORT||3000)});
    console.log(connected ? 'Connected account adapter ready on loopback. Open your registered HTTPS origin through a trusted proxy.' : 'Offline demo: http://127.0.0.1:'+server.address().port+' (no real accounts)');
  } catch(error) { console.error(error.message);process.exitCode=1; }
}
