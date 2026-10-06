// Explicit entry point: never silently selects the in-memory development store.
import {createGameServer} from './server.mjs';
try {
 await createGameServer({connected:true,port:Number(process.env.PORT||3000),env:{...process.env,NODE_ENV:'production'}});
 console.log('Production account adapter ready on loopback with encrypted durable sessions. Use the registered HTTPS reverse proxy.');
}catch(error){console.error(error.message);process.exitCode=1;}
