import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAchievementClient,createAchievementScope} from '../integrations/achievements.mjs';
import {createAchievementBridge,createAchievementTransport} from '../achievements-server.mjs';
const event=(id='one')=>({eventId:id,occurrenceId:'run-'+id,buildId:'web-1',type:'level.completed',occurredAt:'2026-10-26T12:00:00.000Z',payload:{level:'harbor',won:true}});
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
const identity={playerId:'actual-player',gameId:'game',environment:'sandbox'};const expectedScope=createAchievementScope(identity);
const accepted=(id='one')=>Response.json({accepted:true,eventId:id,receiptId:'receipt-'+id,awards:[],provenance:'personal'});
test('offline event persists exactly and resumes after client recreation',async()=>{
 const disk=storage(),wire=[];
 const first=createAchievementClient({scope:'game:sandbox:alice',storage:disk,fetch:async()=>{throw Error('offline');}});
 assert.equal((await first.report({setId:'base',event:event()})).status,'pending');
 const next=createAchievementClient({scope:'game:sandbox:alice',storage:disk,fetch:async(url,init)=>{wire.push(JSON.parse(init.body));return accepted();}});
 assert.equal((await next.flush())[0].status,'accepted');assert.deepEqual(wire[0],{action:'event.report',data:{setId:'base',event:event()},expectedScope:'game:sandbox:alice'});assert.equal(next.pending().length,0);
});
test('account switch aborts delivery and clears private queue and ignores stale accepted receipt',async()=>{
 const disk=storage();let finish;const notices=[];
 const client=createAchievementClient({scope:'alice',storage:disk,fetch:()=>new Promise(resolve=>finish=resolve)});client.subscribe(e=>notices.push(e));
 const result=client.report({setId:'base',event:event()});client.setScope('bob');finish(accepted());
 await assert.rejects(result,e=>e.code==='account_changed');assert.equal(client.pending().length,0);assert.equal(disk.data.size,0);assert.equal(notices.some(n=>n.status==='accepted'),false);
});
test('rejects client authority fields, changed event payload and queue overflows without sending',async()=>{
 const client=createAchievementClient({scope:'alice',maxQueue:1,fetch:async()=>{throw Error();}});
 await assert.rejects(client.report({setId:'base',event:{...event(),xp:100}}),/semantic/);
 await client.report({setId:'base',event:event()});
 await assert.rejects(client.report({setId:'base',event:{...event(),payload:{won:false}}}),e=>e.code==='event_conflict');
 await assert.rejects(client.report({setId:'base',event:event('two')}),e=>e.code==='queue_full');
});
test('terminal rejection removes event; rate limiting retains it; expiry rejects without network',async()=>{
 let status=422,calls=0,time=0;
 const client=createAchievementClient({scope:'alice',now:()=>time,maxAgeMs:1000,fetch:async()=>{calls++;return Response.json({error:'invalid',code:'INVALID_EVENT'},{status});}});
 assert.equal((await client.report({setId:'base',event:event()})).status,'rejected');assert.equal(client.pending().length,0);
 status=429;assert.equal((await client.report({setId:'base',event:event('two')})).status,'pending');time=1001;
 assert.equal((await client.flush())[0].code,'expired');assert.equal(calls,2);
});
test('concurrent reports drain newly queued events without duplicate request',async()=>{
 let release;const sent=[];
 const client=createAchievementClient({scope:'alice',fetch:async(url,init)=>{const id=JSON.parse(init.body).data.event.eventId;sent.push(id);if(id==='one')await new Promise(r=>release=r);return accepted(id);}});
 const a=client.report({setId:'base',event:event()}),b=client.report({setId:'base',event:event('two')});release();assert.equal((await a).status,'accepted');assert.equal((await b).status,'accepted');assert.deepEqual(sent,['one','two']);
});
test('storage failure is explicit, no false pending durability or request',async()=>{
 let calls=0;const client=createAchievementClient({scope:'alice',storage:{getItem:()=>null,setItem(){throw Error();}},fetch:async()=>{calls++;return accepted();}});
 await assert.rejects(client.report({setId:'base',event:event()}),e=>e.code==='queue_unavailable');assert.equal(calls,0);
});
test('browser bridge checks Origin and session and derives identity while forbidding privileged actions',async()=>{
 const calls=[],bridge=createAchievementBridge({origin:'https://game.test',resolveSession:async()=>identity,execute:async input=>{calls.push(input);return {accepted:true};}});
 const req=body=>new Request('https://game.test/api/game-achievements',{method:'POST',headers:{Origin:'https://game.test','Content-Type':'application/json'},body:JSON.stringify({...body,expectedScope})});
 assert.equal((await bridge(req({action:'event.submit',data:{}}))).status,403);
 assert.equal((await bridge(req({action:'event.report',playerId:'spoof',data:{setId:'base',playerId:'spoof',event:{...event(),xp:99,mode:'publisher_validated'}}}))).status,200);
 assert.deepEqual(calls,[{playerId:'actual-player',action:'event.report',data:{setId:'base',event:event()}}]);
 assert.equal((await bridge(new Request('https://game.test/api/game-achievements',{method:'POST',body:'{}',headers:{Origin:'https://evil.test','Content-Type':'application/json'}}))).status,403);
});
test('runtime client requires enablement, HTTPS, scoped secret and does not accept authoring actions',async()=>{
 assert.throws(()=>createAchievementTransport({endpoint:'https://attractmode.io/api/achievements',credential:'am_pg_test'}),/enablement/);
 assert.throws(()=>createAchievementTransport({endpoint:'http://remote.test/api',enabled:true,credential:'am_pg_test'}),/HTTPS/);
 let sent;const transport=createAchievementTransport({endpoint:'https://attractmode.io/api/achievements',enabled:true,credential:'am_pg_test',fetch:async(url,init)=>{sent=init;return accepted();}});
 await assert.rejects(transport({action:'release.publish',playerId:'p',data:{}}),/Unsupported/);
 await transport({action:'event.report',playerId:'p',data:{setId:'base',event:event()}});assert.equal(sent.headers.Authorization,'Bearer am_pg_test');assert.equal(JSON.parse(sent.body).playerId,'p');
});

