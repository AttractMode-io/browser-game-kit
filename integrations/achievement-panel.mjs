/** Optional silent DOM panel. Uses textContent only; never plays media or speech. */
export function mountAchievementPanel({element,client,setId,title='Achievements',notifications=true}) {
  if(!element?.ownerDocument)throw Error('A DOM container is required');
  const doc=element.ownerDocument;let disposed=false,generation=0;const announced=new Set();
  const node=(tag,text)=>{const item=doc.createElement(tag);if(text!==undefined)item.textContent=text;return item;};
  const heading=node('h2',title),summary=node('p','Sign in to view accepted progress.'),list=node('ul'),status=node('p');
  element.classList.add('am-achievement-panel');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  element.replaceChildren(heading,summary,list,status);
  function render(progress) {
    if(disposed)return;
    const projections=Array.isArray(progress.projections)?progress.projections:null;
    const state=progress.state||progress, provenance=progress.provenance==='publisher_validated'?'Publisher-validated':'Personal report';
    summary.textContent=projections?.length ? projections.map(p=>`${p.earningScope}: ${Number.isFinite(p.xp)?p.xp:0} game XP · ${p.provenance==='publisher_validated'?'Publisher-validated':'Personal report'}`).join('; ')+'. Game XP is not a cross-game ranking.' : `${Number.isFinite(state.xp)?state.xp:0} game XP · ${provenance}. Game XP is not a cross-game ranking.`;
    list.replaceChildren();
    // Server projection is authoritative; defense in depth never renders secret locked metadata.
    const achievements=projections ? projections.flatMap(p=>(p.achievements||[]).map(a=>({...a,scopeLabel:p.earningScope}))) : Array.isArray(progress.achievements)?progress.achievements:Object.entries(state.earned||{}).map(([id,award])=>({id,...award,earned:award.revoked!==true}));
    for(const achievement of achievements){
      const item=node('li'),earned=achievement.earned===true||!!achievement.earnedAt||!!achievement.awardedAt;
      const hidden=achievement.secret&&!earned;
      item.append(node('strong',hidden?'Secret achievement':achievement.title||achievement.id),node('p',hidden?'Keep playing to discover this achievement.':achievement.description||''));
      if(achievement.scopeLabel)item.append(node('span',achievement.scopeLabel));
      item.append(node('span',earned?'Earned':Number.isFinite(achievement.progress)&&Number.isFinite(achievement.target)?`${achievement.progress} of ${achievement.target}`:'Locked'));
      list.append(item);
    }
    if(!achievements.length)list.append(node('li','No accepted achievements yet.'));
  }
  async function refresh(){const version=++generation;try{const progress=await client.getProgress({setId});if(!disposed&&version===generation)render(progress);return progress;}catch(error){if(!disposed&&version===generation){status.textContent=error.status===401?'Sign in to view your achievements.':'Progress is unavailable. You can keep playing.';}return null;}}
  const unsubscribe=client.subscribe?.(event=>{
    if(disposed||event.setId&&event.setId!==setId)return;
    if(event.status==='account_changed'||event.status==='cleared'){generation++;announced.clear();list.replaceChildren();summary.textContent='Sign in to view accepted progress.';status.textContent='';return;}
    if(event.status==='pending'){status.textContent='Progress pending sync. Awards are not confirmed yet.';return;}
    if(event.status==='rejected'){status.textContent='This event was not accepted. You can keep playing.';return;}
    if(event.status==='accepted'){
      status.textContent='Progress synced.';
      if(notifications&&!event.receipt.duplicate){
        const awards=(event.receipt.awards||[]).filter(a=>!announced.has(a.achievementId||a.id));
        for(const award of awards)announced.add(award.achievementId||award.id);
        if(awards.length)status.textContent=`Achievement earned: ${awards.map(a=>a.title||'New achievement').join(', ')}.`;
      }
      refresh();
    }
  });
  return {refresh,render,destroy(){disposed=true;generation++;unsubscribe?.();element.replaceChildren();}};
}
