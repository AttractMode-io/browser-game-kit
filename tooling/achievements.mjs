#!/usr/bin/env node
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateManifest,simulate,diffManifests} from '../contracts/achievement-rules.mjs';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const HELP=`Usage: node tooling/achievements.mjs <command> [files/options]
  validate manifest.json
  simulate manifest.json events.json
  diff old.json new.json
  export manifest.json output.json
  draft manifest.json --project PROJECT --revision N
  get --project PROJECT --set SET
  validate-draft --project PROJECT --set SET --revision N
  publish --project PROJECT --set SET --revision N --hash SHA256 --idempotency KEY
  bind --project PROJECT --set SET --build BUILD --release RELEASE --revision N
Remote commands default to previews. To execute add --execute --environment sandbox|production.
Production execution also requires --confirm-production PROJECT. Obtain a short-lived project-scoped
CLI token from authenticated Developer Studio; supply AM_ACHIEVEMENTS_AUTHORING_TOKEN privately.
Runtime am_pg_ keys cannot author. Never copy browser cookies or put tokens in command arguments.`;
function parse(args) {const positional=[],options={};for(let i=0;i<args.length;i++){if(args[i].startsWith('--')){const key=args[i].slice(2);if(Object.hasOwn(options,key))throw Error('Duplicate option');if(['execute','development'].includes(key)){options[key]=true;continue;}if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Each option needs one value');options[key]=args[++i];}else positional.push(args[i]);}return {positional,options};}
function revision(value){const n=Number(value);if(!/^\d+$/.test(value||'')||!Number.isSafeInteger(n))throw Error('Explicit nonnegative revision required');return n;}
function required(options,key){if(typeof options[key]!=='string'||!options[key]||options[key].length>160)throw Error(`Explicit --${key} required`);return options[key];}
function target(options){const origin=new URL(options.origin||'https://attractmode.io');const loopback=origin.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(origin.hostname);if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||(origin.origin!=='https://attractmode.io'&&!(loopback&&options.development)))throw Error('Authoring tokens may only target attractmode.io or explicit loopback development');return new URL('/api/achievements/authoring',origin);}
export async function runAchievementCLI(args,{env=process.env,fetch:request=globalThis.fetch}={}) {
  const [command,...rest]=args;if(!command||command==='help'||command==='--help')return HELP;
  const {positional:files,options}=parse(rest);
  if(['validate','simulate','diff','export'].includes(command)&&Object.keys(options).length)throw Error('Local commands do not accept remote options');
  if(command==='validate'){if(files.length!==1)throw Error(HELP);return validateManifest(await read(files[0]));}
  if(command==='simulate'){if(files.length!==2)throw Error(HELP);return simulate(await read(files[0]),await read(files[1]));}
  if(command==='diff'){if(files.length!==2)throw Error(HELP);return diffManifests(await read(files[0]),await read(files[1]));}
  if(command==='export') {if(files.length!==2)throw Error(HELP);const checked=validateManifest(await read(files[0]));if(!checked.valid)return checked;await writeFile(files[1],JSON.stringify(checked.manifest,null,2)+'\n',{flag:'wx'});return {exported:files[1]};}
  const commands={draft:'draft.save',get:'draft.get','validate-draft':'draft.validate',publish:'release.publish',bind:'build.bind'};
  if(!Object.hasOwn(commands,command))throw Error(HELP);
  const allowed=new Set(['project','environment','execute','confirm-production','origin','development',...(command==='draft'?['revision']:command==='publish'?['set','revision','hash','idempotency']:command==='bind'?['set','revision','build','release']:command==='validate-draft'?['set','revision']:['set'])]);
  if(Object.keys(options).some(key=>!allowed.has(key)))throw Error('Unsupported option');
  const environment=options.environment||'sandbox';if(!['sandbox','production'].includes(environment))throw Error('Invalid environment');
  let data={projectId:required(options,'project')};
  if(command!=='get')data.expectedRevision=revision(options.revision);
  if(command==='draft') {
    if(files.length!==1)throw Error(HELP);const checked=validateManifest(await read(files[0]));if(!checked.valid)return checked;
    data={...data,setId:checked.manifest.setId,manifest:checked.manifest};
  } else {
    if(files.length)throw Error(HELP);data.setId=required(options,'set');
    if(command==='publish') {const expectedHash=required(options,'hash');if(!/^[a-f0-9]{64}$/.test(expectedHash))throw Error('Expected published-candidate SHA256 required');data={...data,expectedHash,idempotencyKey:required(options,'idempotency')};}
    if(command==='bind')data={...data,buildId:required(options,'build'),releaseId:required(options,'release')};
  }
  const body={action:commands[command],data,expectedEnvironment:environment};
  if(!options.execute)return {preview:true,executed:false,environment,note:'Verify the project environment in Developer Studio. Execute requires a short-lived project-scoped authoring token, not a runtime key.',request:body};
  if(!options.environment)throw Error('Execution requires explicit --environment');
  if(environment==='production'&&options['confirm-production']!==data.projectId)throw Error('Production execution requires --confirm-production matching the project ID');
  const endpoint=target(options),token=env.AM_ACHIEVEMENTS_AUTHORING_TOKEN;
  if(typeof token!=='string'||!/^am_ach_[A-Za-z0-9_-]{43}$/.test(token))throw Error('Set AM_ACHIEVEMENTS_AUTHORING_TOKEN to a short-lived Studio-issued authoring token');
  let response;try{response=await request(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});}catch{throw Error('Authoring request unavailable. Reconcile the stored revision/release before retrying an uncertain mutation.');}
  let result;try{result=await response.json();}catch{throw Error('Authoring response could not be verified. Reconcile the stored revision/release before retrying.');}
  if(!response.ok)throw Error(`Authoring request rejected (${response.status}). Check token scope, environment, current revision and Studio diagnostics.`);
  // Public control-plane result only; token issuance is never an allowed CLI action.
  return {executed:true,environment,action:body.action,result};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{const result=await runAchievementCLI(process.argv.slice(2));console.log(typeof result==='string'?result:JSON.stringify(result,null,2));if(result?.valid===false)process.exitCode=1;}
  catch(error){console.error(error.message);process.exitCode=1;}
}
