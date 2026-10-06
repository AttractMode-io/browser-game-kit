import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
await mkdir(new URL('./supabase/',import.meta.url),{recursive:true});
const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
try {await writeFile(new URL('./supabase/signing_keys.json',import.meta.url),JSON.stringify([{...privateKey.export({format:'jwk'}),kid:randomUUID(),alg:'ES256',use:'sig',key_ops:['sign','verify']}]),{flag:'wx',mode:0o600});console.log('Local sandbox signing key created. It is ignored by Git.');} catch(e){if(e.code!=='EEXIST')throw e;console.log('Existing local signing key preserved.');}
