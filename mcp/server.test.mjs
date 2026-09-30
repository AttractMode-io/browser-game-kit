import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createServer} from './server.mjs';

async function local(t) {
 const server=createServer();
 const client=new Client({name:'kit-tests',version:'1.0.0'});
 const [a,b]=InMemoryTransport.createLinkedPair();
 await server.connect(a); await client.connect(b);
 t.after(async()=>{await client.close();await server.close();});
 return client;
}
test('SDK discovery exposes only three read-only tools and five fixed resources',async t=>{
 const client=await local(t);
 const {tools}=await client.listTools();
 assert.deepEqual(tools.map(t=>t.name).sort(),['get_capabilities','read_doc','search_docs']);
 for(const tool of tools){assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool.annotations.openWorldHint,false);}
 const {resources}=await client.listResources(); assert.equal(resources.length,5);
 for(const resource of resources){const result=await client.readResource({uri:resource.uri});assert.ok(result.contents[0].text.length>50);}
});
test('capability manifest explicitly bounds production and unavailable APIs',async t=>{
 const client=await local(t);
 const result=await client.callTool({name:'get_capabilities',arguments:{}});
 const manifest=JSON.parse(result.content[0].text);
 assert.equal(manifest.capabilities.find(c=>c.id==='accounts').status,'registration_required');
 for(const id of ['payments','achievements','shared-xp','cloud-saves']) assert.equal(manifest.capabilities.find(c=>c.id===id).status,'not_available_in_kit');
});
test('search finds contract and bounds output without regex interpretation',async t=>{
 const client=await local(t);
 const found=await client.callTool({name:'search_docs',arguments:{query:'PKCE callback'}});
 const value=JSON.parse(found.content[0].text);
 assert.ok(value.matches.length>0 && value.matches.length<=8);
 assert.equal(value.matches[0].documentId,'integration');
 assert.ok(value.matches.every(m=>m.excerpt.length<=1600));
 const weird=await client.callTool({name:'search_docs',arguments:{query:'[.*(a+)+$'}});
 assert.equal(JSON.parse(weird.content[0].text).matches.length,0);
 for(const query of ['', 'x'.repeat(161)]){
   const bad=await client.callTool({name:'search_docs',arguments:{query}});
   assert.equal(bad.isError,true);
 }
});
test('paths, URLs, unknown tools and unknown resources cannot expand the read surface',async t=>{
 const client=await local(t);
 for(const id of ['../../.env','https://example.com','constructor']) {
  const result=await client.callTool({name:'read_doc',arguments:{id}});assert.equal(result.isError,true);
 }
 const missing=await client.callTool({name:'write_file',arguments:{}});assert.equal(missing.isError,true);
 await assert.rejects(client.readResource({uri:'file:///etc/passwd'}));
});
test('real stdio child completes protocol negotiation and reads docs without secrets',async t=>{
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],env:{},stderr:'pipe'});
 const client=new Client({name:'stdio-smoke',version:'1.0.0'});
 t.after(()=>client.close());
 await client.connect(transport);
 const result=await client.callTool({name:'read_doc',arguments:{id:'integration'}});
 assert.match(result.content[0].text,/POST \/auth\/login/);
});
