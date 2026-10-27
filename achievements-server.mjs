import { Buffer } from 'node:buffer';
import {createAchievementScope} from './integrations/achievements.mjs';
if(typeof window!=='undefined')throw Error('Achievement server adapter must never run in a browser');
const actions=new Set(['event.report','event.submit','progress.get','binding.link.start']);
function apiEndpoint(value) {
  const url=new URL(value);
  if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('HTTPS required outside loopback');
  if(url.username||url.password||url.hash||url.search)throw Error('Use a fixed API endpoint');return url;
}
/** Private, server-only runtime transport. Authoring and corrections use distinct authority. */
export function createAchievementTransport({endpoint,credential,enabled=false,fetch:request=globalThis.fetch}) {
  if(!enabled)throw Error('Explicit enablement requires a deployed achievement service and approved registration');
  const url=apiEndpoint(endpoint);
  if(typeof credential!=='string'||!credential.startsWith('am_pg_'))throw Error('Scoped server credential required');
  return async ({playerId,action,data})=>{
    if(!actions.has(action))throw Error('Unsupported runtime action');
    if(['event.report','event.submit'].includes(action)&&(!data?.event?.occurredAt||!Number.isFinite(Date.parse(data.event.occurredAt))))throw Error('Persist occurredAt with the event before submitting or retrying');
    if(typeof playerId!=='string'||!playerId)throw Error('Authenticated game-scoped player ID required');
    const response=await request(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${credential}`},body:JSON.stringify({playerId,action,data}),signal:AbortSignal.timeout(10000)});
    const body=await response.json();
    if(!response.ok){const error=new Error(typeof body.error==='string'?body.error:'Achievement request failed');error.status=response.status;error.code=body.code;throw error;}return body;
  };
}
/** BFF bridge authenticates a game session and permits personal reporting only. */
export function createAchievementBridge({origin,resolveSession,execute}) {
  const expected=new URL(origin).origin;
  const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  return async request=>{
    if(request.method!=='POST')return reply(405,{error:'POST required'});
    if(new URL(request.url).origin!==expected||request.headers.get('origin')!==expected)return reply(403,{error:'Invalid origin'});
    if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(415,{error:'JSON required'});
    try {
      const session=await resolveSession(request);if(!session?.playerId)return reply(401,{error:'Sign in required'});
      if(!request.body)return reply(400,{error:'Body required'});
      const reader=request.body.getReader(), chunks=[];let length=0;
      while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>24000){await reader.cancel();return reply(413,{error:'Request too large'});}chunks.push(Buffer.from(value));}
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(body.expectedScope!==createAchievementScope(session))return reply(409,{error:'Account changed. Refresh before syncing.',code:'ACCOUNT_CHANGED'});
      if(!['event.report','progress.get','binding.link.start'].includes(body.action))return reply(403,{error:'Action requires separate authority'});
      const incoming=body.data||{},data=body.action==='binding.link.start'?{}:{setId:incoming.setId};
      if(body.action==='event.report') {
        const event=incoming.event||{};
        data.event=Object.fromEntries(['eventId','occurrenceId','buildId','type','payload','occurredAt'].filter(key=>Object.hasOwn(event,key)).map(key=>[key,event[key]]));
      } else if(body.action==='progress.get'&&['personal','publisher_validated'].includes(incoming.mode))data.mode=incoming.mode;
      return reply(200,await execute({playerId:session.playerId,action:body.action,data}));
    }catch(error){const status=error instanceof SyntaxError?400:([400,401,403,404,409,413,422,429].includes(error.status)?error.status:503);return reply(status,{error:status===503?'Achievement sync unavailable':status===400?'Invalid request':error.message,code:typeof error.code==='string'?error.code:'request_failed'});}
  };
}
