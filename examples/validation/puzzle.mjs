import {randomUUID,timingSafeEqual,createHash} from 'node:crypto';
/** Server-held challenge recipe. Supply a durable, atomic store in production.
 * A store.consumeSolved(id, playerId, digest) must atomically verify ownership,
 * expiry and digest, and return the SAME persisted event for every retry.
 * Store event delivery in an outbox in that transaction; do not delete on send.
 */
export function createPuzzleValidator({store,sendEvent,clock=Date.now}) {
  return {
    async issue(playerId,{question,answer}) {
      const challenge={id:randomUUID(),playerId,question,digest:createHash('sha256').update(answer).digest('hex'),expiresAt:clock()+300000};
      await store.insert(challenge);
      return {id:challenge.id,question,expiresAt:challenge.expiresAt};
    },
    async solve(playerId,{challengeId,answer}) {
      if(typeof answer!=='string'||answer.length>1000)throw Error('Invalid answer');
      const event=await store.consumeSolved(challengeId,playerId,createHash('sha256').update(answer).digest('hex'),clock());
      // Persisted eventId/businessKey survive network timeouts and process restarts.
      return sendEvent(event);
    }
  };
}
/** Isolated test fixture only. Do not use this memory store for deployed games. */
export function createMemoryPuzzleStore() {
 const records=new Map();return {
   async insert(c){records.set(c.id,c);},
   async consumeSolved(id,playerId,digest,now){
     const c=records.get(id);if(!c||c.playerId!==playerId)throw Error('Unknown challenge');
     if(c.expiresAt<=now)throw Error('Challenge expired');
     if(!timingSafeEqual(Buffer.from(c.digest,'hex'),Buffer.from(digest,'hex')))throw Error('Incorrect answer');
     c.event??={playerId,eventId:randomUUID(),type:'puzzle.solved',businessKey:c.id,value:1};return {...c.event};
   }
 };
}
