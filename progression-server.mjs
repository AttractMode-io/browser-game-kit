import { Buffer } from 'node:buffer';
if(typeof window!=='undefined')throw Error('Progression server adapter must never run in a browser');
const browserActions=new Set(['definitions.get','save.get','save.write','save.recover','progress.get','progress.history','leaderboard.get','visibility.set','event.report']);
/** A Web Request handler. execute must be a server-only authenticated platform transport. */
export function createProgressionBridge({origin,resolveSession,execute}) {
  const expected=new URL(origin).origin;
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  return async request=>{
    if(request.method!=='POST')return reply(405,{error:'POST required'});
    if(new URL(request.url).origin!==expected||request.headers.get('origin')!==expected)return reply(403,{error:'Invalid origin'});
    if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(415,{error:'JSON required'});
    try {
      const session=await resolveSession(request);
      if(!session?.playerId)return reply(401,{error:'Sign in required'});
      if(!request.body)return reply(400,{error:'Body required'});
      const reader=request.body.getReader();const chunks=[];let length=0;
      while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>70000){await reader.cancel();return reply(413,{error:'Request too large'});}chunks.push(Buffer.from(value));}
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(!browserActions.has(body.action))return reply(403,{error:'Action requires a trusted server'});
      // Ignore all caller-supplied identity and credentials, including fields nested in data.
      const data={...body.data};for(const name of ['principal','playerId','gameId','environment','admin','credential'])delete data[name];
      if(!['progress.get','progress.history','leaderboard.get','definitions.get','visibility.set'].includes(body.action))delete data.mode;
      const result=await execute({principal:{projectId:session.projectId,gameId:session.gameId,environment:session.environment,playerId:session.playerId,mode:'client_reported',admin:false},action:body.action,data});
      return reply(200,result);
    }catch(error){const status=[400,401,403,404,409,413,429].includes(error.status)?error.status:503;return reply(status,{error:status===503?'Progress sync unavailable':error.message,...(status===409&&error.details?{conflict:error.details}:{})});}
  };
}
/** Explicit staged platform transport; do not expose this credential to game JavaScript. */
export function createProgressionTransport({endpoint,credential,enabled=false,fetch:request=globalThis.fetch}) {
  if(!enabled)throw Error('Stage 2 transport requires explicit enablement after deployment review');
  const url=new URL(endpoint);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw Error('HTTPS required outside local development');
  if(url.username||url.password||url.hash||url.search)throw Error('Use a fixed API endpoint without credentials or query');
  if(typeof credential!=='string'||!credential.startsWith('am_pg_'))throw Error('Scoped progression credential required');
  return async ({principal,action,data})=>{
    const response=await request(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${credential}`},body:JSON.stringify({action,data,playerId:principal.playerId}),signal:AbortSignal.timeout(10000)});
    const body=await response.json();
    if(!response.ok){const error=new Error(typeof body.error==='string'?body.error:'Progression request failed');error.status=response.status;error.details=body;throw error;}
    return body;
  };
}
