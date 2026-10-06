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
let user,client,secondUser;
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
 // Revoke the disposable client, prove it cannot start authorization, then
 // provision a replacement. This is revoke-and-reissue, not in-place rotation.
 const oldClientId=client.client_id;
 await api('/admin/oauth/clients/'+oldClientId,undefined,undefined,'DELETE');client=null;
 const revoked=await account.begin();
 const rejected=await fetch(revoked.url,{redirect:'manual'});
 const rejectedLocation=rejected.headers.get('location')||'';
 assert.ok(rejected.status>=400 || rejectedLocation.includes('error='),'Revoked client must not reach consent');
 client=await api('/admin/oauth/clients',{client_name:'Replacement disposable local kit test',redirect_uris:['https://game.example/auth/callback'],grant_types:['authorization_code'],response_types:['code'],token_endpoint_auth_method:'client_secret_post'});
 assert.notEqual(client.client_id,oldClientId);
 const replacementConfig=await oidc.discovery(new URL(issuer),client.client_id,{client_secret:client.client_secret,id_token_signed_response_alg:'ES256'},oidc.ClientSecretPost(client.client_secret),{execute:[oidc.allowInsecureRequests]});
 const replacement=createAccountClient({configuration:replacementConfig,redirectUri:'https://game.example/auth/callback',expectedIssuer:issuer});
 const signIn=async(token)=>{
  const flow=await replacement.begin();
  const response=await fetch(flow.url,{redirect:'manual'});
  const authorizationId=new URL(response.headers.get('location')).searchParams.get('authorization_id');
  assert.ok(authorizationId);
  await api('/oauth/authorizations/'+authorizationId,undefined,token);
  const approval=await api('/oauth/authorizations/'+authorizationId+'/consent',{action:'approve'},token);
  return replacement.complete(flow.transaction,approval.redirect_url);
 };
 const restored=await signIn(session.access_token);assert.equal(restored.subject,user.id);
 const secondPassword=randomBytes(24).toString('base64url');
 secondUser=await api('/admin/users',{email:`sandbox-${randomBytes(8).toString('hex')}@example.invalid`,password:secondPassword,email_confirm:true});
 const secondSession=await api('/token?grant_type=password',{email:secondUser.email,password:secondPassword},status.ANON_KEY);
 const switched=await signIn(secondSession.access_token);assert.equal(switched.subject,secondUser.id);assert.notEqual(switched.subject,restored.subject);
 console.log('PASS: revoked client rejected, replacement client signs in same identity, second disposable account remains distinct. Existing issued JWT invalidation is not claimed.');
 console.log('PASS: real local Supabase consent, PKCE, signature/issuer/audience validation code replay rejection and denied consent. No production identity used.');
} finally {
 if(client?.client_id)await api('/admin/oauth/clients/'+client.client_id,undefined,undefined,'DELETE');
 if(secondUser?.id)await api('/admin/users/'+secondUser.id,undefined,undefined,'DELETE');
 if(user?.id)await api('/admin/users/'+user.id,undefined,undefined,'DELETE');
}
