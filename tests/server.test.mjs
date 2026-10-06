import { test } from 'node:test';
import { get } from 'node:http';
import assert from 'node:assert/strict';
import { createGameServer } from '../server.mjs';
const cookieFrom = response => response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
test('one-command offline demo completes signed OIDC login and local logout',async t=>{
 const server=await createGameServer({port:0,env:{}}); t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 const request=(path,opts={})=>fetch(origin+path,{redirect:'manual',...opts});
 const html=await request('/'); assert.match(await html.text(),/OFFLINE DEMO/);
 assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal(html.headers.get('referrer-policy'),'strict-origin');
 assert.deepEqual(await (await request('/api/me')).json(),{signedIn:false,demo:true});
 const start=await request('/auth/login',{method:'POST',headers:{origin}}); assert.equal(start.status,303);
 assert.equal(start.headers.get('referrer-policy'),'no-referrer');
 assert.match(start.headers.get('location'),/\/mock\/authorize/);
 const flow=cookieFrom(start);assert.match(flow,/am-demo-flow=/);
 const authorize=await fetch(start.headers.get('location'),{redirect:'manual'});assert.equal(authorize.status,303);
 const finish=await fetch(authorize.headers.get('location'),{headers:{cookie:flow},redirect:'manual'}); assert.equal(finish.status,303);
 const session=cookieFrom(finish), me=await (await request('/api/me',{headers:{cookie:session}})).json();
 assert.equal(me.signedIn,true);assert.equal(me.account.gameId,'offline-demo');assert.equal(typeof me.account.playerId,'string');assert.equal('access_token' in me,false);
 const replay=await fetch(authorize.headers.get('location'),{headers:{cookie:flow},redirect:'manual'});assert.equal(replay.status,400);
 assert.equal((await request('/auth/logout',{method:'POST',headers:{origin,cookie:session}})).status,303);
 assert.deepEqual(await (await request('/api/me',{headers:{cookie:session}})).json(),{signedIn:false,demo:true});
});
test('server fails closed on hostile origins, hosts, static paths and production use',async t=>{
 const server=await createGameServer({port:0,env:{}});t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 for(const path of ['/.env','/account-client.mjs','/mock-account.mjs','/server.mjs','/package-lock.json'])assert.equal((await fetch(origin+path)).status,404);
 assert.equal((await fetch(origin+'/auth/login',{method:'POST',headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await fetch(origin+'/auth/login',{method:'POST'})).status,403);
 assert.equal((await fetch(origin+'/auth/login',{method:'POST',headers:{origin:'null'}})).status,403);
 assert.equal(await new Promise((resolve,reject)=>get(origin+'/',{headers:{host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject)),403);
 assert.equal((await fetch(origin+'//evil.example')).status,403);
 assert.equal((await fetch(origin+'/auth/login',{method:'PUT'})).status,405);
 await assert.rejects(createGameServer({port:0,env:{NODE_ENV:'production'}}),/Production requires/);
 await assert.rejects(createGameServer({port:0,connected:true,env:{}}),/registration/);
});
test('authentication attempts are bounded',async t=>{
 const server=await createGameServer({port:0,env:{}});t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 for(let i=0;i<60;i++)await fetch(origin+'/auth/unknown');
 const response=await fetch(origin+'/auth/login',{method:'POST',headers:{origin},redirect:'manual'});
 assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');
});
test('connected form redirects allow only the fixed identity and consent origins',async t=>{
 const originalFetch=globalThis.fetch;
 const issuer='https://dupwygdktojsuuzatmih.supabase.co/auth/v1';
 let discoveryRequests=0;
 globalThis.fetch=async url=>{
  assert.equal(String(url),issuer+'/.well-known/openid-configuration');discoveryRequests++;
  return Response.json({issuer,authorization_endpoint:issuer+'/oauth/authorize',token_endpoint:issuer+'/oauth/token',jwks_uri:issuer+'/.well-known/jwks.json',response_types_supported:['code'],id_token_signing_alg_values_supported:['ES256']});
 };
 let server;
 try {server=await createGameServer({port:0,connected:true,env:{AM_GAME_ID:'game',AM_PLAYER_ID_KEY:'k'.repeat(32),AM_GAME_CLIENT_ID:'test-only',AM_GAME_CLIENT_SECRET:'not-real',AM_GAME_REDIRECT_URI:'https://game.example/auth/callback'}});}
 finally {globalThis.fetch=originalFetch;}
 t.after(()=>new Promise(r=>server.close(r)));assert.equal(discoveryRequests,1);
 const headers=await new Promise((resolve,reject)=>get('http://127.0.0.1:'+server.address().port+'/',{headers:{host:'game.example'}},response=>{response.resume();resolve(response.headers);}).on('error',reject));
 assert.equal(headers['content-security-policy'].split(';').map(p=>p.trim()).find(p=>p.startsWith('form-action')),"form-action 'self' https://dupwygdktojsuuzatmih.supabase.co https://attractmode.io");
});
test('offline policy stays self-only and failed auth returns safe recovery HTML while API stays JSON',async t=>{
 const server=await createGameServer({port:0,env:{}});t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 const response=await fetch(origin+'/auth/callback?code=%3Cscript%3E&state=bad',{redirect:'manual'});
 assert.equal(response.status,400);assert.match(response.headers.get('content-type'),/text\/html/);
 assert.match(response.headers.get('content-security-policy'),/form-action 'self';/);
 const html=await response.text();assert.match(html,/href="\/"/);assert.doesNotMatch(html,/<script>|state=bad/);
 assert.match(response.headers.getSetCookie().join(';'),/Max-Age=0/);
 const api=await fetch(origin+'/api/me');assert.match(api.headers.get('content-type'),/application\/json/);
 assert.equal(api.headers.get('referrer-policy'),'no-referrer');
 assert.deepEqual(await api.json(),{signedIn:false,demo:true});
});
test('Three.js example serves only allowlisted local browser dependencies',async t=>{
 const server=await createGameServer({port:0,env:{}});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const path of ['/examples/threejs','/examples/threejs.mjs','/vendor/three.module.js','/vendor/three.core.js','/integrations/account-ui.mjs','/integrations/threejs.mjs']){
  const r=await fetch(base+path);assert.equal(r.status,200,path);if(path.endsWith('.js')||path.endsWith('.mjs'))assert.match(r.headers.get('content-type'),/javascript/);
 }
 assert.notEqual((await fetch(base+'/account-client.mjs')).status,200);
 assert.notEqual((await fetch(base+'/.env')).status,200);
});
test('production reference starts only with encrypted persistent session configuration',async t=>{
 const {mkdtemp,rm,stat}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'am-production-')),filename=join(dir,'sessions.db');
 const originalFetch=globalThis.fetch,issuer='https://dupwygdktojsuuzatmih.supabase.co/auth/v1';let server;
 globalThis.fetch=async url=>{assert.equal(String(url),issuer+'/.well-known/openid-configuration');return Response.json({issuer,authorization_endpoint:issuer+'/oauth/authorize',token_endpoint:issuer+'/oauth/token',jwks_uri:issuer+'/.well-known/jwks.json',response_types_supported:['code'],id_token_signing_alg_values_supported:['ES256']});};
 try {server=await createGameServer({port:0,connected:true,env:{NODE_ENV:'production',AM_SESSION_DB:filename,AM_SESSION_KEY:'ab'.repeat(32),AM_GAME_ID:'game',AM_PLAYER_ID_KEY:'k'.repeat(32),AM_GAME_CLIENT_ID:'test-only',AM_GAME_CLIENT_SECRET:'test-only',AM_GAME_REDIRECT_URI:'https://game.example/auth/callback'}});}
 finally{globalThis.fetch=originalFetch;}
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
 assert.equal((await stat(filename)).mode&0o777,0o600);
 const result=await new Promise((resolve,reject)=>get('http://127.0.0.1:'+server.address().port+'/api/me',{headers:{host:'game.example'}},r=>{let body='';r.on('data',c=>body+=c);r.on('end',()=>resolve({status:r.statusCode,body}));}).on('error',reject));
 assert.equal(result.status,200);assert.equal(JSON.parse(result.body).signedIn,false);
});
