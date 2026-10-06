// Local-only human sign-in environment. No production endpoint or real email is used.
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import * as oidc from 'openid-client';
import {createAccountClient} from '../account-client.mjs';
import {createDemoHandler} from '../demo-handler.mjs';
const status=JSON.parse(execFileSync('supabase',['status','--workdir',new URL('./',import.meta.url).pathname,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const base='http://127.0.0.1:56421',issuer=base+'/auth/v1',gameOrigin='http://127.0.0.1:56431',consentOrigin='http://127.0.0.1:56430';
if(status.API_URL!==base)throw Error('Expected isolated local Supabase only.');
const api=async(path,body,token=status.SERVICE_ROLE_KEY,method=body?'POST':'GET')=>{
 const r=await fetch(issuer+path,{method,redirect:'error',signal:AbortSignal.timeout(5000),headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const value=await r.json().catch(()=>({}));if(!r.ok)throw Error('Local identity operation failed.');return value;
};
const password=randomBytes(24).toString('base64url');
let user,client,gameServer,consentServer,closing=false;
async function cleanup(){if(closing)return;closing=true;for(const s of [gameServer,consentServer])s?.close();if(client?.client_id)await api('/admin/oauth/clients/'+client.client_id,undefined,undefined,'DELETE').catch(()=>{});if(user?.id)await api('/admin/users/'+user.id,undefined,undefined,'DELETE').catch(()=>{});}
const page=body=>'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Attract Mode local sandbox</title></head><body><main>'+body+'</main></body></html>';
const reply=(res,status,body,type='text/html',extra={})=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self' http://127.0.0.1:56421 http://127.0.0.1:56430 http://127.0.0.1:56431; frame-ancestors 'none'; base-uri 'none'",...extra});res.end(body);};
const pending=new Map();
try {
 user=await api('/admin/users',{email:`local-${randomBytes(8).toString('hex')}@example.invalid`,password,email_confirm:true});
 client=await api('/admin/oauth/clients',{client_name:'Local browser-game kit',redirect_uris:[gameOrigin+'/auth/callback'],grant_types:['authorization_code'],response_types:['code'],token_endpoint_auth_method:'client_secret_post'});
 const playerSession=await api('/token?grant_type=password',{email:user.email,password},status.ANON_KEY);
 const configuration=await oidc.discovery(new URL(issuer),client.client_id,{client_secret:client.client_secret,id_token_signed_response_alg:'ES256'},oidc.ClientSecretPost(client.client_secret),{execute:[oidc.allowInsecureRequests]});
 const account=createAccountClient({configuration,redirectUri:gameOrigin+'/auth/callback',expectedIssuer:issuer,playerIdKey:randomBytes(32).toString('hex'),registrationCheck:async()=>({gameId:'local-kit',environment:'sandbox'})});
 const handle=createDemoHandler({client:account});
 gameServer=createServer(async(req,res)=>{try{
  if(req.headers.host!==new URL(gameOrigin).host||!req.url.startsWith('/')||req.url.startsWith('//'))return reply(res,403,'Invalid host.');
  const url=new URL(req.url,gameOrigin);
  if(req.method==='GET'&&url.pathname==='/')return reply(res,200,page('<h1>Real local OAuth sandbox</h1><p>Only disposable local identities are used. This is not a production Attract Mode account.</p><aside id="account"></aside><p><a href="/">Refresh account status</a></p><p>The local test player is pre-signed into the isolated provider. Choose Allow or Deny at consent.</p><script type="module" src="/sandbox-ui.mjs"></script>'));
  if(req.method==='GET'&&url.pathname==='/signin-result')return reply(res,200,page('<h1>Sign-in did not finish</h1><p>Access was declined, the request expired, or it could not be verified. You can keep playing without signing in.</p><p><a href="/">Return to the local game</a></p>'));
  if(req.method==='GET'&&url.pathname==='/sandbox-ui.mjs')return reply(res,200,"import {mountAccountUI} from '/account-ui.mjs';mountAccountUI({element:document.querySelector('#account')});",'text/javascript');
  if(req.method==='GET'&&url.pathname==='/account-ui.mjs')return reply(res,200,await readFile(new URL('../integrations/account-ui.mjs',import.meta.url),'utf8'),'text/javascript');
  if(!['GET','POST'].includes(req.method)||req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>1024)return reply(res,400,'Unsupported request.');
  const headers=new Headers();if(req.headers.origin)headers.set('origin',req.headers.origin);if(req.headers.cookie)headers.set('cookie',req.headers.cookie.replaceAll('am-local-flow=','__Host-am-game-flow=').replaceAll('am-local-session=','__Host-am-game-session='));
  const result=await handle(new Request(url,{method:req.method,headers}));
  const out=Object.fromEntries(result.headers);delete out['set-cookie'];out['set-cookie']=result.headers.getSetCookie().map(c=>c.replace('__Host-am-game-flow=','am-local-flow=').replace('__Host-am-game-session=','am-local-session=').replace('; Secure',''));
  if(url.pathname==='/auth/callback'&&result.status>=400)return reply(res,303,'','text/plain',{...out,Location:gameOrigin+'/signin-result'});
  reply(res,result.status,await result.text(),'application/json',out);
 }catch{reply(res,400,'Local sign-in failed. Return to the game and start again.');}});
 consentServer=createServer(async(req,res)=>{try{
  if(req.headers.host!==new URL(consentOrigin).host||!req.url.startsWith('/')||req.url.startsWith('//'))return reply(res,403,'Invalid host.');
  const url=new URL(req.url,consentOrigin);
  if(url.pathname!=='/oauth/consent')return reply(res,404,'Not found.');
  const id=url.searchParams.get('authorization_id');if(!/^[A-Za-z0-9_-]{10,200}$/.test(id||''))return reply(res,400,'Invalid authorization.');
  if(req.method==='GET'){
   const details=await api('/oauth/authorizations/'+id,undefined,playerSession.access_token);
   if(details.redirect_url){const target=new URL(details.redirect_url);if(target.origin!==gameOrigin||target.pathname!=='/auth/callback')throw Error();return reply(res,303,'','text/plain',{Location:target.href});}
   if((details.client.id||details.client.client_id)!==client.client_id||details.redirect_uri!==gameOrigin+'/auth/callback')throw Error();
   for(const[k,v]of pending)if(v.expires<Date.now())pending.delete(k);if(pending.size>=100)throw Error();
   const nonce=randomBytes(32).toString('hex');pending.set(id,{nonce,expires:Date.now()+300000});
   return reply(res,200,page('<h1>Allow the local game to sign in?</h1><p>You are the disposable local test player. The game requests your local account identifier. No real email, account or production data is involved.</p><form method="post"><input type="hidden" name="nonce" value="'+nonce+'"><button name="decision" value="approve">Allow</button> <button name="decision" value="deny">Deny</button></form>'));
  }
  if(req.method!=='POST'||req.headers.origin!==consentOrigin||req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>1024)return reply(res,403,'Invalid request.');
  let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)throw Error();}
  const form=new URLSearchParams(body),saved=pending.get(id);pending.delete(id);
  if(!saved||saved.expires<Date.now()||form.get('nonce')?.length!==saved.nonce.length||!timingSafeEqual(Buffer.from(form.get('nonce')),Buffer.from(saved.nonce))||!['approve','deny'].includes(form.get('decision')))throw Error();
  const decision=await api('/oauth/authorizations/'+id+'/consent',{action:form.get('decision')},playerSession.access_token);
  const target=new URL(decision.redirect_url);if(target.origin!==gameOrigin||target.pathname!=='/auth/callback')throw Error();
  reply(res,303,'','text/plain',{Location:target.href});
 }catch{reply(res,400,'Consent expired or could not be verified. Return to the local game and start again.');}});
 for(const [server,port] of [[gameServer,56431],[consentServer,56430]])await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>cleanup().finally(()=>process.exit()));
 console.log('Local sandbox: http://127.0.0.1:56431. Only a disposable local test player; Ctrl+C cleans up.');
}catch{await cleanup();throw Error('Local sandbox could not start. Check Docker, local ports and npm run sandbox:start. No credentials logged.');}
