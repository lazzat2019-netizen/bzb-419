import assert from 'node:assert/strict';
import {sign,verify,session,SESSION,FLOW,b64,verifyGoogleToken,authRoute} from './auth.js';
import worker from './index.js';
const secret='a-test-secret-which-is-longer-than-thirty-two-characters';
const env={SESSION_SECRET:secret,GOOGLE_CLIENT_ID:'test-client-id',GOOGLE_CLIENT_SECRET:'test-client-secret'};
const base='https://example.test';
const exp=Math.floor(Date.now()/1000)+3600;
const signed=await sign({kind:'session',email:'lazzat2019@gmail.com',sub:'google-123',exp},secret);
assert.equal((await verify(signed,secret)).email,'lazzat2019@gmail.com');
assert.equal(await verify(signed+'x',secret),null);
assert.equal(await verify(await sign({exp:1},secret),secret),null);
assert.equal(await session(new Request(base,{headers:{cookie:SESSION+'='+signed}}),env).then(s=>s.email),'lazzat2019@gmail.com');
const spoof=await worker.fetch(new Request(base+'/api/me',{headers:{'oai-authenticated-user-id':'fake','oai-authenticated-user-email':'lazzat2019@gmail.com'}}),env);assert.equal((await spoof.json()).teacher,false);
const real=await worker.fetch(new Request(base+'/api/me',{headers:{cookie:SESSION+'='+signed}}),env);assert.equal((await real.json()).teacher,true);
const other=await sign({kind:'session',email:'someone@example.com',sub:'123',exp},secret);assert.equal(await session(new Request(base,{headers:{cookie:SESSION+'='+other}}),env),null);
const start=await authRoute(new Request(base+'/auth/google?return_to=https://evil.invalid'),env);assert.equal(start.status,302);const target=new URL(start.headers.get('location'));assert.equal(target.origin,'https://accounts.google.com');assert.equal(target.searchParams.get('code_challenge_method'),'S256');assert.equal(target.searchParams.get('redirect_uri'),base+'/auth/callback');const flowCookie=start.headers.get('set-cookie').split(';')[0];const flow=await verify(flowCookie.slice(FLOW.length+1),secret);assert.equal(flow.returnTo,'/online');assert.ok(flow.nonce&&flow.verifier&&flow.state);
const badState=await authRoute(new Request(base+'/auth/callback?state=incorrect&code=test',{headers:{cookie:flowCookie}}),env);assert.equal(badState.status,400);
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const pub=await crypto.subtle.exportKey('jwk',keys.publicKey);pub.kid='local-test-key';
const encoder=new TextEncoder();const encode=o=>b64(encoder.encode(JSON.stringify(o)));
async function jwt(claims){const body=encode({alg:'RS256',kid:pub.kid})+'.'+encode(claims);return body+'.'+b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,encoder.encode(body))))}
const claims={iss:'https://accounts.google.com',aud:env.GOOGLE_CLIENT_ID,exp,iat:Math.floor(Date.now()/1000),nonce:flow.nonce,email:'lazzat2019@gmail.com',email_verified:true,sub:'123'};
const originalFetch=globalThis.fetch;let idToken=await jwt(claims);
globalThis.fetch=async url=>{if(String(url).includes('/certs'))return Response.json({keys:[pub]});if(String(url).includes('/token'))return Response.json({id_token:idToken});throw Error('Unexpected outbound URL')};
try{assert.equal((await verifyGoogleToken(idToken,env.GOOGLE_CLIENT_ID,flow.nonce)).email,'lazzat2019@gmail.com');await assert.rejects(()=>verifyGoogleToken(idToken,'wrong-client',flow.nonce));await assert.rejects(()=>verifyGoogleToken(idToken,env.GOOGLE_CLIENT_ID,'wrong-nonce'));await assert.rejects(()=>verifyGoogleToken(idToken.slice(0,-4)+'AAAA',env.GOOGLE_CLIENT_ID,flow.nonce));const callback=await authRoute(new Request(base+'/auth/callback?state='+flow.state+'&code=test',{headers:{cookie:flowCookie}}),env);assert.equal(callback.status,302);assert.equal(callback.headers.get('location'),'/online');assert.ok(callback.headers.get('set-cookie').includes(SESSION));idToken=await jwt({...claims,email:'someone@example.com'});const denied=await authRoute(new Request(base+'/auth/callback?state='+flow.state+'&code=test',{headers:{cookie:flowCookie}}),env);assert.equal(denied.status,403)}finally{globalThis.fetch=originalFetch}
console.log('PASS: signed and expired sessions; spoofed identity headers rejected; Gmail-only teacher; PKCE/state/nonce; Google JWT signatures and claims; OAuth callback.');
