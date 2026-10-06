import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnose} from '../tooling/doctor.mjs';
test('offline doctor is credential-free and makes no network call', async () => {
 const report = await diagnose({env:{},fetchImpl:()=>{throw Error('network forbidden');}});
 assert.equal(report.ok,true); assert.equal(report.mode,'offline-simulation');
});
test('connected report rejects sandbox, invalid callback and production demo without leaking values', async () => {
 const report=await diagnose({connected:true,env:{AM_ENVIRONMENT:'sandbox',AM_GAME_CLIENT_ID:'private-id',AM_GAME_CLIENT_SECRET:'private-secret',AM_GAME_REDIRECT_URI:'https://private.example/auth/callback?token=secret',NODE_ENV:'production'}});
 assert.equal(report.ok,false); assert.doesNotMatch(JSON.stringify(report),/private-id|private-secret|private\.example|token=secret/);
 for(const code of ['ENVIRONMENT','CALLBACK_FORMAT','PRODUCTION_HOSTING']) assert.equal(report.checks.find(c=>c.code===code).status,'fail');
});
test('online doctor uses only fixed public endpoint and redacts remote errors',async()=>{
 const report=await diagnose({online:true,env:{},fetchImpl:async(url,options)=>{assert.equal(url,'https://attractmode.io/developer-capabilities.json');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);throw Error('SECRET');}});
 assert.equal(report.ok,false);assert.doesNotMatch(JSON.stringify(report),/SECRET/);
});
test('valid connected format never claims registration has been checked',async()=>{
 const report=await diagnose({connected:true,env:{AM_GAME_ID:'game',AM_PLAYER_ID_KEY:'k'.repeat(32),AM_GAME_CLIENT_ID:'id',AM_GAME_CLIENT_SECRET:'secret',AM_GAME_REDIRECT_URI:'https://game.example/auth/callback'}});
 assert.equal(report.ok,true);assert.equal(report.checks.find(c=>c.code==='REGISTRATION_REVIEW').status,'manual');
});
