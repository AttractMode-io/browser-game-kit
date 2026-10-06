import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('account UI distinguishes offline simulation and shows only the relevant session action',async()=>{
 const code=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
 const originalDocument=globalThis.document,originalFetch=globalThis.fetch;
 try {
  for(const [index,session] of [{signedIn:false,demo:true},{signedIn:true,demo:true},{signedIn:false},{signedIn:true},null].entries()) {
   const nodes=Object.fromEntries(['#identity','form[action="/auth/login"]','form[action="/auth/logout"]','#target','#score'].map(selector=>[selector,{textContent:'',hidden:false,style:{},addEventListener(){}}]));
   globalThis.document={querySelector:selector=>nodes[selector]};
   globalThis.fetch=async()=>{if(!session)throw Error('offline');return Response.json(session);};
   await import('data:text/javascript;base64,'+Buffer.from(code+'\n// case '+index).toString('base64'));
   assert.equal(nodes['form[action="/auth/login"]'].hidden,session?Boolean(session.signedIn):true);
   assert.equal(nodes['form[action="/auth/logout"]'].hidden,session?!session.signedIn:true);
   if(session?.demo)assert.match(nodes['#identity'].textContent,/offline test identity/i);
   if(session?.demo&&!session.signedIn)assert.doesNotMatch(nodes['#identity'].textContent,/sign in with your Attract Mode account/);
  }
 } finally {globalThis.document=originalDocument;globalThis.fetch=originalFetch;}
});
test('guest gameplay starts before an unresolved account lookup',async()=>{
 const code=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch;
 let click,finish;
 const target={style:{},addEventListener(_event,fn){click=fn;}},score={};
 globalThis.document={querySelector:selector=>selector==='#target'?target:selector==='#score'?score:{}};
 globalThis.fetch=()=>new Promise(resolve=>{finish=resolve;});
 try {
  const pending=import('data:text/javascript;base64,'+Buffer.from(code+'\n// pending lookup').toString('base64'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof click,'function');click();assert.equal(score.textContent,'1 hits');
  finish(Response.json({signedIn:false}));await pending;
 } finally {globalThis.document=oldDocument;globalThis.fetch=oldFetch;}
});
