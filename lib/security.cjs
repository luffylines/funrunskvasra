'use strict';
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fresh=()=>crypto.randomBytes(24).toString('base64url');
const digest=(value,secret)=>{
  if(typeof secret!=='string'||secret.length<32)throw Error('Missing 32+ character signing secret');
  return crypto.createHmac('sha256',secret).update(value).digest();
};
function sign(value,secret){
  const body=Buffer.from(JSON.stringify(value)).toString('base64url');
  return body+'.'+digest(body,secret).toString('base64url');
}
function verify(value,secret){
  if(typeof value!=='string'||value.length>4096)return null;
  const parts=value.split('.');
  if(parts.length!==2||!/^[A-Za-z0-9_-]+$/.test(parts[0])||!/^[A-Za-z0-9_-]+$/.test(parts[1]))return null;
  let signature;
  try{signature=Buffer.from(parts[1],'base64url');}catch{return null;}
  const expected=digest(parts[0],secret);
  if(signature.length!==expected.length||!crypto.timingSafeEqual(signature,expected))return null;
  try{return JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));}catch{return null;}
}
function cookie(req,name){
  const raw=String(req.headers.cookie||'');
  const match=raw.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));
  return match?match.slice(name.length+1):'';
}
function cookieHeader(name,value,maxAge,secure=true){
  return name+'='+value+'; HttpOnly; SameSite=Lax; Path=/; Max-Age='+maxAge+(secure?'; Secure':'');
}
function safeSession(req,secret){
  if(!secret)return null;
  const s=verify(cookie(req,'fr_session'),secret);
  if(!s||s.iss!=='funrunskvasra'||!UUID.test(s.sub||'')||!Number.isFinite(s.exp)||s.exp<Date.now())return null;
  return s;
}
function bridgeTicket(value,secret,state){
  const v=verify(value,secret);
  if(!v||v.iss!=='skvasra-kk'||v.aud!=='funrunskvasra'||
    !UUID.test(v.sub||'')||typeof v.nonce!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(v.nonce)||
    v.state!==state||!Number.isFinite(v.exp)||!Number.isFinite(v.iat)||
    v.iat>Date.now()+30000||v.exp<Date.now()||v.exp-v.iat>120000||
    !['draft','pending','verified','rejected'].includes(v.profile_status))return null;
  return v;
}
function validOrigin(req,origin){
  return typeof origin==='string'&&origin.length>0&&req.headers.origin===origin;
}
module.exports={UUID,fresh,sign,verify,cookie,cookieHeader,safeSession,bridgeTicket,validOrigin};
