/** Headless personal-report client. No credentials, identity assertions or reward amounts. */
export class AchievementError extends Error {
  constructor(code, message, status = 0) { super(message); this.name = 'AchievementError'; this.code = code; this.status = status; }
}
export function createAchievementScope(account) {
  if(!account||['gameId','environment','playerId'].some(key=>typeof account[key]!=='string'||!account[key]))throw new Error('Authenticated game, environment and player scope required');
  return JSON.stringify([account.gameId,account.environment,account.playerId]);
}
const clone = value => JSON.parse(JSON.stringify(value));
const allowedEvent = new Set(['eventId', 'occurrenceId', 'buildId', 'type', 'payload', 'occurredAt']);
function eventCopy(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) || Object.keys(event).some(key => !allowedEvent.has(key))) throw new AchievementError('invalid_event', 'Use semantic event fields only');
  for (const key of ['eventId','occurrenceId','buildId','type']) if (typeof event[key] !== 'string' || !event[key] || event[key].length > 100) throw new AchievementError('invalid_event', `Missing or invalid ${key}`);
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload) || JSON.stringify(event).length > 16000) throw new AchievementError('invalid_event', 'Event payload must be a bounded object');
  if(typeof event.occurredAt!=='string'||!Number.isFinite(Date.parse(event.occurredAt)))throw new AchievementError('invalid_event','Valid occurredAt timestamp required');
  return clone(event);
}
function endpointCheck(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('/') || endpoint.startsWith('//') || /[\\?#\r\n]/.test(endpoint)) throw new Error('Use a fixed same-origin endpoint');
}
/** storage is the localStorage interface; memory-only mode is explicitly reported when omitted. */
export function createAchievementClient({ endpoint='/api/game-achievements', fetch:request=globalThis.fetch, storage, scope=null, maxQueue=100, maxAgeMs=7*86400000, now=Date.now, timeoutMs=10000 }={}) {
  endpointCheck(endpoint);
  if (!Number.isInteger(maxQueue) || maxQueue < 1 || maxQueue > 500 || !Number.isFinite(maxAgeMs) || maxAgeMs < 1000 || maxAgeMs > 7*86400000) throw Error('Invalid queue limits');
  let current=scope, generation=0, disposed=false, running=null;
  const inFlight=new Set(), listeners=new Set(), memory=new Map();
  const prefix='am-achievements:v1:';
  const key=()=>prefix+encodeURIComponent(current);
  const store=storage || {getItem:k=>memory.get(k)??null, setItem:(k,v)=>memory.set(k,v), removeItem:k=>memory.delete(k)};
  const assertSession=()=>{ if(disposed || !current)throw new AchievementError('signed_out','Sign in before syncing achievements',401); };
  const notify=event=>{for(const listener of listeners){try{listener(clone(event));}catch{/* UI must not interrupt committed sync */}}};
  function read() {
    assertSession();
    try { const raw=store.getItem(key()); const data=raw?JSON.parse(raw):[]; if(!Array.isArray(data)||data.length>maxQueue)throw Error(); return data.filter(row=>row && typeof row.setId==='string' && row.event && Number.isFinite(row.queuedAt)); }
    catch { throw new AchievementError('queue_unavailable','Stored progress could not be read; clear this account queue before retrying'); }
  }
  function write(rows) { try {store.setItem(key(),JSON.stringify(rows));}catch{throw new AchievementError('queue_unavailable','Progress could not be stored. Gameplay can continue.');} }
  async function call(action,data) {
    assertSession(); const started=generation, controller=new AbortController(); inFlight.add(controller);
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await request(endpoint,{method:'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,expectedScope:current}),signal:controller.signal});
      const body=await response.json();
      if(started!==generation)throw new AchievementError('account_changed','Account changed during sync',409);
      if(!response.ok&&body.code==='ACCOUNT_CHANGED')notify({status:'account_changed'});
      if(!response.ok)throw new AchievementError(body.code || 'request_rejected',typeof body.error==='string'?body.error:'Progress request failed',response.status);
      return body;
    } finally {clearTimeout(timer);inFlight.delete(controller);}
  }
  async function drain() {
    assertSession(); const started=generation, results=[];
    while(started===generation) {
      const queue=read(); if(!queue.length)break;
      const item=queue[0];
      if(now()-item.queuedAt>maxAgeMs) {write(queue.slice(1));const result={status:'rejected',code:'expired',eventId:item.event.eventId,setId:item.setId};results.push(result);notify(result);continue;}
      try {
        const receipt=await call('event.report',{setId:item.setId,event:item.event});
        if(started!==generation)break;
        if(receipt.accepted!==true)throw new AchievementError('invalid_receipt','Server did not confirm acceptance',503);
        // Re-read: report() may have appended events while this request was in flight.
        write(read().filter(row=>!(row.setId===item.setId && row.event.eventId===item.event.eventId)));
        const result={status:'accepted',eventId:item.event.eventId,setId:item.setId,receipt};results.push(result);notify(result);
      } catch(error) {
        if(started!==generation)throw new AchievementError('account_changed','Account changed during sync',409);
        if(error.code==='ACCOUNT_CHANGED'){
          try{store.removeItem(key());}catch{}
          generation++;current=null;for(const controller of inFlight)controller.abort();running=null;
          const result={status:'rejected',setId:item.setId,eventId:item.event.eventId,code:'ACCOUNT_CHANGED'};results.push(result);notify({status:'account_changed'});break;
        }
        if(error.status===401 || error.status===403 || !error.status || error.status===408 || error.status===429 || error.status>=500) {
          const result={status:'pending',eventId:item.event.eventId,setId:item.setId,code:error.status===401?'sign_in_required':'sync_unavailable'};results.push(result);notify(result);break;
        }
        write(read().filter(row=>!(row.setId===item.setId && row.event.eventId===item.event.eventId)));
        const result={status:'rejected',eventId:item.event.eventId,setId:item.setId,code:error.code,statusCode:error.status};results.push(result);notify(result);
      }
    }
    return results;
  }
  function flush() {assertSession();if(running)return running;const task=drain();running=task;task.finally(()=>{if(running===task)running=null;}).catch(()=>{});return task;}
  return {
    get persistence(){return storage?'durable':'memory';},
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    async report({setId,event}) {
      assertSession(); if(typeof setId!=='string'||!setId||setId.length>100)throw new AchievementError('invalid_set','Set ID required');
      const queue=read(),existing=queue.find(row=>row.setId===setId&&row.event.eventId===event?.eventId);
      const safe=eventCopy({...event,occurredAt:event?.occurredAt||existing?.event.occurredAt||new Date(now()).toISOString()});
      if(existing && JSON.stringify(existing.event)!==JSON.stringify(safe))throw new AchievementError('event_conflict','An event ID cannot be reused with a different payload',409);
      if(!existing) {if(queue.length>=maxQueue)throw new AchievementError('queue_full','Pending queue is full. Retry sync before reporting more events.');write([...queue,{setId,event:safe,queuedAt:now()}]);}
      notify({status:'pending',eventId:safe.eventId,setId});
      const results=await flush();return results.find(row=>row.eventId===safe.eventId&&row.setId===setId)||{status:'pending',eventId:safe.eventId,setId};
    },
    flush,
    pending(){return read().map(row=>({setId:row.setId,eventId:row.event.eventId,queuedAt:row.queuedAt}));},
    getProgress:({setId,mode}={})=>call('progress.get',{setId,...(mode?{mode}:{})}),
    async startProfileLink(){const result=await call('binding.link.start',{});if(typeof result.token!=='string'||!/^am_link_[A-Za-z0-9_-]{43}$/.test(result.token))throw new AchievementError('invalid_link','Profile linking is unavailable',503);return {...result,consentUrl:'https://attractmode.io/achievements/collection#link='+encodeURIComponent(result.token)};},
    clearQueue(){assertSession();write([]);notify({status:'cleared'});},
    // Scope must come from the authenticated session. It is a local boundary, never authority.
    setScope(next) {
      if(next===current)return;
      generation++; for(const controller of inFlight)controller.abort(); inFlight.clear();running=null;
      if(current){try{store.removeItem(key());}catch{/* partition still prevents reuse */}}
      current=next||null;notify({status:'account_changed'});
    },
    dispose(){this.setScope(null);disposed=true;listeners.clear();}
  };
}
