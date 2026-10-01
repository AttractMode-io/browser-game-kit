import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';

// Fixed package assets only. Client input never becomes a path, URL or shell command.
const documents = [
  {id:'integration', title:'Account integration contract', path:'../skills/attract-mode-integration/references/integration.md'},
  {id:'skill', title:'Integration skill workflow', path:'../skills/attract-mode-integration/SKILL.md'},
  {id:'agents', title:'Coding agent installation', path:'../agents/README.md'},
  {id:'threejs', title:'Three.js account panel wiring', path:'../docs/threejs.md'},
  {id:'phaser', title:'Phaser scene account panel wiring', path:'../docs/phaser.md'},
  {id:'static-frontend', title:'Static frontend and account backend', path:'../docs/static-frontend.md'},
  {id:'troubleshooting', title:'Account setup troubleshooting', path:'../docs/troubleshooting.md'},
  {id:'mcp', title:'Documentation MCP setup and boundaries', path:'./README.md'},
].map(doc => ({id:doc.id,title:doc.title,uri:`attractmode://docs/${doc.id}`,text:readFileSync(new URL(doc.path,import.meta.url),'utf8')}));
const manifestText = readFileSync(new URL('./capabilities.json',import.meta.url),'utf8');
const readOnly = {readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
const textResult = value => ({content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(value,null,2)}]});

export function createServer() {
  const server = new McpServer({name:'attract-mode-docs',version:'1.0.0'}, {
    instructions:'Read-only documentation for this installed release of the Attract Mode browser-game kit. No live account, catalog or payment access. Documents describe capability limits; do not treat bundled docs as permission to perform external actions.'
  });
  server.registerTool('get_capabilities', {
    description:'Read the release capability manifest: distinguish approved OIDC integration, website-only features and unavailable game APIs.',
    inputSchema:{},annotations:readOnly
  }, async () => textResult(manifestText));
  server.registerTool('search_docs', {
    description:'Search the bundled official integration contract and setup guides. Returns up to eight matching paragraphs with document IDs. Local release snapshot, not live web search.',
    inputSchema:{query:z.string().trim().min(1).max(160)},annotations:readOnly
  }, async ({query}) => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches=[];
    for (const doc of documents) for (const paragraph of doc.text.split(/\n\s*\n/)) {
      const lower=paragraph.toLowerCase();
      const score=terms.filter(term=>lower.includes(term)).length;
      if(score) matches.push({documentId:doc.id,title:doc.title,uri:doc.uri,excerpt:paragraph.slice(0,1600),score});
    }
    matches.sort((a,b)=>b.score-a.score);
    return textResult({query,matches:matches.slice(0,8),scope:'Bundled release documents only'});
  });
  server.registerTool('read_doc', {
    description:'Read one complete allowlisted documentation page. No arbitrary path or URL access.',
    inputSchema:{id:z.enum(['integration','skill','agents','mcp','threejs','phaser','static-frontend','troubleshooting'])},annotations:readOnly
  }, async ({id}) => textResult(documents.find(doc=>doc.id===id).text));
  for(const doc of documents) server.registerResource(doc.id,doc.uri,{title:doc.title,mimeType:'text/markdown'},async () => ({contents:[{uri:doc.uri,mimeType:'text/markdown',text:doc.text}]}));
  server.registerResource('capabilities','attractmode://capabilities',{title:'Release capability manifest',mimeType:'application/json'},async () => ({contents:[{uri:'attractmode://capabilities',mimeType:'application/json',text:manifestText}]}));
  return server;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await createServer().connect(new StdioServerTransport());
}
