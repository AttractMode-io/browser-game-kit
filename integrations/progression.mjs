/** Staged progression client. Your own backend authenticates every request. */
export class ProgressionError extends Error {
  constructor(status, body) { super(body?.error?.message || body?.error || 'Progress could not sync'); this.status=status; this.details=body; }
}
export function createProgressionClient({endpoint='/api/game-progression',fetch:request=globalThis.fetch,storage,scope}={}) {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//') || endpoint.includes('#') || endpoint.includes('\\')) throw Error('Use a same-origin endpoint');
  let current=scope||null, generation=0;
  const pending=new Set(), keys=new Set();
  const prefix=()=>`am-progress:${encodeURIComponent(current)}:`;
  const key=slot=>`am-progress:${encodeURIComponent(current)}:${encodeURIComponent(slot)}`;
  async function call(action,data={}) {
    if (!current) throw new ProgressionError(401,{error:'Sign in to sync progress'});
    const started=generation,controller=new AbortController();pending.add(controller);
    try {
      const response=await request(endpoint,{method:'POST',redirect:'error',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data}),signal:controller.signal});
      const body=await response.json();
      if(started!==generation) throw new ProgressionError(409,{error:'Account changed'});
      if(!response.ok) throw new ProgressionError(response.status,body);
      return body;
    } finally {pending.delete(controller);}
  }
  return {
    // scope is only a cache boundary (game/environment/player), never an identity proof.
    setScope(next) { generation++;if(storage&&typeof storage.length==='number'){for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(prefix()))keys.add(k);}}for(const c of pending)c.abort();pending.clear();for(const k of keys)storage?.removeItem(k);keys.clear();current=next||null; },
    definitions:(options={})=>call('definitions.get',options),
    progress:(options={})=>call('progress.get',options),
    history:(options={})=>call('progress.history',options),
    reportPersonalEvent:event=>call('event.report',event),
    leaderboard:options=>call('leaderboard.get',options),
    setVisibility:options=>call('visibility.set',options),
    readSave:slot=>call('save.get',{slot}),
    async writeSave(slot,value,expectedRevision) {
      const result=await call('save.write',{slot,value,expectedRevision});
      storage?.removeItem(key(slot));keys.delete(key(slot));return result;
    },
    recoverSave:(slot,revision,expectedRevision)=>call('save.recover',{slot,restoreRevision:revision,expectedRevision}),
    cacheDraft(slot,value,expectedRevision) {
      if(!current)throw Error('No signed-in cache scope');
      const k=key(slot); storage?.setItem(k,JSON.stringify({value,expectedRevision,cachedAt:Date.now()}));keys.add(k);
    },
    readDraft(slot) { if(!current)return null;const k=key(slot);keys.add(k);const raw=storage?.getItem(k);if(!raw)return null;try{return JSON.parse(raw);}catch{storage?.removeItem(k);return null;} },
    // Deliberately no automatic retry/replay or implicit guest-data merge.
  };
}
/** Converts API data to display models without inventing levels or verified provenance. */
export function progressionDisplayModels({progress={},definitions={},board,gameName='This game'}={}) {
  const unlocked=progress.achievements||{},seen=new Set(),achievements=[];
  for(const rule of definitions.rules||[]) {
    if(!rule.achievementId)continue;
    const targets=[{id:rule.achievementId,target:rule.target??1},...(rule.tiers||[]).map(target=>({id:`${rule.achievementId}:${target}`,target}))];
    for(const {id,target} of targets){if(seen.has(id))continue;seen.add(id);const earned=unlocked[id];achievements.push({id,name:earned?.title||rule.title||id,description:(earned?.description||rule.description||'')+(rule.aggregation==='min'?` Target: ${target} or less.`:''),hidden:!!rule.hidden,unlocked:!!earned,progress:rule.aggregation==='min'?undefined:Number(progress.stats?.[rule.stat]||0),target,unlockedAt:earned?.unlockedAt});}
  }
  for(const [id,earned] of Object.entries(unlocked)){if(!seen.has(id))achievements.push({id,name:earned.title||id,description:earned.description||'',unlocked:true,unlockedAt:earned.unlockedAt});}
  return {level:{gameName,xp:Number(progress.xp||0),...(Number.isInteger(progress.level)?{level:progress.level}:{}),...(Number.isFinite(progress.nextLevelXP)?{nextLevelXP:progress.nextLevelXP}:{})},achievements,public:progress.public===true,
    ...(board?{leaderboard:{period:board.period,provenance:board.mode==='server_validated'?'server-validated':'client-reported',entries:(board.entries||[]).map((row,index)=>({displayName:row.displayName||`Player ${index+1}`,score:row.score,visibility:'public'}))}}:{})};
}
