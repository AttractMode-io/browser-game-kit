import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRegistrationCheck,derivePlayerId} from '../account-client.mjs';
test('registry check fails closed on revocation, sandbox, outage and redirects',async()=>{
 for(const value of [{active:false},{active:true,environment:'sandbox',gameId:'a'},{active:true,environment:'production',gameId:''}]) await assert.rejects(createRegistrationCheck('client',async()=>Response.json(value),'game')());
 await assert.rejects(createRegistrationCheck('client',async()=>{throw Error('secret');},'game')(),error=>!error.message.includes('secret'));
});
test('registry sends only public client ID to fixed endpoint',async()=>{
 const check=createRegistrationCheck('client',async(url,options)=>{assert.equal(url.origin,'https://attractmode.io');assert.equal(url.searchParams.get('client_id'),'client');assert.equal(options.redirect,'error');assert.equal(options.headers,undefined);return Response.json({active:true,environment:'production',gameId:'game'});},'game');
 assert.deepEqual(await check(),{gameId:'game',environment:'production'});
});

test('player identifiers are stable and isolated across game and environment',()=>{
 const key='k'.repeat(32),scope={gameId:'one',environment:'production'};
 const id=derivePlayerId(key,scope,'provider-user');
 assert.equal(id,derivePlayerId(key,scope,'provider-user'));
 for(const other of [{gameId:'two',environment:'production'},{gameId:'one',environment:'sandbox'}]) assert.notEqual(id,derivePlayerId(key,other,'provider-user'));
 assert.notEqual(id,derivePlayerId(key,scope,'another-user'));assert.notEqual(id,'provider-user');
 assert.notEqual(id,derivePlayerId('z'.repeat(32),scope,'provider-user'));
 assert.notEqual(id,derivePlayerId(key,scope,'provider-user','http://127.0.0.1:56421/auth/v1'));
});
test('existing game sessions stop reporting signed-in state immediately when registry validation fails',async()=>{
 const {createDemoHandler,createDemoStore}=await import('../demo-handler.mjs');
 const store=createDemoStore(),session='a'.repeat(43);let active=true;
 await store.set('session:'+session,{playerId:'scoped',gameId:'game',environment:'production',expires:Date.now()+60000},Date.now()+60000);
 const handle=createDemoHandler({store,client:{origin:'https://game.example',async validateSession(){if(!active)throw Error('revoked');}}});
 const request=()=>new Request('https://game.example/api/me',{headers:{cookie:'__Host-am-game-session='+session}});
 let response=await handle(request());assert.equal(response.status,200);assert.deepEqual((await response.json()).account,{playerId:'scoped',gameId:'game',environment:'production'});
 active=false;response=await handle(request());assert.equal(response.status,400);assert.equal((await response.json()).signedIn,undefined);
});
test('active registration for another game is rejected',async()=>{
 const check=createRegistrationCheck('client',async()=>Response.json({active:true,environment:'production',gameId:'other-game'}),'my-game');await assert.rejects(check());
});
