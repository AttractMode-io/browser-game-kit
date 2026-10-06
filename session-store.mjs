// Single-host production store. SQLite transactions serialize one-use consumption across processes.
import {DatabaseSync} from 'node:sqlite';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {openSync,closeSync,lstatSync,chmodSync} from 'node:fs';
import {isAbsolute,dirname} from 'node:path';
export function createSessionStore({filename,key,clock=Date.now,maxRecords=10000}) {
 if(!isAbsolute(filename||'')||!(/^[a-f0-9]{64}$/i).test(key||''))throw Error('Production storage requires an absolute database path and 32-byte hex session key.');
 const directory=lstatSync(dirname(filename));if(!directory.isDirectory()||(directory.mode&0o022)!==0)throw Error('Session database directory must not be writable by other users.');
 if(!Number.isInteger(maxRecords)||maxRecords<1||maxRecords>100000)throw Error('Invalid session capacity.');
 try{const fd=openSync(filename,'wx',0o600);closeSync(fd);}catch(e){if(e.code!=='EEXIST')throw e;}
 if(!lstatSync(filename).isFile()||lstatSync(filename).isSymbolicLink())throw Error('Session database must be a regular private file.');chmodSync(filename,0o600);
 const secret=Buffer.from(key,'hex'),db=new DatabaseSync(filename);
 db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, payload BLOB NOT NULL, expires INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires)');
 db.prepare('DELETE FROM sessions WHERE expires<=?').run(clock());
 const cleanup=setInterval(()=>{try{db.prepare('DELETE FROM sessions WHERE expires<=?').run(clock());}catch{}},60000);cleanup.unref();
 const encode=(id,value,expires)=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(Buffer.from(JSON.stringify([id,expires])));return Buffer.concat([iv,cipher.update(JSON.stringify(value)),cipher.final(),cipher.getAuthTag()]);};
 const decode=(id,payload,expires)=>{const b=Buffer.from(payload),decipher=createDecipheriv('aes-256-gcm',secret,b.subarray(0,12));decipher.setAAD(Buffer.from(JSON.stringify([id,expires])));decipher.setAuthTag(b.subarray(-16));return JSON.parse(Buffer.concat([decipher.update(b.subarray(12,-16)),decipher.final()]).toString());};
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const validate=id=>{if(typeof id!=='string'||!/^(flow|session):[A-Za-z0-9_-]{43}$/.test(id))throw Error('Invalid session record ID.');};
 return {
  async set(id,value,expires){validate(id);if(!Number.isSafeInteger(expires)||expires<=clock()||expires>clock()+3600000)throw Error('Invalid session expiry.');const payload=encode(id,value,expires);if(payload.length>8192)throw Error('Session record too large.');transaction(()=>{db.prepare('DELETE FROM sessions WHERE expires<=?').run(clock());const exists=db.prepare('SELECT 1 FROM sessions WHERE id=?').get(id);if(!exists&&db.prepare('SELECT count(*) AS n FROM sessions').get().n>=maxRecords)throw Error('Session capacity reached.');db.prepare('INSERT INTO sessions(id,payload,expires) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires=excluded.expires').run(id,payload,expires);});},
  async get(id){if(!id||id.endsWith(':'))return null;validate(id);const row=db.prepare('SELECT payload,expires FROM sessions WHERE id=?').get(id);if(!row||row.expires<=clock()){db.prepare('DELETE FROM sessions WHERE id=?').run(id);return null;}return decode(id,row.payload,row.expires);},
  async take(id){if(!id||id.endsWith(':'))return null;validate(id);return transaction(()=>{const row=db.prepare('SELECT payload,expires FROM sessions WHERE id=?').get(id);db.prepare('DELETE FROM sessions WHERE id=?').run(id);return row&&row.expires>clock()?decode(id,row.payload,row.expires):null;});},
  close(){clearInterval(cleanup);db.close();secret.fill(0);}
 };
}
