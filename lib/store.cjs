'use strict';
const validURL=()=> {
  const url=process.env.FUNRUN_SUPABASE_URL||'';
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))throw Error('FUNRUN_SUPABASE_URL is not configured');
  return url.replace(/\/$/,'');
};
async function query(table,queryString='',method='GET',payload=null,prefer=''){
  const key=process.env.FUNRUN_SUPABASE_SECRET_KEY||'';
  if(!key.startsWith('sb_secret_'))throw Error('FUNRUN_SUPABASE_SECRET_KEY must be a server-only Supabase secret key');
  const endpoint=validURL()+'/rest/v1/'+table+(queryString?'?'+queryString:'');
  const headers={'apikey':key,'Content-Type':'application/json','Accept':'application/json'};
  if(prefer)headers.Prefer=prefer;
  const response=await fetch(endpoint,{method,headers,body:payload===null?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(12000),redirect:'error'});
  let data;
  try{data=await response.json();}catch{data=null;}
  if(!response.ok){const err=Error('Database operation failed');err.status=response.status;err.dbCode=data?.code;throw err;}
  return data;
}
async function activeEvent(){
  const rows=await query('funrun_events','select=id,title,event_date,venue,distances,shirt_sizes,registration_open&order=created_at.desc&limit=1');
  return Array.isArray(rows)?rows[0]||null:null;
}
async function consumeNonce(nonce){
  return query('funrun_login_nonces','','POST',{nonce},'return=minimal');
}
async function existingRegistration(eventId,memberId){
  const filters=new URLSearchParams({select:'id,registration_number,distance_km,shirt_size,status,created_at',event_id:'eq.'+eventId,member_id:'eq.'+memberId,limit:'1'});
  const rows=await query('funrun_registrations',filters.toString());
  return rows?.[0]||null;
}
async function register(eventId,memberId,distance,shirt){
  const rows=await query('funrun_registrations','','POST',{event_id:eventId,member_id:memberId,distance_km:distance,shirt_size:shirt},'return=representation');
  return rows?.[0]||null;
}
module.exports={query,activeEvent,consumeNonce,existingRegistration,register};
