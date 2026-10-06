import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAccountClient,configureAccountClient} from '../account-client.mjs';
test('lower-level sandbox adapter refuses arbitrary remote issuers',()=>{
 assert.throws(()=>createAccountClient({expectedIssuer:'https://evil.example',redirectUri:'https://game.example/auth/callback'}),/Unsupported identity issuer/);
});
test('connected entry never accepts arbitrary issuer selection from caller',async()=>{
 // Missing required registration fails before any discovery or untrusted network operation.
 await assert.rejects(configureAccountClient({expectedIssuer:'http://127.0.0.1:56421/auth/v1'}),/registration/);
});
