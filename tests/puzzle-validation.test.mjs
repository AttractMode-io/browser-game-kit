import test from 'node:test';import assert from 'node:assert/strict';
import {createPuzzleValidator,createMemoryPuzzleStore} from '../examples/validation/puzzle.mjs';
test('puzzle verifies ownership, answer, expiry and stable retry identity',async()=>{
 let now=0;const events=[];const validator=createPuzzleValidator({store:createMemoryPuzzleStore(),clock:()=>now,sendEvent:async e=>{events.push(e);return e;}});
 const c=await validator.issue('player',{question:'2+3',answer:'5'});assert.equal(c.digest,undefined);
 await assert.rejects(validator.solve('other',{challengeId:c.id,answer:'5'}),/Unknown/);
 await assert.rejects(validator.solve('player',{challengeId:c.id,answer:'9'}),/Incorrect/);
 const a=await validator.solve('player',{challengeId:c.id,answer:'5'}),b=await validator.solve('player',{challengeId:c.id,answer:'5'});assert.deepEqual(a,b);assert.equal(a.businessKey,c.id);
 now=300001;await assert.rejects(validator.solve('player',{challengeId:c.id,answer:'5'}),/expired/);
});
import {createTakeAwayMatch} from '../examples/validation/turn-based.mjs';
test('server board enforces turn/revision and stores identical terminal result',()=>{
 const match=createTakeAwayMatch(['a','b'],4);
 assert.throws(()=>match.act('b',{requestId:'bad',expectedRevision:0,take:1}),/Illegal/);
 match.act('a',{requestId:'one',expectedRevision:0,take:1});
 assert.throws(()=>match.act('b',{requestId:'stale',expectedRevision:0,take:3}),/Illegal/);
 const args={requestId:'win',expectedRevision:1,take:3};const a=match.act('b',args),b=match.act('b',args);assert.deepEqual(a,b);assert.equal(a.event.playerId,'b');
 assert.throws(()=>match.act('b',{...args,take:2}),/Changed/);
 assert.throws(()=>match.act('a',{requestId:'again',expectedRevision:2,take:1}),/Illegal/);
});
