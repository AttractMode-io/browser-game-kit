import {createProgressionClient} from '/integrations/progression.mjs';
import {connectProgressionPanel} from '/integrations/progression-panel.mjs';
// The example uses the game's existing login at /. Scope is a cache label only.
const status=document.querySelector('#sync-status');let panel,client,saved,epoch=0;
async function connect(){
 const current=++epoch;
 panel?.dispose();panel=null;client=null;saved=null;
 try{
  const response=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});const me=await response.json();if(current!==epoch)return;
  if(!response.ok||!me.signedIn){status.textContent='Sign in from the game homepage, then return here and refresh.';return;}
  client=createProgressionClient({endpoint:'/api/game-progression',scope:'connected-example-session',storage:sessionStorage});
  panel=connectProgressionPanel({element:document.querySelector('#progression'),client,gameName:'Checkpoint example'});
  await panel.refresh();if(current!==epoch)return;const next=await client.readSave('checkpoint');if(current!==epoch)return;saved=next;status.textContent=`Cloud revision ${saved.revision}. No changes made.`;
 }catch{if(current!==epoch)return;status.textContent='Progress sync is unavailable. Check the staged backend configuration. No local progress was uploaded.';}
}
document.querySelector('#refresh').addEventListener('click',()=>void connect());
document.querySelector('#checkpoint').addEventListener('click',async()=>{if(!panel||!saved)return;const current=epoch;try{const result=await panel.writeSave('checkpoint',{checkpoint:Number(saved.value?.checkpoint||0)+1},saved.revision);if(current!==epoch)return;if(result){saved=result;status.textContent=`Saved cloud revision ${saved.revision}.`;}else status.textContent='No save was changed.';}catch{status.textContent='Save failed. Your choice was not confirmed; refresh before trying again.';}});
document.querySelector('#restore').addEventListener('click',async()=>{if(!panel||!saved)return;const current=epoch;const prior=saved.history?.find(s=>s.revision<saved.revision);if(!prior){status.textContent='No previous revision is available yet.';return;}try{const result=await panel.recoverSave('checkpoint',prior.revision);if(current!==epoch)return;if(result){saved=result;status.textContent=`Cloud revision ${saved.revision}.`;}else status.textContent='Recovery cancelled.';}catch{status.textContent='Recovery failed. Refresh to compare current versions.';}});
window.addEventListener('pagehide',()=>panel?.dispose());
void connect();
