// Run against the extracted release (or clean checkout), never the developer workspace.
import assert from 'node:assert/strict';
import {createGameServer} from '../server.mjs';
const server=await createGameServer({port:0,env:{}});
try {
 const base=`http://127.0.0.1:${server.address().port}`;
 const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/OFFLINE DEMO/);
 const me=await fetch(base+'/api/me');assert.equal(me.status,200);assert.equal((await me.json()).signedIn,false);
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:base},redirect:'manual'});assert.equal(login.status,303);
 const achievement=await fetch(base+'/examples/achievements');assert.equal(achievement.status,200);assert.match(await achievement.text(),/Local simulation only/);
 for(const path of ['/contracts/achievement-rules.mjs','/integrations/achievement-panel.mjs','/examples/achievements/manifest.json','/examples/achievements-connected','/examples/achievements-connected.mjs','/integrations/achievements.mjs']){const response=await fetch(base+path);assert.equal(response.status,200);assert.ok((await response.text()).length>50);}
 console.log('Release smoke passed: extracted files serve the game, guest session and login route.');
} finally {await new Promise(resolve=>server.close(resolve));}
