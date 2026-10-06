// Real local Supabase OAuth: creates disposable LOCAL users/clients, then removes them.
// Never accepts a remote URL or production service credential.
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import * as oidc from 'openid-client';
import {createAccountClient} from '../account-client.mjs';
const root=new URL('./',import.meta.url).pathname;
const status=JSON.parse(execFileSync('supabase',['status','--workdir',root,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const base='http://127.0.0.1:56421',issuer=base+'/auth/v1';
assert.equal(status.API_URL,base,'Local sandbox URL must match its fixed loopback address.');
const api=async(path,body,token=status.SERVICE_ROLE_KEY,method=body?'POST':'GET')=>{
 const r=await fetch(issuer+path,{method,headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const value=await r.json().catch(()=>({}));if(!r.ok)throw Error(`Local sandbox request failed: ${path.split('?')[0]} (${r.status})`);return value;
};
let user,client;
try {
 const password=randomBytes(24).toString('base64url');
 user=await api('/admin/users',{email:`sandbox-${randomBytes(8).toString('hex')}@example.invalid`,password,email_confirm:true});
 client=await api('/admin/oauth/clients',{client_name:'Disposable local kit test',redirect_uris:['https://game.example/auth/callback'],grant_types:['authorization_code'],response_types:['code'],token_endpoint_auth_method:'client_secret_post'});
 const session=await api('/token?grant_type=password',{email:user.email,password},status.ANON_KEY);
 const config=await oidc.discovery(new URL(issuer),client.client_id,{client_secret:client.client_secret,id_token_signed_response_alg:'ES256'},oidc.ClientSecretPost(client.client_secret),{execute:[oidc.allowInsecureRequests]});
 const account=createAccountClient({configuration:config,redirectUri:'https://game.example/auth/callback',expectedIssuer:issuer});
 const denied=await account.begin();
 const deniedResponse=await fetch(denied.url,{redirect:'manual'});
 const deniedId=new URL(deniedResponse.headers.get('location')).searchParams.get('authorization_id');
 await api('/oauth/authorizations/'+deniedId,undefined,session.access_token);
 const denial=await api('/oauth/authorizations/'+deniedId+'/consent',{action:'deny'},session.access_token);
 await assert.rejects(account.complete(denied.transaction,denial.redirect_url));
 const begin=await account.begin();
 const authorization=await fetch(begin.url,{redirect:'manual'});
 assert.equal(authorization.status,302);
 const consent=new URL(authorization.headers.get('location'));
 assert.equal(consent.origin,'http://127.0.0.1:56430');
 const id=consent.searchParams.get('authorization_id');assert.ok(id);
 const details=await api('/oauth/authorizations/'+id,undefined,session.access_token);
 assert.equal(details.client.id || details.client.client_id,client.client_id);
 const decision=await api('/oauth/authorizations/'+id+'/consent',{action:'approve'},session.access_token);
 const identity=await account.complete(begin.transaction,decision.redirect_url);
 assert.equal(identity.issuer,issuer);assert.equal(identity.subject,user.id);
 await assert.rejects(account.complete(begin.transaction,decision.redirect_url));
 console.log('PASS: real local Supabase consent, PKCE, signature/issuer/audience validation code replay rejection and denied consent. No production identity used.');
} finally {
 if(client?.client_id)await api('/admin/oauth/clients/'+client.client_id,undefined,undefined,'DELETE');
 if(user?.id)await api('/admin/users/'+user.id,undefined,undefined,'DELETE');
}
