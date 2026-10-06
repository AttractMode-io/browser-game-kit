import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSessionStore} from '../session-store.mjs';
const id='flow:'+'a'.repeat(43),key='ab'.repeat(32);
test('encrypted durable sessions survive reopen; concurrent stores consume once and enforce TTL',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'am-store-')),filename=join(dir,'sessions.db');let now=10000;
 try{let a=createSessionStore({filename,key,clock:()=>now});await a.set(id,{secret:'private-pkce-test'},20000);a.close();
 assert.equal(statSync(filename).mode&0o777,0o600);assert.equal(readFileSync(filename).includes(Buffer.from('private-pkce-test')),false);
 a=createSessionStore({filename,key,clock:()=>now});const b=createSessionStore({filename,key,clock:()=>now});
 assert.deepEqual(await a.get(id),{secret:'private-pkce-test'});
 const consumed=await Promise.all([a.take(id),b.take(id)]);assert.equal(consumed.filter(Boolean).length,1);
 await a.set(id,{value:1},20000);now=20001;assert.equal(await b.get(id),null);a.close();b.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('wrong key, capacity and invalid retention fail closed',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'am-store-')),filename=join(dir,'sessions.db');
 try{const a=createSessionStore({filename,key,clock:()=>10000,maxRecords:1});await a.set(id,{private:true},20000);
 const wrong=createSessionStore({filename,key:'cd'.repeat(32),clock:()=>10000});await assert.rejects(wrong.get(id));wrong.close();
 await assert.rejects(a.set('session:'+'b'.repeat(43),{},20000),/capacity/);await assert.rejects(a.set(id,{},4000000),/expiry/);a.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('separate Node processes cannot consume the same transaction twice',async()=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const run=promisify(execFile);
 const dir=mkdtempSync(join(tmpdir(),'am-store-')),filename=join(dir,'sessions.db');
 try{const a=createSessionStore({filename,key});await a.set(id,{single:true},Date.now()+60000);a.close();
 const script=`import {createSessionStore} from ${JSON.stringify(new URL('../session-store.mjs',import.meta.url).href)};const s=createSessionStore({filename:process.argv[1],key:process.argv[2]});console.log(Boolean(await s.take(process.argv[3])));s.close();`;
 const results=await Promise.all([0,1].map(()=>run(process.execPath,['--input-type=module','-e',script,filename,key,id])));
 assert.deepEqual(results.map(r=>r.stdout.trim()).sort(),['false','true']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
