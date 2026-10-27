/** Portable, deterministic achievement rules. No credentials, clocks, IO or executable predicates. */
const ID = /^[a-z][a-z0-9_.-]{0,79}$/;
const BAD = new Set(['__proto__', 'prototype', 'constructor']);
const own = (o, k) => Object.hasOwn(o, k);
const object = o => !!o && typeof o === 'object' && !Array.isArray(o) && [Object.prototype, null].includes(Object.getPrototypeOf(o));
const integer = (x, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(x) && x >= min && x <= max;
const copy = o => JSON.parse(JSON.stringify(o));
const fail = (code, message) => { throw Object.assign(new Error(message), {code, status: 400}); };
const safeId = s => typeof s === 'string' && ID.test(s) && !BAD.has(s);
const text = (s, max, empty = false) => typeof s === 'string' && (empty || s.trim().length > 0) && s.length <= max && !Array.from(s).some(c => c.charCodeAt(0)<32 && ![9,10,13].includes(c.charCodeAt(0)));
const only = (o, fields) => object(o) && Object.keys(o).every(k => !BAD.has(k) && fields.includes(k));

export function canonicalManifest(value) {
  const visit = (v, depth = 0) => {
    if (depth > 24) fail('INVALID_MANIFEST', 'Manifest nesting exceeds limit.');
    if (Array.isArray(v)) return v.map(x => visit(x, depth + 1));
    if (object(v)) return Object.fromEntries(Object.keys(v).sort().map(k => {
      if (BAD.has(k)) fail('INVALID_MANIFEST', 'Reserved object key.');
      return [k, visit(v[k], depth + 1)];
    }));
    if (v === null || ['string','boolean'].includes(typeof v) || typeof v === 'number' && Number.isFinite(v)) return v;
    fail('INVALID_MANIFEST', 'Manifest must contain JSON values.');
  };
  return JSON.stringify(visit(value));
}

export function validateManifest(input) {
  const errors = [], warnings = [];
  const err = (path, message) => errors.push({path, message});
  let manifest;
  try { const raw = canonicalManifest(input); if (raw.length > 100000) throw Error('Manifest exceeds 100 KB.'); manifest = JSON.parse(raw); }
  catch (e) { return {valid:false, errors:[{path:'manifest',message:e.message}], warnings}; }
  const m = manifest;
  if (!only(m,['schemaVersion','setId','title','description','earningScope','events','stats','achievements','levels','xpRules'])) return {valid:false,errors:[{path:'manifest',message:'Unknown manifest fields or invalid object.'}],warnings};
  if (m.schemaVersion !== 1) err('schemaVersion','Only schema version 1 is supported.');
  for (const key of ['setId','earningScope']) if (!safeId(m[key])) err(key,'Use a stable lowercase identifier (up to 80 characters).');
  if (!text(m.title,100)) err('title','A title of 1–100 characters is required.');
  if (!text(m.description,2000,true)) err('description','Description must be at most 2000 characters.');
  if (!object(m.events) || Object.keys(m.events).length < 1 || Object.keys(m.events).length > 50) err('events','Define 1–50 event schemas.');
  const events = object(m.events) ? m.events : {};
  for (const [name,event] of Object.entries(events)) {
    if (!safeId(name) || !only(event,['fields']) || !object(event.fields) || Object.keys(event.fields).length > 20) {err('events.'+name,'Invalid event schema.');continue;}
    for (const [name2,f] of Object.entries(event.fields)) {
      const path = `events.${name}.${name2}`;
      if (!safeId(name2) || !only(f,['type','optional','maxLength','min','max','enum']) || !['string','number','boolean'].includes(f.type)) {err(path,'Invalid field schema.');continue;}
      if (own(f,'optional') && typeof f.optional !== 'boolean') err(path,'optional must be boolean.');
      if (f.type === 'string') {
        if (!integer(f.maxLength,1,500)) err(path,'String fields require maxLength 1–500.');
        if (own(f,'min') || own(f,'max')) err(path,'Numeric bounds require a number field.');
      } else if (own(f,'maxLength')) err(path,'maxLength requires a string field.');
      if (f.type === 'number') {
        if (!integer(f.min ?? 0,-1000000000,1000000000) || !integer(f.max ?? 1000000000,-1000000000,1000000000) || (f.min ?? 0) > (f.max ?? 1000000000)) err(path,'Number fields use bounded safe integers.');
      } else if (own(f,'min') || own(f,'max')) err(path,'Numeric bounds require a number field.');
      if (own(f,'enum') && (!Array.isArray(f.enum) || !f.enum.length || f.enum.length > 100 || f.enum.some(v => typeof v !== f.type || f.type === 'string' && (!text(v,f.maxLength) || BAD.has(v)) || f.type === 'number' && !integer(v,f.min ?? 0,f.max ?? 1000000000)))) err(path,'Invalid enum values.');
    }
  }
  const filters = (where,event,path) => {
    if (where === undefined) return;
    if (!Array.isArray(where) || where.length > 10) return err(path,'At most 10 predicates are supported.');
    for (const f of where) {
      if (!only(f,['field','op','value']) || !own(events[event]?.fields ?? {}, f.field) || !['eq','ne','gt','gte','lt','lte'].includes(f.op)) {err(path,'Invalid event predicate.');continue;}
      const schema=events[event].fields[f.field];
      if (!object(schema)) {err(path,'Predicate requires a valid field schema.');continue;}
      if (typeof f.value !== schema.type || !['eq','ne'].includes(f.op) && schema.type !== 'number') err(path,'Predicate type must match the field.');
    }
  };
  if (!Array.isArray(m.stats) || m.stats.length > 100) err('stats','Define at most 100 statistics.');
  const stats = new Map();
  for (const [i,s] of (Array.isArray(m.stats)?m.stats:[]).entries()) {
    const p='stats.'+i;
    if (!only(s,['id','event','op','field','where','limit']) || !safeId(s.id) || stats.has(s.id) || !own(events,s.event) || !['count','sum','min','max','distinct'].includes(s.op)) {err(p,'Invalid or duplicate statistic.');continue;}
    stats.set(s.id,s);
    if (s.op !== 'count' && !own(events[s.event]?.fields ?? {},s.field)) err(p,'Statistic field must be declared in the event.');
    if (['sum','min','max'].includes(s.op) && events[s.event]?.fields?.[s.field]?.type !== 'number') err(p,'Numeric aggregation requires a number field.');
    if (s.op === 'distinct' && (!integer(s.limit ?? 100,1,1000) || events[s.event]?.fields?.[s.field]?.type !== 'string')) err(p,'Distinct collections require strings and a limit of 1–1000.');
    if (s.op !== 'distinct' && own(s,'limit')) err(p,'Collection limit only applies to distinct statistics.');
    if (s.op === 'count' && own(s,'field')) err(p,'Count has no value field.');
    filters(s.where,s.event,p+'.where');
  }
  let nodes=0;
  const condition=(c,path,depth=0)=>{
    if (++nodes > 1000 || depth > 4 || !object(c)) return err(path,'Condition exceeds complexity limits.');
    if (own(c,'all') || own(c,'any')) {
      const key=own(c,'all')?'all':'any';
      if (!only(c,[key]) || !Array.isArray(c[key]) || c[key].length < 1 || c[key].length > 10) return err(path,'all/any needs 1–10 conditions.');
      c[key].forEach((v,i)=>condition(v,`${path}.${key}.${i}`,depth+1));
    } else if (!only(c,['stat','op','value']) || !stats.has(c.stat) || !['eq','gt','gte','lt','lte'].includes(c.op) || !integer(c.value,-1000000000,1000000000)) err(path,'Invalid statistic condition.');
    else {
      const stat=stats.get(c.stat),field=events[stat.event]?.fields?.[stat.field];
      const min=['count','distinct'].includes(stat.op)?1:['min','max'].includes(stat.op)?field?.min??0:-Number.MAX_SAFE_INTEGER;
      const max=stat.op==='distinct'?stat.limit??100:['min','max'].includes(stat.op)?field?.max??1000000000:Number.MAX_SAFE_INTEGER;
      if(c.op==='eq'&&(c.value<min||c.value>max)||c.op==='gt'&&c.value>=max||c.op==='gte'&&c.value>max||c.op==='lt'&&c.value<=min||c.op==='lte'&&c.value<min)err(path,'Condition cannot be reached within the statistic bounds.');
    }
  };
  if (!Array.isArray(m.achievements) || !m.achievements.length || m.achievements.length > 100) err('achievements','Define 1–100 achievements; empty completion is not supported.');
  const ids=new Set();
  for (const [i,a] of (Array.isArray(m.achievements)?m.achievements:[]).entries()) {
    const p='achievements.'+i;
    if (!only(a,['id','title','description','secret','points','xp','condition','icon','iconAlt']) || !safeId(a.id) || ids.has(a.id)) {err(p,'Invalid or duplicate achievement ID.');continue;}
    ids.add(a.id);
    if (!text(a.title,100) || !text(a.description,500)) err(p,'Title and meaningful description are required.');
    if (own(a,'secret') && typeof a.secret !== 'boolean') err(p,'secret must be boolean.');
    if (!integer(a.points,0,1000) || !integer(a.xp,0,10000)) err(p,'Points must be 0–1000; one-time game XP must be 0–10000.');
    if (a.icon !== undefined) {
      try {const u=new URL(a.icon);if(u.protocol!=='https:'||u.username||u.password||!text(a.iconAlt,200)) throw Error();} catch {err(p,'Icons require an HTTPS URL and descriptive alt text.');}
    } else if (own(a,'iconAlt')) err(p,'Icon alt text requires an icon.');
    condition(a.condition,p+'.condition');
  }
  if (!Array.isArray(m.levels) || m.levels.length<1 || m.levels.length>100) err('levels','Define 1–100 levels beginning at zero XP.');
  let previous=-1;
  for (const [i,l] of (Array.isArray(m.levels)?m.levels:[]).entries()) {
    if (!object(l)) {err('levels.'+i,'Invalid level object.');continue;}
    if (!only(l,['level','xp']) || l.level !== i+1 || !integer(l.xp,0,1000000000) || l.xp <= previous || i===0 && l.xp!==0) err('levels.'+i,'Levels must be sequential, with increasing XP and first threshold zero.');
    previous=l.xp;
  }
  const xpIds=new Set();
  if (m.xpRules!==undefined && (!Array.isArray(m.xpRules)||m.xpRules.length>50)) err('xpRules','Define at most 50 repeatable XP rules.');
  for(const [i,r] of (Array.isArray(m.xpRules)?m.xpRules:[]).entries()) {
    if (!object(r)) {err('xpRules.'+i,'Invalid XP rule object.');continue;}
    if (!only(r,['id','event','xp','limit','where']) || !safeId(r.id) || xpIds.has(r.id) || !own(events,r.event) || !integer(r.xp,1,10000) || !integer(r.limit,1,100000)) err('xpRules.'+i,'Repeatable XP needs unique ID, event and finite grant count.');
    xpIds.add(r.id);filters(r.where,r.event,'xpRules.'+i+'.where');
  }
  if ((m.achievements??[]).length>50) warnings.push({path:'achievements',message:'Consider a smaller base set and separate optional challenges.'});
  return {valid:errors.length===0,errors,warnings,...(errors.length?{}:{manifest:m})};
}

const compare=(a,op,b)=>({eq:()=>a===b,ne:()=>a!==b,gt:()=>a>b,gte:()=>a>=b,lt:()=>a<b,lte:()=>a<=b})[op]();
const matches=(where,payload)=>(where??[]).every(p=>own(payload,p.field)&&compare(payload[p.field],p.op,p.value));
const amount=v=>Array.isArray(v)?v.length:v??0;
export function initialProgress() {return {stats:{},earned:{},xp:0,xpCounts:{},completion:false};}
export function validateEvent(manifest,event) {
  if (!object(event) || !only(event,['type','eventId','occurrenceId','buildId','payload','occurredAt']) || !safeId(event.type) || !own(manifest.events,event.type) || !object(event.payload)) fail('INVALID_EVENT','Event type or payload is invalid.');
  for(const k of ['eventId','occurrenceId','buildId']) if(typeof event[k]!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(event[k])) fail('INVALID_EVENT',`${k} must be a durable identifier.`);
  if(event.occurredAt!==undefined && (typeof event.occurredAt!=='string'||!Number.isFinite(Date.parse(event.occurredAt))||new Date(event.occurredAt).toISOString()!==event.occurredAt))fail('INVALID_EVENT','occurredAt must be an ISO UTC timestamp.');
  const fields=manifest.events[event.type].fields;
  if(Object.keys(event.payload).some(k=>!own(fields,k))) fail('INVALID_EVENT','Unknown payload field.');
  for(const [name,s] of Object.entries(fields)) {
    if(!own(event.payload,name)){if(s.optional)continue;fail('INVALID_EVENT','Required field missing: '+name);}
    const v=event.payload[name];
    if(typeof v!==s.type || s.type==='string'&&!text(v,s.maxLength,true) || s.type==='number'&&!integer(v,s.min??0,s.max??1000000000) || s.enum&&!s.enum.includes(v)) fail('INVALID_EVENT','Invalid field: '+name);
  }
  return event;
}
export function evaluateEvent(input, previous, event) {
  const checked=validateManifest(input);if(!checked.valid) fail('INVALID_MANIFEST',checked.errors.map(e=>e.path+': '+e.message).join('; '));
  const m=checked.manifest;validateEvent(m,event);
  const state=copy(previous??initialProgress()),trace=[],awards=[];
  if(!object(state.stats)||!object(state.earned)||!object(state.xpCounts)||!integer(state.xp))fail('INVALID_STATE','Invalid progression state.');
  let xpDelta=0;
  const addXp=n=>{if(!integer(state.xp+n))fail('STATE_LIMIT','XP exceeds supported range.');state.xp+=n;xpDelta+=n;};
  for(const stat of m.stats) {
    if(stat.event!==event.type)continue;
    if(!matches(stat.where,event.payload)){trace.push({kind:'stat',id:stat.id,reason:'predicate_not_met'});continue;}
    const old=state.stats[stat.id],value=event.payload[stat.field];
    if(stat.op!=='count'&&value===undefined){trace.push({kind:'stat',id:stat.id,reason:'optional_field_absent'});continue;}
    let next;
    if(stat.op==='count')next=(old??0)+1;
    if(stat.op==='sum')next=(old??0)+value;
    if(stat.op==='max')next=old===undefined?value:Math.max(old,value);
    if(stat.op==='min')next=old===undefined?value:Math.min(old,value);
    if(stat.op==='distinct'){next=Array.isArray(old)?[...old]:[];if(!next.includes(value)&&next.length<(stat.limit??100))next.push(value);next.sort((a,b)=>a<b?-1:a>b?1:0);}
    if(!Array.isArray(next)&&!integer(next,-Number.MAX_SAFE_INTEGER))fail('STATE_LIMIT','Statistic exceeds supported range.');
    state.stats[stat.id]=next;trace.push({kind:'stat',id:stat.id,reason:'updated',before:amount(old),after:amount(next)});
  }
  const test=c=>c.all?c.all.every(test):c.any?c.any.some(test):own(state.stats,c.stat)&&compare(amount(state.stats[c.stat]),c.op,c.value);
  for(const a of m.achievements) {
    if(own(state.earned,a.id)){trace.push({kind:'achievement',id:a.id,reason:'already_earned'});continue;}
    if(!test(a.condition)){trace.push({kind:'achievement',id:a.id,reason:'condition_not_met'});continue;}
    const award={achievementId:a.id,earningScope:m.earningScope,title:a.title,description:a.description,points:a.points,xp:a.xp};
    state.earned[a.id]=award;awards.push(award);addXp(a.xp);trace.push({kind:'achievement',id:a.id,reason:'earned',points:a.points,xp:a.xp});
  }
  for(const r of m.xpRules??[]) {
    if(r.event!==event.type||!matches(r.where,event.payload))continue;
    const count=state.xpCounts[r.id]??0;
    if(count>=r.limit){trace.push({kind:'xp',id:r.id,reason:'cap_reached'});continue;}
    state.xpCounts[r.id]=count+1;addXp(r.xp);trace.push({kind:'xp',id:r.id,reason:'granted',xp:r.xp});
  }
  const completion=m.achievements.every(a=>own(state.earned,a.id)&&state.earned[a.id]?.revoked!==true);state.completion=completion;
  state.level=m.levels.reduce((l,v)=>state.xp>=v.xp?v.level:l,1);
  return {state,awards,xpDelta,trace,completion};
}

export function simulate(manifest,events,initialState) {
  const checked=validateManifest(manifest);if(!checked.valid)return {...checked,state:initialState??initialProgress(),receipts:[],trace:[]};
  if(!Array.isArray(events)||events.length>1000)fail('SIMULATION_LIMIT','Supply at most 1000 fixture events.');
  let state=copy(initialState??initialProgress());const receipts=[],trace=[],seen=new Map(),occurrences=new Map();
  for(const event of events) {
    try {
      validateEvent(checked.manifest,event);
      const payload=canonicalManifest({buildId:event.buildId,type:event.type,payload:event.payload,occurrenceId:event.occurrenceId});
      const occurrence=event.occurrenceId,prior=seen.get(event.eventId)||occurrences.get(occurrence);
      if(prior){if(prior.payload!==payload)fail('CONFLICT','Event or occurrence reused with a different payload.');receipts.push({...prior.receipt,replayed:true});continue;}
      const result=evaluateEvent(checked.manifest,state,event);state=result.state;
      const receipt={eventId:event.eventId,status:'accepted',awards:result.awards,xpDelta:result.xpDelta,completion:result.completion};
      receipts.push(receipt);trace.push(...result.trace.map(t=>({...t,eventId:event.eventId})));seen.set(event.eventId,{payload,receipt});occurrences.set(occurrence,{payload,receipt});
    } catch(e) {receipts.push({eventId:event?.eventId,status:'rejected',code:e.code??'INVALID_EVENT',error:e.message});}
  }
  return {valid:true,errors:[],warnings:checked.warnings,state,receipts,trace};
}

export function diffManifests(previous,next) {
  const checked=validateManifest(next);if(!checked.valid)return {changed:true,breaking:true,changes:[{path:'manifest',kind:'invalid'}],errors:checked.errors};
  if(!previous)return {changed:true,breaking:false,changes:[{path:'manifest',kind:'created'}]};
  const changes=[];
  for(const key of [...new Set([...Object.keys(previous),...Object.keys(next)])].sort()) {
    if(canonicalManifest(previous[key]??null)!==canonicalManifest(next[key]??null))changes.push({path:key,kind:'changed'});
  }
  const displayOnly=new Set(['title','description']);
  return {changed:changes.length>0,breaking:changes.some(c=>!displayOnly.has(c.path)),changes};
}

/** Audience-safe view: never send locked secret text, artwork or rule criteria. */
export function projectProgress(manifest,state,{publicView=false}={}) {
  const checked=validateManifest(manifest);if(!checked.valid)fail('INVALID_MANIFEST','Cannot project invalid manifest.');
  const m=checked.manifest,s=state??initialProgress();
  return {setId:m.setId,title:m.title,description:m.description,earningScope:m.earningScope,xp:s.xp,level:s.level??1,completion:!!s.completion,
    achievements:m.achievements.map(a=>{
      const earned=own(s.earned??{},a.id)&&s.earned[a.id]?.revoked!==true;
      if(a.secret&&!earned)return {id:a.id,secret:true,earned:false,title:'Secret achievement',description:'Keep playing to discover this achievement.'};
      return {id:a.id,title:a.title,description:a.description,points:a.points,earned,...(a.icon?{icon:a.icon,iconAlt:a.iconAlt}:{}),...(!publicView?{xp:a.xp}:{})};
    })};
}
