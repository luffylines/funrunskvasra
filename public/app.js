'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const message=(text,type='')=>{const el=$('message');el.textContent=text||'';el.className='alert '+type;el.hidden=!text;};
 const themeSaved=localStorage.getItem('skvasra-funrun-theme');
 if(themeSaved==='dark'||(themeSaved!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.dataset.theme='dark';
 $('theme-toggle').onclick=()=>{
   const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
   document.documentElement.dataset.theme=next;localStorage.setItem('skvasra-funrun-theme',next);
 };
 const api=async(path,opts={})=>{
   const response=await fetch('/api/'+path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opts});
   const value=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(value.error||'The service is unavailable.');
   return value;
 };
 let currentEvent=null,currentRecord=null;
 const panel=name=>{['login','member','complete'].forEach(x=>$(x+'-panel').hidden=x!==name);};
 const setChoices=(element,name,values,format)=>{
   element.replaceChildren();
   values.forEach((v,i)=>{
     const label=document.createElement('label');label.className='choice';
     const radio=document.createElement('input');radio.type='radio';radio.name=name;radio.value=String(v);radio.required=true;if(i===0)radio.checked=true;
     const span=document.createElement('span');span.textContent=format(v);
     label.append(radio,span);element.append(label);
   });
 };
 const dateDisplay=date=>{
   if(!date)return 'To be announced';
   const [year,month,day]=date.split('-').map(Number);
   return new Intl.DateTimeFormat('en-PH',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Manila'}).format(new Date(Date.UTC(year,month-1,day,12)));
 };
 const receipt=record=>{
   currentRecord=record;panel('complete');
   $('reg-number').textContent='#'+String(record.registration_number||'').padStart(5,'0');
   $('reg-distance').textContent=record.distance_km+' KM';
   $('reg-shirt').textContent=record.shirt_size;
   $('reg-status').textContent=String(record.status||'pending').toUpperCase();
 };
 const signout=async()=>{
   try{await api('auth/logout',{method:'POST',body:'{}'});panel('login');message('Signed out of your Fun Run session.');}
   catch(err){message(err.message,'error');}
 };
 $('logout').addEventListener('click',signout);
 $('switch-account').addEventListener('click',signout);
 $('copy-ref').addEventListener('click',async()=>{
   if(!currentRecord)return;
   const text='SK Vasra Fun Run\nRegistration #'+currentRecord.registration_number+'\nDistance: '+currentRecord.distance_km+' KM\nShirt size: '+currentRecord.shirt_size+'\nStatus: '+currentRecord.status;
   try{await navigator.clipboard.writeText(text);message('Registration details copied.');}catch{message('Please save your registration number manually.');}
 });
 $('register-form').addEventListener('submit',async event=>{
   event.preventDefault();
   const form=event.currentTarget;if(!form.reportValidity())return;
   const data=new FormData(form);$('submit').disabled=true;message('Saving your Fun Run registration…');
   try{
     const response=await api('register',{method:'POST',body:JSON.stringify({distance_km:Number(data.get('distance')),shirt_size:data.get('shirt'),agree:$('consent').checked})});
     if(!response.registration)throw Error('Registration was not returned.');
     message('');receipt(response.registration);
   }catch(err){message(err.message,'error');}
   finally{$('submit').disabled=false;}
 });
 async function init(){
   if(new URLSearchParams(location.search).has('connected'))history.replaceState(null,'','/');
   let ready=false;
   try{
     const data=await api('config');currentEvent=data.event;
     if(currentEvent){
       $('event-date').textContent=dateDisplay(currentEvent.event_date);
       $('event-venue').textContent=currentEvent.venue||'To be announced';
       $('event-distances').textContent=(currentEvent.distances||[]).map(x=>x+'K').join(' / ')||'To be announced';
     }
     const open=!!currentEvent?.registration_open;
     $('event-badge').textContent=open?'Registration open':currentEvent?'Registration closed':'Event not configured';
     $('event-badge').classList.toggle('open',open);
     ready=open;
   }catch{
     $('event-badge').textContent='Setup required';
     message('Event registration will open after SK Vasra completes the secure database and event setup.','error');
   }
   try{
     const data=await api('session'),member=data.member;
     if(!member){panel('login');return;}
     $('member-name').textContent=member.name||'KK Member';
     $('member-status').textContent=({pending:'KK profile under review',verified:'Verified KK member',draft:'Profile incomplete',rejected:'Profile correction required'})[member.profile_status]||'Connected with SKVASRA';
     if(!ready){panel('login');return;}
     if(!['pending','verified'].includes(member.profile_status)){
       panel('login');message('Complete and submit your SKVASRA KK Profiling before Fun Run registration.','error');return;
     }
     const existing=await api('registration');
     if(existing.registration){receipt(existing.registration);return;}
     setChoices($('distance-choices'),'distance',currentEvent.distances,x=>x+' KM');
     setChoices($('shirt-choices'),'shirt',currentEvent.shirt_sizes,x=>x);
     panel('member');message('');
   }catch(err){panel('login');if(ready)message(err.message,'error');}
 }
 init();
})();
