import {simulate,projectProgress} from '../contracts/achievement-rules.mjs';
import {mountAchievementPanel} from '../integrations/achievement-panel.mjs';
const manifest=await (await fetch('/examples/achievements/manifest.json')).json();
let events=[],last=null;
const panel=mountAchievementPanel({element:document.querySelector('#achievements'),client:{getProgress:async()=>projectProgress(manifest,simulate(manifest,events).state)},setId:manifest.setId,title:'Simulated achievements',notifications:false});
function render(){const result=simulate(manifest,events);panel.render(projectProgress(manifest,result.state));document.querySelector('#trace').textContent=JSON.stringify({simulation:true,receipts:result.receipts,trace:result.trace},null,2);}
function add(level,won){const id=crypto.randomUUID();last={eventId:id,occurrenceId:id,buildId:'web-1',type:'level.completed',payload:{level,won}};events.push(last);document.querySelector('#retry').disabled=false;render();}
document.querySelector('#loss').addEventListener('click',()=>add('harbor',false));
document.querySelector('#win').addEventListener('click',()=>add('harbor',true));
document.querySelector('#other').addEventListener('click',()=>add('forest',true));
document.querySelector('#retry').addEventListener('click',()=>{if(last){events.push({...last});render();}});
document.querySelector('#reset').addEventListener('click',()=>{events=[];last=null;document.querySelector('#retry').disabled=true;render();});render();
