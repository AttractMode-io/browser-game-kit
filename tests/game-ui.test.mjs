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
