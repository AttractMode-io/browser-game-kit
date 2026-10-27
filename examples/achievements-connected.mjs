import {createAchievementClient,createAchievementScope} from '/integrations/achievements.mjs';
import {mountAchievementPanel} from '/integrations/achievement-panel.mjs';
import {mountAccountUI} from '/integrations/account-ui.mjs';
const status=document.querySelector('#connection-status'),linkResult=document.querySelector('#link-result');let client,panel,revision=0;
const account=mountAccountUI({element:document.querySelector('#account-menu'),returnTo:'/examples/achievements-connected'});
function buttons(enabled){for(const id of ['win','flush','link'])document.querySelector('#'+id).disabled=!enabled;}
async function connect(){
 const current=++revision;buttons(false);linkResult.replaceChildren();panel?.destroy();panel=null;
 try{
  const response=await fetch('/api/me',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)}),me=await response.json();if(current!==revision)return;
  if(!response.ok||!me.signedIn){client?.setScope(null);client=null;status.textContent='Sign in, then refresh progress. Guest gameplay remains available.';return;}
  if(me.demo){client?.setScope(null);client=null;status.textContent='Offline account simulation. Hosted achievements stay disabled; use the local rules sample.';return;}
  const scope=createAchievementScope(me.account);
  if(client)client.setScope(scope);else client=createAchievementClient({scope,storage:sessionStorage});
  panel=mountAchievementPanel({element:document.querySelector('#achievement-panel'),client,setId:'harbor-base'});await panel.refresh();if(current!==revision)return;
  buttons(true);status.textContent=me.demo?'Offline account fixture. Remote achievements stay disabled.':'Authenticated personal reporting. Events are not publisher-validated.';
 }catch{if(current!==revision)return;status.textContent='Account or progression unavailable. Keep playing; no event was uploaded by this check.';}
}
async function act(fn){if(!client)return;const current=revision;try{await fn(client);if(current!==revision)return;}catch{if(current===revision)status.textContent='The action was not confirmed. Refresh your session and retry pending events before creating another occurrence.';}}
document.querySelector('#refresh').addEventListener('click',()=>{account.refresh();void connect();});
document.querySelector('#win').addEventListener('click',()=>void act(async c=>{const id=crypto.randomUUID();const result=await c.report({setId:'harbor-base',event:{eventId:id,occurrenceId:id,buildId:'web-1',type:'level.completed',payload:{level:'harbor',won:true}}});if(c!==client)return;status.textContent=result.status==='accepted'?'Event accepted. Awards come from the published rules.':result.status==='pending'?'Event queued. Use Retry pending events; no award is confirmed.':'Event rejected. Check the published build and rules.';}));
document.querySelector('#flush').addEventListener('click',()=>void act(c=>c.flush()));
document.querySelector('#link').addEventListener('click',()=>void act(async c=>{const link=await c.startProfileLink();if(c!==client)return;const a=document.createElement('a');a.href=link.consentUrl;a.textContent='Review and accept linking on Attract Mode';a.rel='noreferrer';linkResult.replaceChildren(a);status.textContent='Open this link yourself to review the game and choose whether to link. It expires in ten minutes.';}));
document.querySelector('#account-menu').addEventListener('submit',event=>{if(new URL(event.target.action,location.href).pathname==='/auth/logout'){revision++;client?.setScope(null);client=null;panel?.destroy();buttons(false);linkResult.replaceChildren();}});
window.addEventListener('focus',()=>void connect());
// Keep the bounded sessionStorage queue across reloads. Explicit sign-out clears its scope.
window.addEventListener('pagehide',()=>{revision++;panel?.destroy();linkResult.replaceChildren();});
window.addEventListener('pageshow',event=>{if(event.persisted){account.refresh();void connect();}});
void connect();
