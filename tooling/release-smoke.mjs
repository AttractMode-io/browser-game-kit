// Run against the extracted release (or clean checkout), never the developer workspace.
import assert from 'node:assert/strict';
import {createGameServer} from '../server.mjs';
const server=await createGameServer({port:0,env:{}});
try {
 const base=`http://127.0.0.1:${server.address().port}`;
 const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/OFFLINE DEMO/);
 const me=await fetch(base+'/api/me');assert.equal(me.status,200);assert.equal((await me.json()).signedIn,false);
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:base},redirect:'manual'});assert.equal(login.status,303);
 console.log('Release smoke passed: extracted files serve the game, guest session and login route.');
} finally {await new Promise(resolve=>server.close(resolve));}