test('profile linking starts only on explicit call, derives game identity and returns a fixed-origin consent link',async()=>{
 const token='am_link_'+'a'.repeat(43),calls=[];
 const client=createAchievementClient({scope:'alice',fetch:async(url,init)=>{calls.push(JSON.parse(init.body));return Response.json({token,expiresAt:'soon',projectId:'p'});}});
 assert.equal(calls.length,0);const result=await client.startProfileLink();assert.deepEqual(calls,[{action:'binding.link.start',data:{},expectedScope:'alice'}]);assert.equal(result.consentUrl,'https://attractmode.io/achievements/collection#link='+token);
 const bridge=createAchievementBridge({origin:'https://game.test',resolveSession:async()=>identity,execute:async input=>{assert.deepEqual(input,{playerId:'actual-player',action:'binding.link.start',data:{}});return {token};}});
 const response=await bridge(new Request('https://game.test/api/game-achievements',{method:'POST',headers:{Origin:'https://game.test','Content-Type':'application/json'},body:JSON.stringify({action:'binding.link.start',expectedScope,data:{playerId:'spoof',projectId:'spoof'}})}));assert.equal(response.status,200);
});

test('enqueue stamps occurredAt once and retries retain the original time',async()=>{
 let now=Date.parse('2026-10-26T12:00:00Z');const wire=[];const client=createAchievementClient({scope:'alice',now:()=>now,fetch:async(url,init)=>{wire.push(JSON.parse(init.body));throw Error('offline');}});const raw=event();delete raw.occurredAt;
 await client.report({setId:'base',event:raw});now+=1000;await client.report({setId:'base',event:raw});assert.equal(wire[0].data.event.occurredAt,wire[1].data.event.occurredAt);assert.equal(wire[0].data.event.occurredAt,'2026-10-26T12:00:00.000Z');
});
test('same transport event ID in two sets returns the correct set receipt',async()=>{
 let release;const client=createAchievementClient({scope:'alice',fetch:async(url,init)=>{const body=JSON.parse(init.body);if(body.data.setId==='one')await new Promise(r=>release=r);return Response.json({accepted:true,eventId:body.data.event.eventId,setId:body.data.setId,receiptId:body.data.setId});}});
 const a=client.report({setId:'one',event:event()}),b=client.report({setId:'two',event:event()});release();assert.equal((await a).receipt.receiptId,'one');assert.equal((await b).receipt.receiptId,'two');
});

test('another-tab session switch rejects old queue before any gameplay write',async()=>{
 let writes=0;const bridge=createAchievementBridge({origin:'https://game.test',resolveSession:async()=>({...identity,playerId:'new-player'}),execute:async()=>{writes++;return {accepted:true};}});
 const response=await bridge(new Request('https://game.test/api/game-achievements',{method:'POST',headers:{Origin:'https://game.test','Content-Type':'application/json'},body:JSON.stringify({expectedScope,action:'event.report',data:{setId:'base',event:event()}})}));assert.equal(response.status,409);assert.equal(writes,0);
 const disk=storage(),client=createAchievementClient({scope:expectedScope,storage:disk,fetch:async()=>response.clone()});const result=await client.report({setId:'base',event:event()});assert.equal(result.code,'ACCOUNT_CHANGED');assert.equal(disk.data.size,0);assert.throws(()=>client.pending(),/Sign in/);
});
