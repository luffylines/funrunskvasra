'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../lib/security.cjs');
const secret='development-only-test-secret-is-over-32-chars';
const uuid='12345678-1234-4234-8234-123456789abc';
test('ticket must match audience, state and expiry',()=>{
 const good={iss:'skvasra-kk',aud:'funrunskvasra',sub:uuid,nonce:S.fresh(),state:S.fresh(),
   iat:Date.now(),exp:Date.now()+60000,profile_status:'pending',name:'Sample'};
 const token=S.sign(good,secret);
 assert.equal(S.bridgeTicket(token,secret,good.state).sub,uuid);
 assert.equal(S.bridgeTicket(token,secret,'other'),null);
 assert.equal(S.bridgeTicket(token+'x',secret,good.state),null);
 assert.equal(S.bridgeTicket(S.sign({...good,exp:Date.now()-1000},secret),secret,good.state),null);
 assert.equal(S.bridgeTicket(S.sign({...good,aud:'other'},secret),secret,good.state),null);
});
test('sessions are signed and expire',()=>{
 const token=S.sign({iss:'funrunskvasra',sub:uuid,exp:Date.now()+10000},secret);
 assert.equal(S.safeSession({headers:{cookie:'fr_session='+token}},secret).sub,uuid);
 assert.equal(S.safeSession({headers:{cookie:'fr_session='+token+'z'}},secret),null);
 const old=S.sign({iss:'funrunskvasra',sub:uuid,exp:Date.now()-1000},secret);
 assert.equal(S.safeSession({headers:{cookie:'fr_session='+old}},secret),null);
});
test('POST origin must match exactly',()=>{
 assert.equal(S.validOrigin({headers:{origin:'https://funrun.skvasra.app'}},'https://funrun.skvasra.app'),true);
 assert.equal(S.validOrigin({headers:{origin:'https://evil.example'}},'https://funrun.skvasra.app'),false);
 assert.equal(S.validOrigin({headers:{}},'https://funrun.skvasra.app'),false);
});
