import test from 'node:test';
import assert from 'node:assert/strict';
import {createProgressionClient} from '../integrations/progression.mjs';
import {createProgressionBridge,createProgressionTransport} from '../progression-server.mjs';
const origin='https://game.example';
const req=body=>new Request(origin+'/am/progression',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('bridge never accepts browser reward writes or identity overrides',async()=>{
 const calls=[];const bridge=createProgressionBridge({origin,resolveSession:async()=>({playerId:'real',gameId:'game',environment:'sandbox'}),execute:async r=>{calls.push(r);return {xp:2};}});
 assert.equal((await bridge(req({action:'event.submit',data:{xp:999}}))).status,403);
 assert.equal((await bridge(req({action:'progress.get',playerId:'victim',data:{playerId:'victim',mode:'server_validated'}}))).status,200);
 assert.equal(calls[0].principal.playerId,'real');assert.equal(calls[0].principal.mode,'client_reported');assert.deepEqual(calls[0].data,{mode:'server_validated'});
});
test('bridge rejects cross-origin and anonymous access and bounds chunked bodies',async()=>{
 const bridge=createProgressionBridge({origin,resolveSession:async()=>null,execute:()=>assert.fail()});
 assert.equal((await bridge(req({action:'progress.get'}))).status,401);
 assert.equal((await bridge(new Request(origin,{method:'POST'}))).status,403);
 const signed=createProgressionBridge({origin,resolveSession:async()=>({playerId:'p'}),execute:()=>assert.fail()});
 assert.equal((await signed(req({action:'save.write',data:{value:'x'.repeat(70001)}}))).status,413);
});
test('save conflict preserves draft; account switch wipes local drafts and stale results',async()=>{
 const map=new Map();const storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k),removeItem:k=>map.delete(k)};
 const client=createProgressionClient({scope:'game:sandbox:p1',storage,fetch:async()=>Response.json({error:'Conflict',revision:3},{status:409})});
 client.cacheDraft('slot',{level:2},1);
 await assert.rejects(client.writeSave('slot',{level:2},1),e=>e.status===409);
 assert.equal(client.readDraft('slot').expectedRevision,1);
 client.setScope('game:sandbox:p2');assert.equal(map.size,0);assert.equal(client.readDraft('slot'),null);
 let resolve;const delayed=createProgressionClient({scope:'p1',fetch:()=>new Promise(r=>resolve=r)});const inflight=delayed.progress();delayed.setScope('p2');resolve(Response.json({xp:999}));await assert.rejects(inflight,/Account changed/);
});
test('transport disabled by default; pins bearer and refuses redirects',async()=>{
 assert.throws(()=>createProgressionTransport({endpoint:origin,credential:'am_pg_test'}),/enablement/);
 let captured;const execute=createProgressionTransport({enabled:true,endpoint:origin+'/api/progression',credential:'am_pg_test',fetch:async(u,options)=>{captured=options;return Response.json({xp:1});}});
 await execute({principal:{playerId:'real',gameId:'ignored'},action:'progress.get',data:{}});
 assert.equal(captured.redirect,'error');assert.equal(captured.headers.Authorization,'Bearer am_pg_test');assert.deepEqual(JSON.parse(captured.body),{action:'progress.get',data:{},playerId:'real'});
});
test('browser transport refuses network-path variants and redirects',async()=>{
 assert.throws(()=>createProgressionClient({endpoint:'/\\outside.example'}),/same-origin/);
 let captured;const client=createProgressionClient({scope:'p',fetch:async(_,options)=>{captured=options;return Response.json({});}});await client.progress();assert.equal(captured.redirect,'error');
});
import {progressionDisplayModels} from '../integrations/progression.mjs';
test('display models preserve hidden flags, own privacy and provenance without inventing levels',()=>{
 const m=progressionDisplayModels({progress:{xp:4,public:false,stats:{wins:2},achievements:{a:{title:'Earned',unlockedAt:'today'}}},definitions:{rules:[{achievementId:'a',stat:'wins',target:1,tiers:[2],hidden:true}]},board:{mode:'something_untrusted',period:'daily',entries:[{playerId:'public-alias',score:2}]}});
 assert.equal(m.level.level,undefined);assert.equal(m.achievements[0].unlocked,true);assert.equal(m.achievements[1].hidden,true);assert.equal(m.public,false);assert.equal(m.leaderboard.provenance,'client-reported');
});
test('lower-is-better achievement never renders a misleading increasing progress bar',()=>{
 const model=progressionDisplayModels({progress:{stats:{time:90}},definitions:{rules:[{achievementId:'fast',stat:'time',aggregation:'min',target:60}]}});
 assert.equal(model.achievements[0].progress,undefined);assert.match(model.achievements[0].description,/60 or less/);
});
