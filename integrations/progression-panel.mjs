import { mountProgressionUI } from './progression-ui.mjs';
import { progressionDisplayModels } from './progression.mjs';
/** Real API display adapter. Never accepts credentials or identity assertions. */
export function connectProgressionPanel({element,client,gameName='This game',mode='client_reported',stat='completions',period='alltime',levelFromXP}) {
 const ui=mountProgressionUI({element});let disposed=false,generation=0;
 async function refresh(){
  const request=++generation;
  const [progress,definitions,board]=await Promise.all([client.progress({mode}),client.definitions({mode}),client.leaderboard({stat,period,mode})]);
  if(disposed||request!==generation)return;
  const model=progressionDisplayModels({progress,definitions,board,gameName});
  ui.renderLevel({...model.level,...(levelFromXP?levelFromXP(model.level.xp):{})});ui.renderAchievements(model.achievements);ui.renderLeaderboard(model.leaderboard);
  return progress;
 }
 async function writeSave(slot,value,expectedRevision){
  if(disposed)throw Error('Panel disposed');
  try{return await client.writeSave(slot,value,expectedRevision);}
  catch(error){if(error.status!==409||disposed)throw error;
   const remote=await client.readSave(slot);if(disposed)return;
   let saved;
   const choice=await ui.resolveSaveConflict({slot,localLabel:'Your unsynced changes on this device',remoteLabel:`Cloud save revision ${remote.revision}`,onKeepLocal:async()=>{saved=await client.writeSave(slot,value,remote.revision);},onKeepRemote:async()=>{saved=remote;}});
   return choice==='cancelled'?undefined:saved;
  }
 }
 async function recoverSave(slot,revision){
  if(disposed)throw Error('Panel disposed');const remote=await client.readSave(slot);if(disposed)return;
  let result;
  const choice=await ui.resolveSaveConflict({slot,localLabel:`Selected history revision ${revision}`,remoteLabel:`Current cloud revision ${remote.revision}`,localActionLabel:'Restore selected version',remoteActionLabel:'Keep current cloud version',onKeepLocal:async()=>{result=await client.recoverSave(slot,revision,remote.revision);},onKeepRemote:async()=>{result=remote;}});
  return choice==='cancelled'?undefined:result;
 }
 return {refresh,writeSave,recoverSave,dispose(){disposed=true;generation++;client.setScope(null);ui.destroy();}};
}
