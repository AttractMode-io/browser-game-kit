/** Server-owned take-away game: each player takes 1–3 stones; last stone wins.
 * Fixture only: deploy with durable row locking and a transactionally written outbox.
 */
import {randomUUID} from 'node:crypto';
export function createTakeAwayMatch(players,stones=12) {
 if(players.length!==2||players[0]===players[1]||!Number.isInteger(stones)||stones<1)throw Error('Invalid match');
 const id=randomUUID();let revision=0,turn=0,remaining=stones,result=null;const requests=new Map();
 return {id,snapshot:()=>({revision,remaining,activePlayer:players[turn],finished:!!result}),
  act(playerId,{requestId,expectedRevision,take}) {
   const content=JSON.stringify({playerId,expectedRevision,take});
   if(requests.has(requestId)){const old=requests.get(requestId);if(old.content!==content)throw Error('Changed retry');return structuredClone(old.response);}
   if(typeof requestId!=='string'||!requestId||result||playerId!==players[turn]||expectedRevision!==revision||!Number.isInteger(take)||take<1||take>3||take>remaining)throw Error('Illegal or stale action');
   remaining-=take;revision++;
   if(!remaining)result={playerId,eventId:randomUUID(),type:'match.won',businessKey:id,value:1};else turn=1-turn;
   const response={revision,remaining,event:result};requests.set(requestId,{content,response});return structuredClone(response);
  }
 };
}
