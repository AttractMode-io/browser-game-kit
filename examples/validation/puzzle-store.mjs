import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdirSync,chmodSync,lstatSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
/** Persistent single-host validation store. Not suitable for distributed/serverless writers. */
export function createPuzzleStore({filename}) {
 const file=resolve(filename);mkdirSync(dirname(file),{recursive:true,mode:0o700});
 try {if(lstatSync(file).isSymbolicLink())throw Error('Database symlinks are not allowed');}catch(e){if(e.code!=='ENOENT')throw e;}
 const db=new DatabaseSync(file);chmodSync(file,0o600);
 // Configure lock waiting before any operation that can acquire a database lock.
 db.exec('PRAGMA busy_timeout=5000');
 try{db.exec('PRAGMA journal_mode=DELETE; CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,player TEXT NOT NULL,digest TEXT NOT NULL,expires INTEGER NOT NULL,event TEXT); CREATE TABLE IF NOT EXISTS sequences(player TEXT PRIMARY KEY,value INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,event TEXT NOT NULL,acknowledged INTEGER NOT NULL DEFAULT 0)');}catch(error){db.close();throw error;}
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
 return {
  async insert(c){transaction(()=>{db.prepare('DELETE FROM challenges WHERE expires < ? AND event IS NULL').run(Date.now()-86400000);if(db.prepare('SELECT COUNT(*) AS n FROM challenges').get().n>=10000)throw Error('Challenge capacity reached');db.prepare('INSERT INTO challenges(id,player,digest,expires) VALUES(?,?,?,?)').run(c.id,c.playerId,c.digest,c.expiresAt);});},
  async consumeSolved(id,playerId,digest,now){return transaction(()=>{
   const c=db.prepare('SELECT * FROM challenges WHERE id=?').get(id);
   if(!c||c.player!==playerId)throw Error('Unknown challenge');
   if(c.digest!==digest)throw Error('Incorrect answer');
   if(c.event)return JSON.parse(c.event); // A timed-out accepted result survives expiry.
   if(c.expires<=now)throw Error('Challenge expired');
   if(db.prepare('SELECT COUNT(*) AS n FROM outbox WHERE acknowledged=0').get().n>=10000)throw Error('Outbox capacity reached');
   db.prepare('INSERT INTO sequences(player,value) VALUES(?,1) ON CONFLICT(player) DO UPDATE SET value=value+1').run(playerId);
   const sequence=db.prepare('SELECT value FROM sequences WHERE player=?').get(playerId).value;
   const event={playerId,eventId:randomUUID(),type:'puzzle.solved',businessKey:id,sequence,value:1};const text=JSON.stringify(event);
   db.prepare('UPDATE challenges SET event=? WHERE id=?').run(text,id);db.prepare('INSERT INTO outbox(id,event) VALUES(?,?)').run(event.eventId,text);return event;
  });},
  async pending(limit=50){if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid batch');return db.prepare('SELECT event FROM outbox WHERE acknowledged=0 ORDER BY rowid LIMIT ?').all(limit).map(r=>JSON.parse(r.event));},
  async acknowledge(eventId){db.prepare('UPDATE outbox SET acknowledged=1 WHERE id=?').run(eventId);},
  close(){db.close();}
 };
}
/** Retry worker: delivery failure leaves the durable event pending, exact payload retained. */
export async function deliverPuzzleOutbox({store,sendEvent}) {
 let delivered=0;for(const event of await store.pending()){await sendEvent(event);await store.acknowledge(event.eventId);delivered++;}return delivered;
}
