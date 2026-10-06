import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createPuzzleStore,deliverPuzzleOutbox} from '../examples/validation/puzzle-store.mjs';
import {createPuzzleValidator} from '../examples/validation/puzzle.mjs';
test('durable challenge atomically creates one event, survives restart and retries until acknowledgement',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'am-puzzle-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const filename=join(dir,'state.db');let store=createPuzzleStore({filename});
 const validator=createPuzzleValidator({store,sendEvent:async e=>e});const c=await validator.issue('p',{question:'2+2',answer:'4'});
 const competing=createPuzzleStore({filename});const digest=(await import('node:crypto')).createHash('sha256').update('4').digest('hex');
 const events=await Promise.all([store.consumeSolved(c.id,'p',digest,Date.now()),competing.consumeSolved(c.id,'p',digest,Date.now())]);assert.deepEqual(events[0],events[1]);assert.equal(events[0].sequence,1);competing.close();store.close();
 store=createPuzzleStore({filename});assert.deepEqual((await store.pending())[0],events[0]);
 await assert.rejects(deliverPuzzleOutbox({store,sendEvent:async()=>{throw Error('timeout');}}),/timeout/);assert.equal((await store.pending()).length,1);
 const sent=[];assert.equal(await deliverPuzzleOutbox({store,sendEvent:async e=>sent.push(e)}),1);assert.deepEqual(sent[0],events[0]);assert.equal((await store.pending()).length,0);
 const retry=await store.consumeSolved(c.id,'p',digest,Date.now()+999999);assert.deepEqual(retry,events[0]);assert.equal((await store.pending()).length,0);store.close();
});
import {execFile} from 'node:child_process';import {promisify} from 'node:util';const exec=promisify(execFile);
test('separate processes consume a challenge only once',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'am-puzzle-race-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const filename=join(dir,'state.db');const store=createPuzzleStore({filename});await store.insert({id:'race',playerId:'p',digest:'digest',expiresAt:Date.now()+60000});store.close();
 const moduleURL=new URL('../examples/validation/puzzle-store.mjs',import.meta.url).href;
 const source=`import {createPuzzleStore} from ${JSON.stringify(moduleURL)};const s=createPuzzleStore({filename:process.argv[1]});console.log(JSON.stringify(await s.consumeSolved('race','p','digest',Date.now())));s.close();`;
 const results=await Promise.all([exec(process.execPath,['--input-type=module','-e',source,filename]),exec(process.execPath,['--input-type=module','-e',source,filename])]);assert.deepEqual(JSON.parse(results[0].stdout),JSON.parse(results[1].stdout));const reopened=createPuzzleStore({filename});assert.equal((await reopened.pending()).length,1);reopened.close();
});
