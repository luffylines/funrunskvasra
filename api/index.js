'use strict';
// Standalone Vercel Node function. Browser never receives either Supabase secret.
const {randomBytes}=require('node:crypto');
const S=require('../lib/security.cjs');
const DB=require('../lib/store.cjs');
const MAIN='https://www.skvasra.app';
const respond=(res,status,data)=>{
  res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(data));
};
const redirect=(res,url,status=303)=>{
  res.statusCode=status;res.setHeader('Location',url);res.end();
};
const failure=(res,status,message)=>respond(res,status,{error:message});
const secure=()=>process.env.NODE_ENV==='production'||!!process.env.VERCEL;
const origin=()=>process.env.FUNRUN_ORIGIN||'http://localhost:4174';
function configured(){
  return !!(process.env.FUNRUN_BRIDGE_SECRET?.length>=32&&process.env.FUNRUN_SESSION_SECRET?.length>=32&&process.env.FUNRUN_SUPABASE_SECRET_KEY?.startsWith('sb_secret_')&&process.env.FUNRUN_SUPABASE_URL);
}
async function jsonBody(req){
  let raw='',size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>4096){const e=Error('Payload too large');e.status=413;throw e;}
    raw+=chunk.toString('utf8');
  }
  try{return JSON.parse(raw);}catch{const e=Error('Invalid JSON');e.status=400;throw e;}
}
function requireMember(req){
  return S.safeSession(req,process.env.FUNRUN_SESSION_SECRET||'');
}
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  const url=new URL(req.url||'/', 'http://localhost');
  const route=String(url.searchParams.get('__path')||url.pathname.replace(/^\/api\/(?:index\/?)?/,'')).replace(/^\/+/,'');
  const method=req.method||'GET';
  if(method==='OPTIONS')return failure(res,405,'Method not allowed.');
  try{
    if(route==='health'&&method==='GET')return respond(res,200,{ok:true,configured:configured()});
    if(route==='config'&&method==='GET'){
      if(!configured())return failure(res,503,'Registration system is awaiting secure configuration.');
      const event=await DB.activeEvent();
      return respond(res,200,{event});
    }
    if(route==='auth/start'&&method==='GET'){
      if(!configured())return failure(res,503,'Secure SKVASRA connection is not configured.');
      if(secure()&&!/^https:\/\/[a-z0-9.-]+$/.test(origin()))return failure(res,503,'FUNRUN_ORIGIN is not valid.');
      const state=S.fresh();
      res.setHeader('Set-Cookie',S.cookieHeader('fr_bridge_state',state,600,secure()));
      return redirect(res,MAIN+'/api/kk/funrun/authorize?state='+encodeURIComponent(state),302);
    }
    if(route==='auth/callback'&&method==='GET'){
      if(!configured())return failure(res,503,'Registration is not configured.');
      const state=S.cookie(req,'fr_bridge_state');
      const ticket=url.searchParams.get('ticket')||'';
      if(!state||!/^[A-Za-z0-9_-]{20,100}$/.test(state))return failure(res,401,'Missing authorization state.');
      const member=S.bridgeTicket(ticket,process.env.FUNRUN_BRIDGE_SECRET,state);
      if(!member)return failure(res,401,'SKVASRA authorization was invalid or expired.');
      try{await DB.consumeNonce(member.nonce);}
      catch(e){if(e.status===409)return failure(res,401,'This sign-in ticket was already used.');throw e;}
      const session=S.sign({iss:'funrunskvasra',sub:member.sub,name:String(member.name||'KK Member').slice(0,100),
        profile_status:member.profile_status,exp:Date.now()+2*60*60*1000},process.env.FUNRUN_SESSION_SECRET);
      res.setHeader('Set-Cookie',[
        S.cookieHeader('fr_bridge_state','',0,secure()),
        S.cookieHeader('fr_session',session,7200,secure())
      ]);
      return redirect(res,'/?connected=1');
    }
    if(route==='session'&&method==='GET'){
      const member=requireMember(req);
      return respond(res,200,{member:member?{name:member.name,profile_status:member.profile_status}:null});
    }
    if(route==='auth/logout'&&method==='POST'){
      if(!S.validOrigin(req,origin()))return failure(res,403,'Invalid request origin.');
      res.setHeader('Set-Cookie',S.cookieHeader('fr_session','',0,secure()));
      return respond(res,200,{ok:true});
    }
    if((route==='registration'||route==='register')&&method==='GET'){
      if(!configured())return failure(res,503,'Registration is not configured.');
      const member=requireMember(req);
      if(!member)return failure(res,401,'Sign in with SKVASRA first.');
      const event=await DB.activeEvent();
      if(!event)return respond(res,200,{event:null,registration:null});
      return respond(res,200,{registration:await DB.existingRegistration(event.id,member.sub)});
    }
    if(route==='register'&&method==='POST'){
      if(!S.validOrigin(req,origin()))return failure(res,403,'Invalid request origin.');
      if(!configured())return failure(res,503,'Registration is not configured.');
      const member=requireMember(req);
      if(!member)return failure(res,401,'Sign in with SKVASRA first.');
      if(!['pending','verified'].includes(member.profile_status))return failure(res,403,'Complete and submit your KK Profiling before joining the Fun Run.');
      const event=await DB.activeEvent();
      if(!event?.registration_open)return failure(res,403,'Fun Run registration is currently closed.');
      const body=await jsonBody(req);
      const distance=Number(body.distance_km);
      const shirt=String(body.shirt_size||'').toUpperCase();
      if(body.agree!==true||!Number.isInteger(distance)||!event.distances.includes(distance)||!event.shirt_sizes.includes(shirt))
        return failure(res,400,'Select a valid distance, T-shirt size, and confirm the event privacy notice.');
      const existing=await DB.existingRegistration(event.id,member.sub);
      if(existing)return respond(res,200,{registration:existing,already_registered:true});
      try{
        const registration=await DB.register(event.id,member.sub,distance,shirt);
        return respond(res,201,{registration,already_registered:false});
      }catch(e){
        if(e.status===409||e.dbCode==='23505'){
          return respond(res,200,{registration:await DB.existingRegistration(event.id,member.sub),already_registered:true});
        }
        throw e;
      }
    }
    return failure(res,404,'Not found.');
  }catch(e){
    // Do not leak Supabase responses, tokens or personal data to clients or logs.
    if(e.status===400||e.status===413)return failure(res,e.status,e.message);
    console.error('Fun Run request failed:',e.status||e.name||'unknown');
    return failure(res,503,'Service is temporarily unavailable. Try again later.');
  }
};
